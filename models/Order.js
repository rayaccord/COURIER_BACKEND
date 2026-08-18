import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },

    hooksOrderId: {
  type: String,
  required: true,
  unique: true,
  index: true,
},

hooksUserId: {
  type: String,
  default: "",
  index: true,
},

hooksRestaurantId: {
  type: String,
  default: "",
  index: true,
},

    customerName: {
      type: String,
      required: true,
    },

    customerPhone: {
  type: String,
  default: "",
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

    dropoffLocation: {
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
    "arrived_customer",
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

orderSchema.index({
  dropoffLocation: "2dsphere",
});

const Order = mongoose.model(
  "Order",
  orderSchema
);

export default Order;
