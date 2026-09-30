import mongoose from "mongoose";

import Order from "../models/Order.js";
import Platform from "../models/Platform.js";
import { hashApiKey } from "../middleware/platformAuth.js";
import { LEGACY_STATUS } from "./dispatch.js";

const SOURCE_TYPES = [
  "restaurant",
  "pharmacy",
  "store",
  "other",
];

const LEGACY_ORDER_INDEXES = [
  "hooksOrderId_1",
  "hooksUserId_1",
  "hooksRestaurantId_1",
  "hooksPharmacyId_1",
  "hooksStoreId_1",
  "hooksEntityType_1",
  "hooksEntityId_1",
];

export const bootstrapPlatform = async () => {
  const apiKey = process.env.COURIER_API_KEY;

  if (!apiKey) {
    return null;
  }

  const slug = (
    process.env.PLATFORM_SLUG || "default"
  ).toLowerCase();

  const values = {
    name: process.env.PLATFORM_NAME || slug,
    apiKeyHash: hashApiKey(apiKey),
    webhookUrl: process.env.PLATFORM_WEBHOOK_URL || "",
    webhookSecret: process.env.PLATFORM_WEBHOOK_SECRET || "",
    dispatchMode:
      process.env.PLATFORM_DISPATCH_MODE === "auto"
        ? "auto"
        : "manual",
  };

  return Platform.findOneAndUpdate(
    { slug },
    { $set: values, $setOnInsert: { slug } },
    { upsert: true, returnDocument: "after" }
  );
};

const dropLegacyIndexes = async () => {
  const collection = mongoose.connection.collection("orders");

  const existing = await collection.indexes().catch(() => []);

  for (const index of existing) {
    if (LEGACY_ORDER_INDEXES.includes(index.name)) {
      await collection.dropIndex(index.name);
    }
  }
};

const renameLegacyStatuses = async () => {
  const collection = mongoose.connection.collection("orders");

  for (const [from, to] of Object.entries(LEGACY_STATUS)) {
    await collection.updateMany(
      { status: from },
      { $set: { status: to } }
    );
  }
};

const adoptLegacyDeliveries = async (platform) => {
  if (!platform) {
    return;
  }

  const collection = mongoose.connection.collection("orders");

  const cursor = collection.find({
    platform: { $exists: false },
    hooksOrderId: { $type: "string", $ne: "" },
  });

  for await (const doc of cursor) {
    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          platform: platform._id,
          externalOrderId: doc.hooksOrderId,
          pickupExternalId: doc.hooksEntityId || "",
          sourceType: SOURCE_TYPES.includes(doc.hooksEntityType)
            ? doc.hooksEntityType
            : doc.sourceType || "other",
          dispatchMode: "auto",
          metadata: {
            user_id: doc.hooksUserId || "",
            restaurant_id: doc.hooksRestaurantId || "",
            pharmacy_id: doc.hooksPharmacyId || "",
            store_id: doc.hooksStoreId || "",
          },
        },
      }
    );
  }
};

export const runStartup = async () => {
  const platform = await bootstrapPlatform();

  await dropLegacyIndexes();

  await renameLegacyStatuses();

  await adoptLegacyDeliveries(platform);

  await Order.createIndexes().catch((error) =>
    console.error("Order index creation failed:", error.message)
  );
};
