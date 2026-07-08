import SurgeZone from "../models/SurgeZone.js";

/* ================= GET ALL ACTIVE SURGE ZONES ================= */
export const getSurgeZones = async (req, res) => {
  try {
    const zones = await SurgeZone.find({
      active: true,
    });

    res.json(zones);

  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Failed to load surge zones",
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