import fs from "fs";
import path from "path";

import multer from "multer";

import sendPushNotification from "../utils/sendPushNotification.js";

export const AGREEMENT_DIR = path.resolve("private_agreements");

if (!fs.existsSync(AGREEMENT_DIR)) {
  fs.mkdirSync(AGREEMENT_DIR, { recursive: true });
}

export const TEMPLATE_FILE = path.join(AGREEMENT_DIR, "hooks-courier-agreement.pdf");

export const agreementRequired = () => String(process.env.AGREEMENT_REQUIRED || "").toLowerCase() === "true";

export const agreementDone = (courier) => !agreementRequired() || courier.agreementStatus === "approved";

export const AGREEMENT_MESSAGES = {
  none: "Please wait for Hooks to approve your documents.",
  waiting_upload: "Your documents are approved. Please sign the Hooks Food Courier Agreement in the app and upload it to start taking deliveries.",
  submitted: "Your signed agreement is waiting for Hooks to approve it.",
  needs_correction: "Hooks asked you to correct your agreement. Please upload it again.",
};

const PAGE_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "application/pdf": ".pdf",
};

export const pageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, AGREEMENT_DIR),
    filename: (req, file, cb) => cb(null, `signed-${Date.now()}-${Math.round(Math.random() * 1e9)}${PAGE_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (PAGE_TYPES[file.mimetype]) return cb(null, true);
    const error = new Error("Upload photos of the signed pages or a PDF");
    error.status = 400;
    cb(error);
  },
});

export const templateUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, AGREEMENT_DIR),
    filename: (req, file, cb) => cb(null, `template-upload-${Date.now()}.pdf`),
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") return cb(null, true);
    const error = new Error("The agreement must be a PDF");
    error.status = 400;
    cb(error);
  },
});

export const agreementView = (courier) => ({
  status: courier.agreementStatus || "none",
  required: agreementRequired(),
  pages: (courier.agreementFiles || []).length,
  submitted_at: courier.agreementSubmittedAt || null,
  reviewed_at: courier.agreementReviewedAt || null,
  note: courier.agreementNote || "",
  template: fs.existsSync(TEMPLATE_FILE),
  can_upload: ["waiting_upload", "needs_correction"].includes(courier.agreementStatus),
});

export const askForAgreement = async (courier) => {
  if (!["none", undefined, null].includes(courier.agreementStatus)) return false;

  courier.agreementStatus = "waiting_upload";
  courier.agreementHistory = [...(courier.agreementHistory || []), { status: "waiting_upload", at: new Date(), by: "hooks", note: "Documents approved" }];

  if (courier.expoPushToken) {
    await sendPushNotification(courier.expoPushToken, "Documents approved", "Please sign the Hooks Food Courier Agreement in the app to start taking deliveries.", { type: "agreement" }).catch(() => null);
  }

  return true;
};
