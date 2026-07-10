import express from "express";

import {
  getSurgeZones,
  createSurgeZone,
} from "../controllers/surgeController.js";

const router = express.Router();

/* Get all active surge zones */
router.get("/", getSurgeZones);

/* Create a new surge zone */
router.post("/", createSurgeZone);

export default router;