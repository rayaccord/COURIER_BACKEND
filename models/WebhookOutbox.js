import mongoose from "mongoose";

const webhookOutboxSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
    },

    platform: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Platform",
      required: true,
    },

    delivery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },

    event: {
      type: String,
      required: true,
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    ordered: {
      type: Boolean,
      default: true,
    },

    maxAttempts: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["pending", "delivered", "dead"],
      default: "pending",
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    nextAttemptAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    lockedUntil: {
      type: Date,
      default: null,
    },

    lastError: {
      type: String,
      default: "",
    },

    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const WebhookOutbox = mongoose.model(
  "WebhookOutbox",
  webhookOutboxSchema
);

export default WebhookOutbox;
