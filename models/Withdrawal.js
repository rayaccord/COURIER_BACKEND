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

    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "paid",
      ],
      default: "pending",
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