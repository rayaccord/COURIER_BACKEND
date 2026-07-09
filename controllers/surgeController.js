import SurgeZone from "../models/SurgeZone.js";
/* ================= SURGE CACHE ================= */

const surgeCache = new Map();

/* ================= GET SURGE ZONES NEAR COURIER ================= */

export const getSurgeZones = async (req, res) => {

  try {

    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (
      Number.isNaN(lat) ||
      Number.isNaN(lng)
    ) {
      return res.status(400).json({
        message: "Latitude and longitude are required",
      });
    }

    const key =
  `${lat.toFixed(2)}-${lng.toFixed(2)}`;

const cached = surgeCache.get(key);

if (
  cached &&
  Date.now() - cached.createdAt <
    15 * 60 * 1000
) {
  return res.json(cached.zones);
}

const multipliers = [
  "1x",
  "2.4x",
  "3x",
];

const zones = Array.from({ length: 3 }).map(() => ({
  lat:
    lat + (Math.random() - 0.5) * 0.02,

  lng:
    lng + (Math.random() - 0.5) * 0.02,

  radius: 400,

  multiplier:
    multipliers[
      Math.floor(
        Math.random() *
          multipliers.length
      )
    ],
}));

surgeCache.set(key, {
  createdAt: Date.now(),
  zones,
});

res.json(zones);


  } catch (error) {

    console.log(error);

    res.status(500).json({
      message: "Failed to generate surge zones",
    });

  }

};

/* ================= CREATE SURGE ZONE ================= */
export const createSurgeZone = async (req, res) => {
  try {
    const {
      name,
      lat,
      lng,
      radius,
      multiplier,
    } = req.body;

    const zone = await SurgeZone.create({
      name,

      location: {
        type: "Point",
        coordinates: [lng, lat],
      },

      radius,
      multiplier,
    });

    res.status(201).json(zone);

  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Failed to create surge zone",
    });
  }
};
