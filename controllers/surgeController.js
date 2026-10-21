import SurgeZone from "../models/SurgeZone.js";

/* ================= GET SURGE ZONES NEAR COURIER ================= */
export const getSurgeZones = async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({
        message: "Latitude and longitude are required",
      });
    }

    res.json([]);

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