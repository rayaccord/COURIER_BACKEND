import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import deliveryRoutes from "./routes/deliveryRoutes.js";
import courierRoutes from "./routes/courierRoutes.js";
import surgeRoutes from "./routes/surgeRoutes.js";
import v1Routes from "./routes/v1Routes.js";
import corsOrigins from "./config/cors.js";


const app = express();

app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));

app.use(cors({ origin: corsOrigins }));
app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("Courier Backend API Running...");
});

/* ROUTES */
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
  "/api/deliveries",
  deliveryRoutes
);

app.use(
  "/api/courier",
  courierRoutes
);


app.use(
  "/api/surge",
  surgeRoutes
);

app.use(
  "/api/v1",
  v1Routes
);

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  const tooBig = err.code === "LIMIT_FILE_SIZE";

  return res.status(tooBig ? 413 : err.status || (err.name === "MulterError" ? 400 : 500)).json({
    message: tooBig ? "Each photo must be smaller than 8 MB" : err.status || err.name === "MulterError" ? err.message : "Server Error",
  });
});


export default app;
