import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  getProfile,
  updateProfile,
  updateLocation,
  updateOnlineStatus,
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
export default router;