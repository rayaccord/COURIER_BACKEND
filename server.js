import dotenv from "dotenv";
import http from "http";

dotenv.config();

const { default: app } = await import("./app.js");
const { default: connectDB } = await import("./config/db.js");
const { initSocket } = await import("./sockets/socketServer.js");
const { runStartup } = await import("./services/startup.js");
const { startOutboxWorker } = await import("./services/deliveryEvents.js");
const { startDispatchWorker } = await import("./services/dispatch.js");

await import("./config/firebaseAdmin.js");

await connectDB();

await runStartup();

const server = http.createServer(app);

initSocket(server);

startOutboxWorker();

startDispatchWorker();

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
