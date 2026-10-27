import mongoose from "mongoose";

import Courier from "../models/Courier.js";
import Transaction from "../models/Transaction.js";
import Withdrawal from "../models/Withdrawal.js";

const STATUSES = ["pending", "processing", "successful", "failed", "rejected"];

const NEXT = {
  pending: ["processing", "successful", "rejected"],
  processing: ["successful", "failed"],
};

const view = (w) => ({
  id: String(w._id),
  amount: w.amount,
  status: w.status,
  bank_name: w.bankName,
  bank_code: w.bankCode,
  account_name: w.accountName,
  account_number: w.accountNumber,
  reference: w.paystackReference,
  reason: w.rejectionReason || w.failureReason || "",
  requested_at: w.createdAt,
  paid_at: w.paidAt,
  courier: w.courier
    ? {
        id: String(w.courier._id || w.courier),
        name: w.courier.fullName,
        phone: w.courier.phone,
        email: w.courier.email,
      }
    : null,
});

export const listWithdrawals = async (req, res) => {
  try {
    const status = String(req.query.status || "");
    const filter = STATUSES.includes(status) ? { status } : {};

    const rows = await Withdrawal.find(filter)
      .populate("courier", "fullName phone email")
      .sort({ createdAt: -1 })
      .limit(300);

    return res.json({ withdrawals: rows.map(view) });
  } catch (error) {
    return res.status(500).json({ message: "Could not load withdrawals" });
  }
};

export const setWithdrawalStatus = async (req, res) => {
  try {
    const { status, reference = "", reason = "" } = req.body || {};

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    const current = await Withdrawal.findById(req.params.id);

    if (!current) {
      return res.status(404).json({ message: "Withdrawal not found" });
    }

    if (!(NEXT[current.status] || []).includes(status)) {
      return res.status(409).json({ message: `A ${current.status} withdrawal cannot become ${status}` });
    }

    const changes = { status };

    if (reference) changes.paystackReference = String(reference).slice(0, 100);
    if (status === "successful") changes.paidAt = new Date();
    if (status === "processing") changes.approvedAt = new Date();
    if (status === "rejected") changes.rejectionReason = String(reason).slice(0, 300);
    if (status === "failed") changes.failureReason = String(reason).slice(0, 300);

    const withdrawal = await Withdrawal.findOneAndUpdate(
      { _id: current._id, status: current.status },
      { $set: changes },
      { new: true }
    );

    if (!withdrawal) {
      return res.status(409).json({ message: "This withdrawal was changed by someone else. Refresh and try again." });
    }

    if (status === "successful") {
      await Courier.updateOne({ _id: withdrawal.courier }, { $inc: { "wallet.pending": -withdrawal.amount } });
      await Transaction.updateOne({ withdrawalId: withdrawal._id }, { $set: { status: "completed" } });
    }

    if (status === "failed" || status === "rejected") {
      await Courier.updateOne(
        { _id: withdrawal.courier },
        { $inc: { "wallet.pending": -withdrawal.amount, "wallet.available": withdrawal.amount } }
      );
      await Transaction.updateOne({ withdrawalId: withdrawal._id }, { $set: { status: "reversed" } });
    }

    const full = await Withdrawal.findById(withdrawal._id).populate("courier", "fullName phone email");

    return res.json({ withdrawal: view(full) });
  } catch (error) {
    return res.status(500).json({ message: "Could not update the withdrawal" });
  }
};
