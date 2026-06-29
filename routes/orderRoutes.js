import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  createOrder,
  getPendingOrders,
  acceptOrder,
  updateOrderStatus,
  getActiveOrder,
  getOrderHistory,
  rejectOrder,
  getCourierStats,
  getEarningsAnalytics,
  getWeeklyEarnings,
  cancelOrder,
} from "../controllers/orderController.js";

const router = express.Router();

router.post(
  "/",
  createOrder
);

router.get(
  "/pending",
  getPendingOrders
);

router.put(
  "/:id/accept",
  authMiddleware,
  acceptOrder
);

router.put(
  "/:id/status",
  authMiddleware,
  updateOrderStatus
);


router.get(
  "/active",
  authMiddleware,
  getActiveOrder
);

router.get(
  "/history",
  authMiddleware,
  getOrderHistory
);

router.put(
  "/:id/reject",
  authMiddleware,
  rejectOrder
);



router.get(
  "/stats",
  authMiddleware,
  getCourierStats
);

router.put(
  "/:id/cancel",
  authMiddleware,
  cancelOrder
);

router.get(
  "/analytics",
  authMiddleware,
  getEarningsAnalytics
);

router.get(
  "/weekly-earnings",
  authMiddleware,
  getWeeklyEarnings
);

export default router;
