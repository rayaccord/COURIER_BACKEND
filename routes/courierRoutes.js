import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  getProfile,
  updateProfile,
  updateLocation,
} from "../controllers/courierController.js";

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

export default router;