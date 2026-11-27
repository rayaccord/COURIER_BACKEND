import fs from "fs";
import path from "path";

import multer from "multer";

export const ARRIVAL_DIR = path.resolve("private_arrivals");

if (!fs.existsSync(ARRIVAL_DIR)) {
  fs.mkdirSync(ARRIVAL_DIR, { recursive: true });
}

export const ARRIVAL_KIND = {
  arrived_pickup: "pickup",
  picked_up: "pickup",
  arrived_delivery: "delivery",
  delivered: "delivery",
};

export const ARRIVAL_STEPS = ["arrived_pickup", "arrived_delivery"];

const PHOTO_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
};

export const arrivalUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ARRIVAL_DIR),
    filename: (req, file, cb) => cb(null, `arrival-${Date.now()}-${Math.round(Math.random() * 1e9)}${PHOTO_TYPES[file.mimetype]}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (PHOTO_TYPES[file.mimetype]) return cb(null, true);
    const error = new Error("Upload a photo of the place");
    error.status = 400;
    cb(error);
  },
});

export const reportedPoint = (body = {}) => {
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  const accuracy = Number(body.accuracy);
  return { lat, lng, accuracy: Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 0 };
};

export const isManual = (body = {}) => ["true", "1", "yes"].includes(String(body.manual ?? "").toLowerCase()) || body.manual === true;

export const arrivalNote = (kind, record) => {
  const place = kind === "pickup" ? "pickup" : "customer address";
  const meters = Math.round(record.distance || 0);
  return record.method === "manual"
    ? `Courier confirmed arrival at the ${place} with a photo, GPS showed ${meters} m from the map pin`
    : `Arrived at the ${place} by GPS, ${meters} m from the map pin`;
};

export const arrivalsView = (order) =>
  Object.fromEntries(
    ["pickup", "delivery"]
      .filter((kind) => order?.arrivals?.[kind]?.at)
      .map((kind) => {
        const a = order.arrivals[kind];
        return [kind, { method: a.method, lat: a.lat, lng: a.lng, accuracy: a.accuracy, distance: Math.round(a.distance || 0), at: a.at.toISOString(), has_photo: Boolean(a.photoFile) }];
      })
  );
