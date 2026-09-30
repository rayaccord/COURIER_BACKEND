import jwt from "jsonwebtoken";
import { Server } from "socket.io";

import corsOrigins from "../config/cors.js";

let io = null;

const connections = new Map();

const courierRoom = (courierId) =>
  `courier:${courierId}`;

const tokenFrom = (socket) => {
  const auth =
    socket.handshake.auth || {};

  if (auth.token) {
    return String(auth.token);
  }

  const header =
    socket.handshake.headers?.authorization || "";

  if (header.startsWith("Bearer ")) {
    return header.slice(7);
  }

  return "";
};

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: corsOrigins,
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
  });

  io.use((socket, next) => {
    try {
      const decoded = jwt.verify(
        tokenFrom(socket),
        process.env.JWT_SECRET
      );

      socket.data.courierId =
        String(decoded.id);

      next();
    } catch {
      next(new Error("Not authorized"));
    }
  });

  io.on("connection", (socket) => {
    const courierId =
      socket.data.courierId;

    socket.join(courierRoom(courierId));

    connections.set(
      courierId,
      (connections.get(courierId) || 0) + 1
    );

    socket.on("register-courier", () => {
      socket.join(courierRoom(courierId));
    });

    socket.on("disconnect", () => {
      const left =
        (connections.get(courierId) || 1) - 1;

      if (left > 0) {
        connections.set(courierId, left);
      } else {
        connections.delete(courierId);
      }
    });
  });

  return io;
};

export const isCourierConnected = (courierId) =>
  connections.has(String(courierId));

export const emitToCourier = (
  courierId,
  event,
  payload
) => {
  if (!io || !courierId) {
    return;
  }

  io.to(courierRoom(String(courierId))).emit(
    event,
    payload
  );
};
