import express from "express";
import apiKeyMiddleware from "../middleware/apiKeyMiddleware.js";

import {
  createDelivery,
} from "../controllers/deliveryController.js";

const router = express.Router();

router.post(
  "/",
  apiKeyMiddleware,
  createDelivery
);

export default router;