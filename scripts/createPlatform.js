import crypto from "crypto";
import dotenv from "dotenv";
import mongoose from "mongoose";

import Platform from "../models/Platform.js";
import { hashApiKey } from "../middleware/platformAuth.js";

dotenv.config();

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((arg) => arg.replace(/^--/, "").split("="))
    .map(([key, ...rest]) => [key, rest.join("=")])
);

if (!args.slug || !args.name) {
  console.log(
    "Usage: node scripts/createPlatform.js --slug=shopname --name=\"Shop Name\" --webhook=https://example.com/courier/events [--dispatch=manual|auto] [--rotate]"
  );
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

const existing = await Platform.findOne({ slug: args.slug.toLowerCase() });

const apiKey = crypto.randomBytes(32).toString("hex");

const webhookSecret = crypto.randomBytes(32).toString("hex");

if (existing && !("rotate" in args)) {
  console.log(`Platform "${existing.slug}" already exists. Add --rotate to issue a new key and secret.`);
  await mongoose.disconnect();
  process.exit(1);
}

await Platform.findOneAndUpdate(
  { slug: args.slug.toLowerCase() },
  {
    $set: {
      name: args.name,
      apiKeyHash: hashApiKey(apiKey),
      webhookUrl: args.webhook || existing?.webhookUrl || "",
      webhookSecret,
      dispatchMode: args.dispatch === "auto" ? "auto" : "manual",
      active: true,
    },
  },
  { upsert: true, returnDocument: "after" }
);

console.log("Save these now, they are not shown again.");
console.log(`API key:        ${apiKey}`);
console.log(`Webhook secret: ${webhookSecret}`);

await mongoose.disconnect();
