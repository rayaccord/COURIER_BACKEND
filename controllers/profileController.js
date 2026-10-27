import crypto from "crypto";
import fs from "fs";
import path from "path";

import bcrypt from "bcryptjs";

import { saveCourierLocation } from "../services/courierLocation.js";
import { ACTIVE_STATUSES } from "../services/dispatch.js";
import { UPLOAD_DIR } from "../middleware/upload.js";
import Order from "../models/Order.js";
import PendingCourier from "../models/PendingCourier.js";
import { isCoordinate } from "../services/geo.js";
import Courier from "../models/Courier.js";
import { getMessaging } from "firebase-admin/messaging";

/* GET PROFILE */
export const getProfile = async (req, res) => {
  try {
    const courier = await Courier.findById(req.user.id);

    if (!courier) {
      return res.status(404).json({
        message: "Courier not found",
      });
    }

    res.status(200).json({
  fullName: courier.fullName,
  email: courier.email,
  phone: courier.phone,
  vehicle: courier.vehicle,
  city: courier.city,

  vehicleRegistration: courier.vehicleRegistration,
  governmentIdType: courier.governmentIdType,
governmentIdFront: courier.governmentIdFront,
governmentIdBack: courier.governmentIdBack,
address: courier.homeAddress,

  referralCode: courier.referralCode,
  referralBalance: courier.referralBalance,
  successfulReferrals: courier.successfulReferrals,
  pendingReferrals: courier.pendingReferrals,
  referralTotalEarned: courier.referralTotalEarned,

  rating: courier.rating,
  completedOrders: courier.completedOrders,
  online: courier.online,
  approval: courier.approval,
  approvalNote: courier.approvalNote,
});
  } catch (error) {
  console.log("GET PROFILE ERROR:");
  console.log(error);

  res.status(500).json({
    message: "Server Error",
    error: error.message,
  });
}
};

/* UPDATE PROFILE */
export const updateProfile = async (req, res) => {
  try {
const {
  fullName,
  phone,
  vehicle,
  city,
  vehicleRegistration,
  governmentIdType,
  address,
} = req.body;

    const courier = await Courier.findById(req.user.id);

    if (!courier) {
      return res.status(404).json({
        message: "Courier not found",
      });
    }

    courier.fullName =
      fullName ?? courier.fullName;

    courier.phone =
      phone ?? courier.phone;

    courier.vehicle =
      vehicle ?? courier.vehicle;

    courier.city =
      city ?? courier.city;

      courier.vehicleRegistration =
  vehicleRegistration ??
  courier.vehicleRegistration;

courier.governmentIdType =
  governmentIdType ??
  courier.governmentIdType;

courier.homeAddress =
  address ??
  courier.homeAddress;

    await courier.save();

    res.status(200).json({
      message: "Profile updated successfully",
      courier,
    });

  } catch (error) {
  console.log("UPDATE PROFILE ERROR:");
  console.log(error);

  res.status(500).json({
    message: "Server Error",
    error: error.message,
  });
}
};


export const updateLocation =
  async (req, res) => {

    try {

      const {
        lat,
        lng,
      } = req.body;

      if (!isCoordinate(lat, lng)) {
        return res.status(400).json({
          message:
            "Valid latitude and longitude are required",
        });
      }

      const courier =
        await saveCourierLocation(
          req.user.id,
          lat,
          lng
        );

      if (!courier) {
        return res.status(404).json({
          message:
            "Courier not found",
        });
      }

      res.status(200).json({
        message:
          "Location updated",
      });

    } catch (error) {

      res.status(500).json({
        message:
          "Failed to update location",
      });

    }
  };



const APPROVAL_MESSAGES = {
  pending:
    "Your account is waiting for approval from the Hooks team. You can go online once it is approved.",
  paused:
    "Your account is paused by the Hooks team. Please contact support.",
  rejected:
    "Your account was rejected by the Hooks team. Please contact support.",
};

  export const updateOnlineStatus =
  async (req, res) => {

    try {

      const { online } =
        req.body;

      const courier =
        await Courier.findById(
          req.user.id
        );

      if (!courier) {
        return res.status(404).json({
          message:
            "Courier not found",
        });
      }

      if (online && courier.approval !== "approved") {
        return res.status(403).json({
          message:
            APPROVAL_MESSAGES[courier.approval] ||
            APPROVAL_MESSAGES.pending,
          approval: courier.approval,
        });
      }

      courier.online =
        online;

      await courier.save();

      res.status(200).json({
        message:
          "Status updated",
        online:
          courier.online,
      });

    } catch (error) {

      res.status(500).json({
        message:
          "Failed to update status",
      });

    }
  };



  export const savePushToken = async (req, res) => {
  try {

    const { token } = req.body;

    console.log("EXPO PUSH TOKEN RECEIVED:");
    console.log(token);

    const courier = await Courier.findById(req.user.id);

    if (!courier) {
      return res.status(404).json({
        message: "Courier not found",
      });
    }

    courier.expoPushToken = token;

    await courier.save();

    console.log("TOKEN SAVED FOR:", courier.email);
    console.log(courier.expoPushToken);

    res.status(200).json({
      message: "Push token saved successfully",
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Failed to save push token",
    });

  }
};


export const sendTestNotification = async (req, res) => {
  try {
    const courier = await Courier.findById(req.user.id);

    if (!courier || !courier.fcmToken) {
      return res.status(404).json({
        message: "No FCM token found.",
      });
    }

    await getMessaging().send({
      token: courier.fcmToken,
      notification: {
        title: "🧪 Test Notification",
        body: "Congratulations! Firebase Cloud Messaging is working.",
      },
    });

    res.json({
      message: "Test notification sent successfully.",
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: error.message,
    });
  }
};


/* DELETE ACCOUNT */
export const deleteAccount = async (req, res) => {
  try {
    const courier = await Courier.findById(req.user.id);

    if (!courier) {
      return res.status(404).json({ message: "Courier not found" });
    }

    const busy = await Order.exists({ courier: courier._id, status: { $in: ACTIVE_STATUSES } });

    if (busy) {
      return res.status(409).json({ message: "Finish your current delivery before deleting your account." });
    }

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

    return res.json({ message: "Your courier account has been deleted." });
  } catch (error) {
    return res.status(500).json({ message: "Could not delete the account" });
  }
};
