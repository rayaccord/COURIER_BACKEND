import jwt from "jsonwebtoken";

import Courier from "../models/Courier.js";

const authMiddleware = async (
  req,
  res,
  next
) => {
  try {
    const authHeader =
      req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    const token =
      authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const live = await Courier.exists({ _id: decoded.id, deletedAt: null });

    if (!live) {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    req.user = {
      id: decoded.id,
    };

    next();

  } catch (error) {
    res.status(401).json({
      message: "Invalid token",
    });
  }
};

export default authMiddleware;