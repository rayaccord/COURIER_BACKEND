import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },

    platform: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Platform",
      default: null,
      index: true,
    },

    externalOrderId: {
      type: String,
      default: null,
    },

    externalReference: {
      type: String,
      default: "",
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    dispatchMode: {
      type: String,
      enum: ["manual", "auto"],
      default: "auto",
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
  default: "",
},

pharmacyName: {
  type: String,
  default: "",
},

storeName: {
  type: String,
  default: "",
},

pickupPhone: {
  type: String,
  default: "",
},

pickupExternalId: {
  type: String,
  default: "",
},

dropoffInstructions: {
  type: String,
  default: "",
},

itemsCount: {
  type: Number,
  default: 0,
},

items: [
  {
    _id: false,
    name: {
      type: String,
      default: "",
    },
    quantity: {
      type: Number,
      default: 1,
    },
    note: {
      type: String,
      default: "",
    },
  },
],

currency: {
  type: String,
  default: "NGN",
},

sourceType: {
  type: String,
  enum: [
    "restaurant",
    "pharmacy",
    "store",
    "other",
  ],
  default: "restaurant",
  index: true,
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
    "assigned",
    "accepted",
    "en_route_to_pickup",
    "arrived_pickup",
    "picked_up",
    "in_transit",
    "arrived_delivery",
    "delivered",
    "cancelled",
    "failed",
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

currentAssignment: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Assignment",
  default: null,
},

statusChangedAt: {
  type: Date,
  default: Date.now,
},

cancelReason: {
  type: String,
  default: "",
},

cancelledBy: {
  type: String,
  default: "",
},

courierLocation: {
  lat: {
    type: Number,
    default: null,
  },

  lng: {
    type: Number,
    default: null,
  },

  recordedAt: {
    type: Date,
    default: null,
  },
},

lastLocationEventAt: {
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

orderSchema.index(
  {
    platform: 1,
    externalOrderId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      externalOrderId: {
        $type: "string",
      },
    },
  }
);

orderSchema.index({
  courier: 1,
  status: 1,
});

const Order = mongoose.model(
  "Order",
  orderSchema
);

export default Order;
