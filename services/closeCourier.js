import crypto from "crypto";
import fs from "fs";
import path from "path";

import bcrypt from "bcryptjs";

import Courier from "../models/Courier.js";
import Order from "../models/Order.js";
import PendingCourier from "../models/PendingCourier.js";
import { UPLOAD_DIR } from "../middleware/upload.js";
import { ACTIVE_STATUSES } from "./dispatch.js";

export const courierIsBusy = (courier) => Order.exists({ courier: courier._id, status: { $in: ACTIVE_STATUSES } });

export const closeCourier = async (courier) => {
  for (const name of [courier.governmentIdFront, courier.governmentIdBack, courier.vehiclePhoto]) {
    const file = name && path.join(UPLOAD_DIR, path.basename(String(name)));
    if (file && fs.existsSync(file)) fs.unlinkSync(file);
  }

  await PendingCourier.deleteMany({ email: courier.email });

  await Courier.updateOne(
    { _id: courier._id },
    {
      $set: {
        fullName: "Deleted courier",
        email: `deleted-${courier._id}@deleted.getcoredispatch.cloud`,
        phone: `deleted-${courier._id}`,
        homeAddress: "",
        governmentIdFront: "",
        governmentIdBack: "",
        vehiclePhoto: "",
        vehicleRegistration: "",
        bankAccount: { bankName: "", accountName: "", accountNumber: "" },
        expoPushToken: null,
        online: false,
        approval: "rejected",
        password: await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10),
        deletedAt: new Date(),
      },
    },
    { strict: false }
  );
};
