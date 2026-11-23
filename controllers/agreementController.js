import fs from "fs";
import path from "path";

import mongoose from "mongoose";

import Courier from "../models/Courier.js";
import { AGREEMENT_DIR, TEMPLATE_FILE, agreementView } from "../services/agreement.js";
import sendPushNotification from "../utils/sendPushNotification.js";

const removeUploaded = (files = []) => files.forEach((f) => fs.existsSync(f.path) && fs.unlinkSync(f.path));

const sendPage = (res, courier, index) => {
  const name = path.basename(String((courier?.agreementFiles || [])[index] || ""));
  const file = name && path.join(AGREEMENT_DIR, name);

  if (!file || !fs.existsSync(file)) {
    return res.status(404).json({ message: "Page not found" });
  }

  res.set("Cache-Control", "private, no-store");
  return res.sendFile(file);
};

export const myAgreement = async (req, res) => {
  const courier = await Courier.findById(req.user.id);
  if (!courier) return res.status(404).json({ message: "Courier not found" });
  return res.json(agreementView(courier));
};

export const myAgreementPage = async (req, res) => {
  const courier = await Courier.findById(req.user.id).select("agreementFiles");
  return sendPage(res, courier, Number(req.params.page));
};

export const submitAgreement = async (req, res) => {
  const files = req.files || [];

  try {
    const courier = await Courier.findById(req.user.id);

    if (!courier) {
      removeUploaded(files);
      return res.status(404).json({ message: "Courier not found" });
    }

    if (!["waiting_upload", "needs_correction"].includes(courier.agreementStatus)) {
      removeUploaded(files);
      const message = courier.agreementStatus === "none"
        ? "You can upload the agreement after Hooks approves your documents."
        : "Your agreement is already submitted. It cannot be changed. Hooks will tell you if a correction is needed.";
      return res.status(409).json({ message });
    }

    if (!files.length) {
      return res.status(400).json({ message: "Add at least one photo or PDF of the signed agreement" });
    }

    const at = new Date();
    courier.agreementFiles = files.map((f) => path.basename(f.path));
    courier.agreementStatus = "submitted";
    courier.agreementSubmittedAt = at;
    courier.agreementNote = "";
    courier.agreementHistory = [...(courier.agreementHistory || []), { status: "submitted", at, by: "courier", files: courier.agreementFiles }];
    await courier.save({ validateModifiedOnly: true });

    return res.json(agreementView(courier));
  } catch (error) {
    removeUploaded(files);
    return res.status(500).json({ message: "Could not save the agreement" });
  }
};

export const agreementTemplate = (req, res) => {
  if (!fs.existsSync(TEMPLATE_FILE)) {
    return res.status(404).json({ message: "Hooks has not added the agreement yet" });
  }
  res.set("Content-Disposition", 'inline; filename="Hooks-Food-Courier-Agreement.pdf"');
  return res.sendFile(TEMPLATE_FILE);
};

export const saveAgreementTemplate = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Choose the agreement PDF" });
  }
  fs.renameSync(req.file.path, TEMPLATE_FILE);
  const stat = fs.statSync(TEMPLATE_FILE);
  return res.json({ template: true, size: stat.size, updated_at: stat.mtime });
};

export const agreementTemplateInfo = (req, res) => {
  if (!fs.existsSync(TEMPLATE_FILE)) return res.json({ template: false });
  const stat = fs.statSync(TEMPLATE_FILE);
  return res.json({ template: true, size: stat.size, updated_at: stat.mtime });
};

export const courierAgreementPage = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Courier not found" });
  const courier = await Courier.findById(req.params.id).select("agreementFiles");
  return sendPage(res, courier, Number(req.params.page));
};

export const decideAgreement = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: "Courier not found" });

  const decision = String(req.body?.decision || "");
  const note = String(req.body?.note || "").slice(0, 300);

  if (!["approve", "correction"].includes(decision)) {
    return res.status(400).json({ message: "decision must be approve or correction" });
  }

  const courier = await Courier.findOne({ _id: req.params.id, deletedAt: null });
  if (!courier) return res.status(404).json({ message: "Courier not found" });

  if (decision === "approve" && courier.agreementStatus !== "submitted") {
    return res.status(409).json({ message: "There is no submitted agreement to approve" });
  }

  if (decision === "correction" && !["submitted", "approved"].includes(courier.agreementStatus)) {
    return res.status(409).json({ message: "There is no agreement to correct" });
  }

  if (decision === "correction" && !note.trim()) {
    return res.status(400).json({ message: "Write what the courier must correct" });
  }

  const at = new Date();
  const status = decision === "approve" ? "approved" : "needs_correction";
  courier.agreementHistory = [...(courier.agreementHistory || []), { status, at, by: "hooks", note, files: courier.agreementFiles }];
  courier.agreementStatus = status;
  courier.agreementReviewedAt = at;
  courier.agreementNote = note;
  if (status === "needs_correction") courier.online = false;
  await courier.save({ validateModifiedOnly: true });

  if (courier.expoPushToken) {
    const title = status === "approved" ? "Agreement approved" : "Agreement needs a correction";
    const body = status === "approved" ? "Your account is active. You can go online and take deliveries." : note;
    await sendPushNotification(courier.expoPushToken, title, body, { type: "agreement" }).catch(() => null);
  }

  return res.json({ id: String(courier._id), ...agreementView(courier), history: courier.agreementHistory });
};
