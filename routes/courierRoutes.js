import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  getProfile,
  updateProfile,
  updateLocation,
  savePushToken,
} from "../controllers/courierController.js";
import { courierCampaigns } from "../controllers/campaignController.js";
import { myAgreement, myAgreementPage, submitAgreement } from "../controllers/agreementController.js";
import { pageUpload } from "../services/agreement.js";

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

router.get("/agreement", authMiddleware, myAgreement);
router.post("/agreement", authMiddleware, pageUpload.array("pages", 5), submitAgreement);
router.get("/agreement/pages/:page", authMiddleware, myAgreementPage);

export default router;