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
  governmentId: courier.governmentId,
  address: courier.address,

  referralCode: courier.referralCode,
  referralBalance: courier.referralBalance,
  successfulReferrals: courier.successfulReferrals,
  pendingReferrals: courier.pendingReferrals,
  referralTotalEarned: courier.referralTotalEarned,

  rating: courier.rating,
  completedOrders: courier.completedOrders,
  online: courier.online,
});
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
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
  governmentId,
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

courier.governmentId =
  governmentId ??
  courier.governmentId;

courier.address =
  address ??
  courier.address;

    await courier.save();

    res.status(200).json({
      message: "Profile updated successfully",
      courier,
    });

  } catch (error) {
    res.status(500).json({
      message: "Server Error",
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

      courier.location = {
        type: "Point",
        coordinates: [
          lng,
          lat,
        ],
      };

      await courier.save();

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



  export const updateFcmToken = async (req, res) => {
  try {

    const { fcmToken } = req.body;

    console.log("FCM TOKEN RECEIVED:");
console.log(fcmToken);

    const courier =
      await Courier.findById(req.user.id);

    if (!courier) {
      return res.status(404).json({
        message: "Courier not found",
      });
    }

    courier.fcmToken = fcmToken;

    await courier.save();

    console.log("TOKEN SAVED FOR:", courier.email);
console.log(courier.fcmToken);

    res.status(200).json({
      message: "FCM token saved successfully",
    });

  } catch (error) {

    res.status(500).json({
      message: "Failed to save FCM token",
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
