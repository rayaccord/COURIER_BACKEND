import express from "express";
import upload from "../middleware/upload.js";
import rateLimit from "../middleware/rateLimit.js";

import {
  registerCourier,
  verifyCourier,
  resendVerificationCode,
  loginCourier,
  forgotPassword,
  verifyResetCode,
  resetPassword,
} from "../controllers/authController.js";
import { googleComplete, googleLogin } from "../controllers/googleAuthController.js";

const router = express.Router();

const codeLimit = rateLimit({ max: 10, windowMs: 15 * 60 * 1000 });
const emailLimit = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });

/* REGISTER */
router.post(
  "/register",
  emailLimit,
  upload.fields([
    {
      name: "governmentIdFront",
      maxCount: 1,
    },
    {
      name: "governmentIdBack",
      maxCount: 1,
    },
    {
      name: "vehiclePhoto",
      maxCount: 1,
    },
  ]),
  registerCourier
);

router.post("/google", googleLogin);

router.post(
  "/google/complete",
  upload.fields([
    { name: "governmentIdFront", maxCount: 1 },
    { name: "governmentIdBack", maxCount: 1 },
    { name: "vehiclePhoto", maxCount: 1 },
  ]),
  googleComplete
);

/* VERIFY ACCOUNT */
router.post("/verify", codeLimit, verifyCourier);

router.post(
  "/resend-verification",
  emailLimit,
  resendVerificationCode
);

/* LOGIN */
router.post("/login", rateLimit({ max: 20, windowMs: 15 * 60 * 1000 }), loginCourier);

/* FORGOT PASSWORD */
router.post(
  "/forgot-password",
  emailLimit,
  forgotPassword
);

/* VERIFY RESET CODE */
router.post(
  "/verify-reset-code",
  codeLimit,
  verifyResetCode
);

/* RESET PASSWORD */
router.post(
  "/reset-password",
  codeLimit,
  resetPassword
);

export default router;