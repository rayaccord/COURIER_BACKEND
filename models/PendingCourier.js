import mongoose from "mongoose";

const pendingCourierSchema =
  new mongoose.Schema(
    {
      fullName: {
        type: String,
        required: true,
      },

      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
      },

      phone: {
        type: String,
        required: true,
      },

      city: {
        type: String,
        default: "",
      },

      vehicle: {
        type: String,
        required: true,
      },


      homeAddress: {
  type: String,
  default: "",
},

vehicleRegistration: {
  type: String,
  default: "",
},

governmentIdType: {
  type: String,
  default: "",
},

governmentIdFront: {
  type: String,
  default: "",
},

governmentIdBack: {
  type: String,
  default: "",
},

vehiclePhoto: {
  type: String,
  default: "",
},

      password: {
        type: String,
        required: true,
      },

      verificationCode: {
        type: String,
        required: true,
      },

      verificationCodeExpires: {
        type: Date,
        required: true,
      },
    },
    {
      timestamps: true,
    }
  );

const PendingCourier =
  mongoose.model(
    "PendingCourier",
    pendingCourierSchema
  );

export default PendingCourier;