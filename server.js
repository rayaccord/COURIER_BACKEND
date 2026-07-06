import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

import app from "./app.js";
import connectDB from "./config/db.js";

import "./config/firebaseAdmin.js";

dotenv.config();

connectDB();

const server = http.createServer(app);

export const io = new Server(
  server,
  {
    cors: {
      origin: "*",
      methods: [
        "GET",
        "POST",
        "PUT",
        "DELETE",
      ],
    },
  }
);

export const connectedCouriers =
  new Map();

io.on(
  "connection",
  (socket) => {

    console.log(
      "Courier Connected:",
      socket.id
    );

    socket.on(
  "register-courier",
  (courierId) => {

    console.log(
      "REGISTER EVENT RECEIVED:",
      courierId
    );

    connectedCouriers.set(
      courierId,
      socket.id
    );

    console.log(
      "Registered Courier:",
      courierId
    );

    console.log(
      "Connected Couriers Map:",
      [...connectedCouriers.entries()]
    );
  }
);

    socket.on(
      "disconnect",
      () => {

        for (const [
          courierId,
          socketId,
        ] of connectedCouriers.entries()) {

          if (
            socketId === socket.id
          ) {

            connectedCouriers.delete(
              courierId
            );

            break;
          }
        }

        console.log(
          "Courier Disconnected:",
          socket.id
        );
      }
    );
  }
);


const PORT =
  process.env.PORT || 5000;

server.listen(
  PORT,
  () => {
    console.log(
      `Server running on port ${PORT}`
    );
  }
);
