import express from "express";

import platformAuth from "../middleware/platformAuth.js";
import { deleteCampaign, saveCampaign } from "../controllers/campaignController.js";
import { listWithdrawals, setWithdrawalStatus } from "../controllers/withdrawalController.js";
import {
  assignDelivery,
  cancelPlatformDelivery,
  createDelivery,
  dispatchDelivery,
  failPlatformDelivery,
  getCourier,
  getCourierDocument,
  getDelivery,
  getDeliveryEvents,
  getDeliveryTracking,
  getNearbyCouriers,
  listCouriers,
  setCourierApproval,
  updateDelivery,
} from "../controllers/platformController.js";

const router = express.Router();

router.use(platformAuth);

router.post("/deliveries", createDelivery);
router.get("/deliveries/:id", getDelivery);
router.patch("/deliveries/:id", updateDelivery);
router.post("/deliveries/:id/cancel", cancelPlatformDelivery);
router.post("/deliveries/:id/fail", failPlatformDelivery);
router.post("/deliveries/:id/assign", assignDelivery);
router.post("/deliveries/:id/dispatch", dispatchDelivery);
router.get("/deliveries/:id/events", getDeliveryEvents);
router.get("/deliveries/:id/tracking", getDeliveryTracking);

router.get("/couriers/nearby", getNearbyCouriers);
router.put("/campaigns/:externalId", saveCampaign);
router.delete("/campaigns/:externalId", deleteCampaign);
router.get("/couriers", listCouriers);
router.get("/couriers/:id", getCourier);
router.get("/couriers/:id/documents/:kind", getCourierDocument);
router.post("/couriers/:id/approval", setCourierApproval);
router.get("/withdrawals", listWithdrawals);
router.post("/withdrawals/:id/status", setWithdrawalStatus);

export default router;
