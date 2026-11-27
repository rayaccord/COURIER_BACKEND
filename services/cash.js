import fs from "fs";
import path from "path";

import multer from "multer";

export const CASH_DIR = path.resolve("private_cash");

if (!fs.existsSync(CASH_DIR)) {
  fs.mkdirSync(CASH_DIR, { recursive: true });
}

export const cashRequired = () => String(process.env.CASH_PROOF_REQUIRED || "").toLowerCase() === "true";

export const isCashOrder = (order) => String(order?.metadata?.payment_method || "").toLowerCase() === "pay_on_delivery";

export const CASH_STATUSES = ["picked_up", "in_transit", "arrived_delivery"];

const PHOTO_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

export const cashUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, CASH_DIR),
    filename: (req, file, cb) => cb(null, `cash-${Date.now()}-${Math.round(Math.random() * 1e9)}${PHOTO_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (PHOTO_TYPES[file.mimetype]) return cb(null, true);
    const error = new Error("Upload a photo of the cash or the receipt");
    error.status = 400;
    cb(error);
  },
});

export const cashView = (order) =>
  order?.cash?.collectedAt
    ? {
        amount: order.cash.amount,
        collected_at: order.cash.collectedAt.toISOString(),
        has_proof: Boolean(order.cash.proofFile),
      }
    : null;
