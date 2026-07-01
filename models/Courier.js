import mongoose from "mongoose";

const courierSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    fullName: {
  type: String,
  default: "",
},

    phone: {
      type: String,
      required: true,
      unique: true,
    },

    vehicle: {
      type: String,
      required: true,
      enum: ["bike", "bicycle", "car", "van"],
    },

    city: {
  type: String,
  default: "",
},

    password: {
      type: String,
      required: true,
      minlength: 8,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    verificationCode: {
      type: String,
    },

    verificationCodeExpires: {
      type: Date,
    },

    resetPasswordCode: {
      type: String,
    },

    resetPasswordCodeExpires: {
      type: Date,
    },

    rating: {
      type: Number,
      default: 5,
    },

    completedOrders: {
      type: Number,
      default: 0,
    },

   wallet: {
  available: {
    type: Number,
    default: 0,
  },

  pending: {
    type: Number,
    default: 0,
  },

  today: {
    type: Number,
    default: 0,
  },

  weekly: {
    type: Number,
    default: 0,
  },

  monthly: {
    type: Number,
    default: 0,
  },

  totalEarned: {
    type: Number,
    default: 0,
  },
},

bankAccount: {
  bankName: {
    type: String,
    default: "",
  },

  accountName: {
    type: String,
    default: "",
  },

  accountNumber: {
    type: String,
    default: "",
  },
},

transactions: [
  {
    type: {
      type: String,
      enum: [
        "delivery",
        "withdrawal",
      ],
    },

    amount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      default: "Completed",
    },

    date: {
      type: Date,
      default: Date.now,
    },
  },
],

    online: {
  type: Boolean,
  default: false,
},

fcmToken: {
  type: String,
  default: "",
},

location: {
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
    location: {
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
  },
  {
    timestamps: true,
  }
);

/* GEO INDEX */
courierSchema.index({ location: "2dsphere" });

const Courier = mongoose.model("Courier", courierSchema);

export default Courier;
