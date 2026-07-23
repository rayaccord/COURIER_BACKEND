import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

console.log("✅ profileRoutes loaded");

import {
  getProfile,
  updateProfile,
  updateLocation,
  updateOnlineStatus,
  savePushToken,
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

router.post(
  "/push-token",
  authMiddleware,
  savePushToken
);


export default router;