import express from "express";
import platformAuth from "../middleware/platformAuth.js";

import {
  createDelivery,
} from "../controllers/deliveryController.js";

const router = express.Router();

router.post(
  "/",
  platformAuth,
  createDelivery
);

export default router;