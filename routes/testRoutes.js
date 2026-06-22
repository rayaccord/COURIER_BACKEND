import express from "express";
import Courier from "../models/Courier.js";

const router = express.Router();

router.get("/test-courier", async (req, res) => {
  try {
    const couriers = await Courier.find();

    res.json(couriers);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

export default router;