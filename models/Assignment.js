import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    delivery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    platform: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Platform",
      default: null,
    },

    courier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Courier",
      required: true,
      index: true,
    },

    source: {
      type: String,
      enum: ["platform", "auto"],
      default: "platform",
    },

    status: {
      type: String,
      enum: [
        "offered",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
        "completed",
      ],
      default: "offered",
      index: true,
    },

    offeredAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    respondedAt: {
      type: Date,
      default: null,
    },

    reason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const Assignment = mongoose.model(
  "Assignment",
  assignmentSchema
);

export default Assignment;
