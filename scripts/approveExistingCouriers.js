import dotenv from "dotenv";
import mongoose from "mongoose";

import Courier from "../models/Courier.js";

dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

const result = await Courier.updateMany(
  { approval: { $exists: false } },
  { $set: { approval: "approved", approvalUpdatedAt: new Date() } }
);

console.log(`Approved ${result.modifiedCount} existing couriers`);

await mongoose.disconnect();
