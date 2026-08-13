import Courier from "../models/Courier.js";
import Withdrawal from "../models/Withdrawal.js";
import Transaction from "../models/Transaction.js";

/* GET WALLET */
export const getWallet = async (req, res) => {
  try {
    const courier = await Courier.findById(req.user.id);

    if (!courier) {
      return res.status(404).json({
        message: "Courier not found",
      });
    }

    const transactions = await Transaction.find({
      courier: courier._id,
    })
      .sort({ createdAt: -1 })
      .limit(100);

    const withdrawals = await Withdrawal.find({
      courier: courier._id,
    })
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({
      wallet: courier.wallet,
      bankAccount: courier.bankAccount,
      transactions,
      withdrawals,
    });
  } catch (error) {
    console.error("GET WALLET ERROR:", error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

/* UPDATE BANK ACCOUNT */
export const updateBankAccount = async (
  req,
  res
) => {
  try {
    const {
      bankName,
      accountName,
      accountNumber,
    } = req.body;

    const courier = await Courier.findById(
      req.user.id
    );

    if (!courier) {
      return res.status(404).json({
        message: "Courier not found",
      });
    }

    courier.bankAccount = {
      bankName,
      accountName,
      accountNumber,
    };

    await courier.save();

    res.status(200).json({
      message: "Bank account updated",
      bankAccount:
        courier.bankAccount,
    });

  } catch (error) {
    res.status(500).json({
      message: "Server Error",
    });
  }
};


/* WITHDRAW FUNDS */
export const withdrawFunds = async (req, res) => {
  try {
    const { amount } = req.body;

    const courier = await Courier.findById(req.user.id);

    if (!courier) {
      return res.status(404).json({
        message: "Courier not found",
      });
    }

    if (!courier.bankAccount?.accountNumber) {
      return res.status(400).json({
        message: "Please add a payment account first",
      });
    }

    const withdrawalAmount = Number(amount);

    if (
      !Number.isFinite(withdrawalAmount) ||
      withdrawalAmount <= 0
    ) {
      return res.status(400).json({
        message: "Invalid amount",
      });
    }

    if (withdrawalAmount > courier.wallet.available) {
      return res.status(400).json({
        message: "Insufficient balance",
      });
    }

    const balanceBefore = courier.wallet.available;

    const withdrawal = await Withdrawal.create({
      courier: courier._id,
      amount: withdrawalAmount,
      bankName: courier.bankAccount.bankName,
      accountName: courier.bankAccount.accountName,
      accountNumber: courier.bankAccount.accountNumber,
      status: "pending",
    });

    courier.wallet.available -= withdrawalAmount;
    courier.wallet.pending += withdrawalAmount;

    await courier.save();

    await Transaction.create({
      walletId: courier._id,
      courier: courier._id,
      type: "withdrawal",
      amount: withdrawalAmount,
      balanceBefore,
      balanceAfter: courier.wallet.available,
      reference: `WD-${withdrawal._id}`,
      withdrawalId: withdrawal._id,
      status: "pending",
    });

    res.status(200).json({
      message: "Withdrawal request submitted",
      withdrawal,
      wallet: courier.wallet,
    });
  } catch (error) {
    console.error("WITHDRAW ERROR:", error);

    res.status(500).json({
      message: "Server Error",
    });
  }
};

/* ADD DELIVERY EARNING */
export const addDeliveryEarning = async (
  req,
  res
) => {
  try {
    const { amount } = req.body;

    const courier = await Courier.findById(
      req.user.id
    );

    if (!courier) {
      return res.status(404).json({
        message: "Courier not found",
      });
    }

    if (
      !amount ||
      Number(amount) <= 0
    ) {
      return res.status(400).json({
        message: "Invalid earning amount",
      });
    }

    const earning = Number(amount);

    courier.wallet.available += earning;
    courier.wallet.today += earning;
    courier.wallet.weekly += earning;
    courier.wallet.monthly += earning;
    courier.wallet.totalEarned += earning;

    courier.completedOrders += 1;

    courier.transactions.unshift({
      type: "delivery",
      amount: earning,
      status: "Completed",
      date: new Date(),
    });

    await courier.save();

    res.status(200).json({
      message: "Earning added",
      wallet: courier.wallet,
      transactions:
        courier.transactions,
    });

  } catch (error) {
    res.status(500).json({
      message: "Server Error",
    });
  }
};
