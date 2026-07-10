import mongoose from "mongoose";

const surgeZoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },

      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },

    radius: {
      type: Number,
      default: 400, // meters
    },

    multiplier: {
      type: String,
      enum: ["1x", "2.4x", "2.3x", "3x"],
      default: "1x",
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

// Geo index
surgeZoneSchema.index({
  location: "2dsphere",
});

export default mongoose.model(
  "SurgeZone",
  surgeZoneSchema
);