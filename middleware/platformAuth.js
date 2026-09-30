import crypto from "crypto";

import Platform from "../models/Platform.js";

export const hashApiKey = (key) =>
  crypto
    .createHash("sha256")
    .update(String(key))
    .digest("hex");

const platformAuth = async (
  req,
  res,
  next
) => {
  const header =
    req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Not authorized",
    });
  }

  const key = header.slice(7).trim();

  if (!key) {
    return res.status(401).json({
      message: "Not authorized",
    });
  }

  try {
    const platform = await Platform.findOne({
      apiKeyHash: hashApiKey(key),
      active: true,
    });

    if (!platform) {
      return res.status(401).json({
        message: "Invalid token",
      });
    }

    req.platform = platform;

    next();
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
    });
  }
};

export default platformAuth;
