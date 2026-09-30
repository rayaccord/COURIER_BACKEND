import express from "express";
import platformAuth from "../middleware/platformAuth.js";

import {
  getSurgeZones,
  createSurgeZone,
} from "../controllers/surgeController.js";

const router = express.Router();

/* Get all active surge zones */
router.get("/", getSurgeZones);

/* Create a new surge zone */
router.post("/", platformAuth, createSurgeZone);

export default router;