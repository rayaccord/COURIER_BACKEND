import express from "express";

import {
  registerCourier,
  verifyCourier,
  resendVerificationCode,
  loginCourier,
  forgotPassword,
  verifyResetCode,
  resetPassword,
} from "../controllers/authController.js";

const router = express.Router();

/* REGISTER */
router.post("/register", registerCourier);

/* VERIFY ACCOUNT */
router.post("/verify", verifyCourier);

router.post(
  "/resend-verification",
  resendVerificationCode
);

/* LOGIN */
router.post("/login", loginCourier);

/* FORGOT PASSWORD */
router.post(
  "/forgot-password",
  forgotPassword
);

/* VERIFY RESET CODE */
router.post(
  "/verify-reset-code",
  verifyResetCode
);

/* RESET PASSWORD */
router.post(
  "/reset-password",
  resetPassword
);

export default router;