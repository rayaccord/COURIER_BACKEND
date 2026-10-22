import crypto from "crypto";
import bcrypt from "bcryptjs";
import Courier from "../models/Courier.js";
import generateToken from "../utils/generateToken.js";

const REQUIRED = [
  "fullName",
  "phone",
  "city",
  "homeAddress",
  "vehicle",
  "vehicleRegistration",
  "governmentIdType",
];

const PHOTOS = ["governmentIdFront", "governmentIdBack", "vehiclePhoto"];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const findByEmail = (email) =>
  Courier.findOne({ email: new RegExp(`^${escapeRegex(email)}$`, "i") });

const googleUser = async (accessToken) => {
  const base = (process.env.HOOKS_AUTH_URL || "").replace(/\/+$/, "");

  if (!base || !accessToken) {
    return null;
  }

  const response = await fetch(`${base}/auth/v1/user`, {
    headers: {
      apikey: process.env.HOOKS_AUTH_KEY || "",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const user = await response.json();

  const providers = [
    user?.app_metadata?.provider,
    ...(user?.app_metadata?.providers || []),
  ];

  if (!user?.email || !user?.email_confirmed_at || !providers.includes("google")) {
    return null;
  }

  return {
    email: user.email.trim().toLowerCase(),
    fullName: user.user_metadata?.full_name || user.user_metadata?.name || "",
  };
};

const signedIn = (courier) => ({
  message: "Login successful",
  token: generateToken(courier._id),
  courier: {
    id: courier._id,
    fullName: courier.fullName,
    email: courier.email,
    phone: courier.phone,
    city: courier.city,
    homeAddress: courier.homeAddress,
    vehicle: courier.vehicle,
    vehicleRegistration: courier.vehicleRegistration,
    governmentIdType: courier.governmentIdType,
    governmentIdFront: courier.governmentIdFront,
    governmentIdBack: courier.governmentIdBack,
    vehiclePhoto: courier.vehiclePhoto,
    approval: courier.approval,
  },
});

export const googleLogin = async (req, res) => {
  try {
    const accessToken = req.body?.access_token;

    if (!accessToken) {
      return res.status(400).json({ message: "Google sign in did not finish" });
    }

    const user = await googleUser(accessToken);

    if (!user) {
      return res.status(401).json({ message: "Google sign in could not be confirmed" });
    }

    const courier = await findByEmail(user.email);

    if (!courier) {
      return res.status(200).json({
        needsProfile: true,
        email: user.email,
        fullName: user.fullName,
      });
    }

    courier.online = false;

    if (!courier.isVerified) {
      courier.isVerified = true;
    }

    await courier.save();

    return res.status(200).json(signedIn(courier));
  } catch (error) {
    console.error("GOOGLE LOGIN ERROR:", error);

    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export const googleComplete = async (req, res) => {
  try {
    const user = await googleUser(req.body?.access_token);

    if (!user) {
      return res.status(401).json({ message: "Google sign in could not be confirmed" });
    }

    const details = Object.fromEntries(
      REQUIRED.map((key) => [key, String(req.body?.[key] || "").trim()])
    );

    const photos = Object.fromEntries(
      PHOTOS.map((key) => [key, req.files?.[key]?.[0]?.filename || ""])
    );

    if (REQUIRED.some((key) => !details[key]) || PHOTOS.some((key) => !photos[key])) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (await findByEmail(user.email)) {
      return res.status(409).json({ message: "Courier already exists" });
    }

    const password = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

    const courier = await Courier.create({
      ...details,
      ...photos,
      email: user.email,
      password,
      isVerified: true,
    });

    return res.status(201).json(signedIn(courier));
  } catch (error) {
    console.error("GOOGLE SIGN UP ERROR:", error);

    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};
