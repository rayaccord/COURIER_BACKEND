import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  getProfile,
  updateProfile,
  updateLocation,
  savePushToken,
} from "../controllers/courierController.js";
import { courierCampaigns } from "../controllers/campaignController.js";

const router =
  express.Router();

router.get(
  "/profile",
  authMiddleware,
  getProfile
);

router.put(
  "/profile",
  authMiddleware,
  updateProfile
);

router.put(
  "/location",
  authMiddleware,
  updateLocation
);

router.get(
  "/campaigns",
  authMiddleware,
  courierCampaigns
);

router.post(
  "/push-token",
  authMiddleware,
  savePushToken
);

export default router;