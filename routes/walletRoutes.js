import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";

import {
  getWallet,
  updateBankAccount,
  withdrawFunds,
} from "../controllers/walletController.js";

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  getWallet
);

router.put(
  "/bank-account",
  authMiddleware,
  updateBankAccount
);

router.post(
  "/withdraw",
  authMiddleware,
  withdrawFunds
);



export default router;
