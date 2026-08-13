import mongoose from "mongoose";

const withdrawalSchema = new mongoose.Schema(
  {
    courier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Courier",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    bankName: {
      type: String,
      required: true,
    },

    accountName: {
      type: String,
      required: true,
    },

    accountNumber: {
      type: String,
      required: true,
    },

    bankCode: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "processing",
        "successful",
        "failed",
        "rejected",
      ],
      default: "pending",
    },

    paystackReference: {
      type: String,
      default: "",
    },

    rejectionReason: {
      type: String,
      default: "",
    },

    failureReason: {
      type: String,
      default: "",
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Withdrawal = mongoose.model(
  "Withdrawal",
  withdrawalSchema
);

export default Withdrawal;
