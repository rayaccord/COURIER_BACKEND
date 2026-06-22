import Courier from "../models/Courier.js";
import Withdrawal from "../models/Withdrawal.js";

/* GET WALLET */
export const getWallet = async (req, res) => {
  try {
    const courier = await Courier.findById(req.user.id);

    if (!courier) {
      return res.status(404).json({
        message: "Courier not found",
      });
    }

    res.status(200).json({
      wallet: courier.wallet,
      bankAccount: courier.bankAccount,
      transactions: courier.transactions,
    });

  } catch (error) {
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
export const withdrawFunds = async (
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

    // Check bank account exists
    if (
      !courier.bankAccount?.accountNumber
    ) {
      return res.status(400).json({
        message:
          "Please add a payment account first",
      });
    }

    // Check amount is valid
    if (
      !amount ||
      Number(amount) <= 0
    ) {
      return res.status(400).json({
        message: "Invalid amount",
      });
    }

    // Check balance
    if (
      Number(amount) >
      courier.wallet.available
    ) {
      return res.status(400).json({
        message:
          "Insufficient balance",
      });
    }

// Create withdrawal request
await Withdrawal.create({
  courier: courier._id,

  amount: Number(amount),

  bankName:
    courier.bankAccount.bankName,

  accountName:
    courier.bankAccount.accountName,

  accountNumber:
    courier.bankAccount.accountNumber,

  status: "pending",
});

// Deduct funds
courier.wallet.available -=
  Number(amount);

// Save transaction
courier.transactions.unshift({
  type: "withdrawal",
  amount: Number(amount),
  status: "Pending",
  date: new Date(),
});

await courier.save();
    res.status(200).json({
      message:
        "Withdrawal request submitted",
      wallet: courier.wallet,
    });

  } catch (error) {
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