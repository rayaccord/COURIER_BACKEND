import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema(
  {
    platform: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Platform",
      required: true,
    },
    externalId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    startsAt: {
      type: Date,
      required: true,
    },
    endsAt: {
      type: Date,
      required: true,
    },
    targetDeliveries: {
      type: Number,
      required: true,
      min: 1,
    },
    rewardAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "NGN",
    },
    areaLabel: {
      type: String,
      default: "",
    },
    areaWords: {
      type: [String],
      default: [],
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

campaignSchema.index({ platform: 1, externalId: 1 }, { unique: true });

campaignSchema.index({ active: 1, endsAt: 1 });

export default mongoose.model("Campaign", campaignSchema);
