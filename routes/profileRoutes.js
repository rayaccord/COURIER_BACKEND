import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  getProfile,
  updateProfile,
  updateLocation,
  updateOnlineStatus,
  updateFcmToken,
} from "../controllers/profileController.js";

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  getProfile
);

router.put(
  "/",
  authMiddleware,
  updateProfile
);

router.put(
  "/location",
  authMiddleware,
  updateLocation
);

router.put(
  "/online",
  authMiddleware,
  updateOnlineStatus
);

router.put(
  "/fcm-token",
  authMiddleware,
  updateFcmToken
);
export default router;
