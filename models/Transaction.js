import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Courier",
      required: true,
    },

    courier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Courier",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "earning",
        "withdrawal",
        "adjustment",
        "refund",
        "reversal",
      ],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    balanceBefore: {
      type: Number,
      required: true,
      default: 0,
    },

    balanceAfter: {
      type: Number,
      required: true,
      default: 0,
    },

    reference: {
      type: String,
      required: true,
      unique: true,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    withdrawalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Withdrawal",
      default: null,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "completed",
        "failed",
        "reversed",
      ],
      default: "completed",
    },
  },
  {
    timestamps: true,
  }
);

const Transaction = mongoose.model(
  "Transaction",
  transactionSchema
);

export default Transaction;
