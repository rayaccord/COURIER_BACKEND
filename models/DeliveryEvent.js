import mongoose from "mongoose";

const deliveryEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
    },

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

    event: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      default: "",
    },

    courier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Courier",
      default: null,
    },

    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      default: null,
    },

    location: {
      lat: {
        type: Number,
        default: null,
      },

      lng: {
        type: Number,
        default: null,
      },
    },

    actor: {
      type: String,
      enum: ["courier", "platform", "system"],
      default: "system",
    },

    note: {
      type: String,
      default: "",
    },

    occurredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

deliveryEventSchema.index({
  delivery: 1,
  occurredAt: 1,
});

const DeliveryEvent = mongoose.model(
  "DeliveryEvent",
  deliveryEventSchema
);

export default DeliveryEvent;
