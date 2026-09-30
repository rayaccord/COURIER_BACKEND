import mongoose from "mongoose";

const platformSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    apiKeyHash: {
      type: String,
      required: true,
      unique: true,
    },

    webhookUrl: {
      type: String,
      default: "",
    },

    webhookSecret: {
      type: String,
      default: "",
    },

    dispatchMode: {
      type: String,
      enum: ["manual", "auto"],
      default: "manual",
    },

    assignmentTimeoutSeconds: {
      type: Number,
      default: null,
    },

    defaultRadiusKm: {
      type: Number,
      default: null,
    },

    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Platform = mongoose.model(
  "Platform",
  platformSchema
);

export default Platform;
