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

vehicleRegistration: {
  type: String,
  default: "",
},

governmentId: {
  type: String,
  default: "",
},

address: {
  type: String,
  default: "",
},

referralCode: {
  type: String,
  unique: true,
  default: "",
},

referralBalance: {
  type: Number,
  default: 0,
},

successfulReferrals: {
  type: Number,
  default: 0,
},

pendingReferrals: {
  type: Number,
  default: 0,
},

referralTotalEarned: {
  type: Number,
  default: 0,
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
  },
  {
    timestamps: true,
  }
);

/* GEO INDEX */
courierSchema.index({ location: "2dsphere" });

/* Generate Referral Code */
courierSchema.pre("save", async function () {

  if (!this.referralCode) {

    const random = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

    this.referralCode = `CORE-${random}`;
  }

});


const Courier = mongoose.model("Courier", courierSchema);

export default Courier;
