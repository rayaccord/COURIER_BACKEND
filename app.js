import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import testRoutes from "./routes/testRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import courierRoutes from "./routes/courierRoutes.js";


const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Courier Backend API Running...");
});

/* ROUTES */
app.use("/api", testRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use(
  "/api/wallet",
  walletRoutes
);
app.use(
  "/api/orders",
  orderRoutes
);

app.use(
  "/api/courier",
  courierRoutes
);

export default app;``