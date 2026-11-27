import fs from "fs";
import path from "path";

import mongoose from "mongoose";

import Courier from "../models/Courier.js";
import Order from "../models/Order.js";
import { CASH_DIR, CASH_STATUSES, cashView, isCashOrder } from "../services/cash.js";
import { recordEvent } from "../services/deliveryEvents.js";
import { ARRIVAL_DIR } from "../services/arrival.js";

const removeUploaded = (file) => file && fs.existsSync(file.path) && fs.unlinkSync(file.path);

export const recordCash = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      removeUploaded(req.file);
      return res.status(404).json({ message: "Order not found" });
    }

    const order = await Order.findOne({ _id: req.params.id, courier: req.user.id });

    if (!order) {
      removeUploaded(req.file);
      return res.status(404).json({ message: "Order not found" });
    }

    if (!isCashOrder(order)) {
      removeUploaded(req.file);
      return res.status(400).json({ message: "This order is not paid with cash" });
    }

    if (order.cash?.collectedAt) {
      removeUploaded(req.file);
      return res.status(409).json({ message: "The cash for this order is already recorded" });
    }

    if (!CASH_STATUSES.includes(order.status)) {
      removeUploaded(req.file);
      return res.status(409).json({ message: "Collect the cash when you deliver the order" });
    }

    const amount = Number(req.body?.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      removeUploaded(req.file);
      return res.status(400).json({ message: "Enter the cash amount you collected" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Take a photo of the cash or the receipt" });
    }

    const updated = await Order.findOneAndUpdate(
      { _id: order._id, "cash.collectedAt": { $exists: false } },
      { $set: { cash: { amount, collectedAt: new Date(), proofFile: path.basename(req.file.path) } } },
      { returnDocument: "after" }
    );

    if (!updated) {
      removeUploaded(req.file);
      return res.status(409).json({ message: "The cash for this order is already recorded" });
    }

    const courier = await Courier.findById(req.user.id);

    await recordEvent({ order: updated, event: "delivery.cash_collected", courier, actor: "courier", note: `Cash collected ${amount}` });

    return res.json({ message: "Cash recorded", cash: cashView(updated) });
  } catch (error) {
    removeUploaded(req.file);
    return res.status(500).json({ message: error.message });
  }
};

export const cashProof = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Order not found" });
  }

  const order = await Order.findById(req.params.id);
  const name = path.basename(String(order?.cash?.proofFile || ""));
  const file = name && path.join(CASH_DIR, name);

  if (!file || !fs.existsSync(file)) {
    return res.status(404).json({ message: "No cash photo for this order" });
  }

  res.set("Cache-Control", "private, no-store");
  return res.sendFile(file);
};

export const arrivalPhoto = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || !["pickup", "delivery"].includes(req.params.kind)) {
    return res.status(404).json({ message: "Order not found" });
  }

  const order = await Order.findById(req.params.id);
  const name = path.basename(String(order?.arrivals?.[req.params.kind]?.photoFile || ""));
  const file = name && path.join(ARRIVAL_DIR, name);

  if (!file || !fs.existsSync(file)) {
    return res.status(404).json({ message: "No arrival photo for this order" });
  }

  res.set("Cache-Control", "private, no-store");
  return res.sendFile(file);
};
