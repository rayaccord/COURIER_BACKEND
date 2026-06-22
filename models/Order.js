import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },

    customerName: {
      type: String,
      required: true,
    },

    restaurantName: {
      type: String,
      required: true,
    },

    pickupAddress: {
      type: String,
      required: true,
    },

    pickupLocation: {
  type: {
    type: String,
    enum: ["Point"],
    default: "Point",
  },

  coordinates: {
    type: [Number], // [lng, lat]
    default: [0, 0],
  },
},

    dropoffAddress: {
      type: String,
      required: true,
    },

    

    fee: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "heading_to_restaurant",
        "arrived_restaurant",
        "picked_up",
        "on_the_way",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },

    courier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Courier",
      default: null,
    },

    assignedCouriers: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Courier",
  },
],

expiresAt: {
  type: Date,
  default: null,
},

  },
  {
    timestamps: true,
  }
);

orderSchema.index({
  pickupLocation: "2dsphere",
});

const Order = mongoose.model(
  "Order",
  orderSchema
);

export default Order;