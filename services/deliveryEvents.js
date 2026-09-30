import crypto from "crypto";

import settings from "../config/settings.js";
import DeliveryEvent from "../models/DeliveryEvent.js";
import Platform from "../models/Platform.js";
import WebhookOutbox from "../models/WebhookOutbox.js";
import { pointOf } from "./geo.js";

const platformCache = new Map();

const PLATFORM_CACHE_MS = 30000;

const loadPlatform = async (platformId) => {
  if (!platformId) {
    return null;
  }

  const key = String(platformId);

  const cached = platformCache.get(key);

  if (cached && cached.expires > Date.now()) {
    return cached.platform;
  }

  const platform =
    await Platform.findById(platformId).lean();

  platformCache.set(key, {
    platform,
    expires: Date.now() + PLATFORM_CACHE_MS,
  });

  return platform;
};

export const forgetPlatform = (platformId) => {
  platformCache.delete(String(platformId));
};

const iso = (value) =>
  value ? new Date(value).toISOString() : null;

export const serializeCourier = (courier) => {
  if (!courier) {
    return null;
  }

  const point = pointOf(courier.location);

  return {
    id: String(courier._id),
    name: courier.fullName || "",
    phone: courier.phone || "",
    email: courier.email || "",
    vehicle: courier.vehicle || "",
    vehicle_registration:
      courier.vehicleRegistration || "",
    rating: courier.rating ?? null,
    online: Boolean(courier.online),
    location: point
      ? {
          lat: point.lat,
          lng: point.lng,
          recorded_at: iso(
            courier.location?.lastUpdated
          ),
        }
      : null,
  };
};

export const serializeAssignment = (assignment) =>
  assignment
    ? {
        id: String(assignment._id),
        status: assignment.status,
        courier_id: String(assignment.courier),
        source: assignment.source,
        offered_at: iso(assignment.offeredAt),
        expires_at: iso(assignment.expiresAt),
        responded_at: iso(assignment.respondedAt),
        reason: assignment.reason || "",
      }
    : null;

export const serializeDelivery = (
  order,
  { courier = null, assignment = null } = {}
) => {
  const pickup = pointOf(order.pickupLocation);

  const dropoff = pointOf(order.dropoffLocation);

  const courierLocation =
    order.courierLocation?.recordedAt
      ? {
          lat: order.courierLocation.lat,
          lng: order.courierLocation.lng,
          recorded_at: iso(
            order.courierLocation.recordedAt
          ),
        }
      : null;

  return {
    delivery_id: String(order._id),
    order_number: order.orderNumber,
    external_order_id: order.externalOrderId || null,
    external_reference: order.externalReference || "",
    status: order.status,
    dispatch_mode: order.dispatchMode,
    pickup: {
      name: order.restaurantName || "",
      type: order.sourceType || "",
      external_id: order.pickupExternalId || "",
      phone: order.pickupPhone || "",
      address: order.pickupAddress || "",
      lat: pickup?.lat ?? null,
      lng: pickup?.lng ?? null,
    },
    dropoff: {
      name: order.customerName || "",
      phone: order.customerPhone || "",
      address: order.dropoffAddress || "",
      instructions: order.dropoffInstructions || "",
      lat: dropoff?.lat ?? null,
      lng: dropoff?.lng ?? null,
    },
    fee: order.fee ?? 0,
    currency: order.currency || "NGN",
    items_count: order.itemsCount || 0,
    items: (order.items || []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      note: item.note || "",
    })),
    metadata: order.metadata || {},
    courier_id: order.courier ? String(order.courier._id || order.courier) : null,
    courier: serializeCourier(courier),
    courier_location: courierLocation,
    assignment: serializeAssignment(assignment),
    cancel_reason: order.cancelReason || "",
    cancelled_by: order.cancelledBy || "",
    created_at: iso(order.createdAt),
    updated_at: iso(order.updatedAt),
    status_changed_at: iso(order.statusChangedAt),
  };
};

let running = false;

let rerun = false;

let scheduled = false;

export const kickOutbox = () => {
  if (scheduled) {
    return;
  }

  scheduled = true;

  setImmediate(() => {
    scheduled = false;
    processOutbox().catch((error) =>
      console.error("Webhook worker error:", error.message)
    );
  });
};

export const recordEvent = async ({
  order,
  event,
  courier = null,
  assignment = null,
  actor = "system",
  note = "",
  location = null,
  persist = true,
  notify = true,
}) => {
  const eventId = `evt_${crypto.randomUUID()}`;

  const occurredAt = new Date();

  if (persist) {
    await DeliveryEvent.create({
      eventId,
      delivery: order._id,
      platform: order.platform || null,
      event,
      status: order.status,
      courier: courier?._id || order.courier || null,
      assignment: assignment?._id || null,
      location: location || {},
      actor,
      note,
      occurredAt,
    });
  }

  if (!notify || !order.platform) {
    return eventId;
  }

  const platform = await loadPlatform(order.platform);

  if (!platform?.webhookUrl || !platform.active) {
    return eventId;
  }

  const isLocation = event === "courier.location";

  const payload = {
    event_id: eventId,
    event,
    occurred_at: occurredAt.toISOString(),
    delivery_id: String(order._id),
    order_number: order.orderNumber,
    external_order_id: order.externalOrderId || null,
    external_reference: order.externalReference || "",
    status: order.status,
    fee: order.fee ?? 0,
    assignment: serializeAssignment(assignment),
    courier: serializeCourier(courier),
    location: location
      ? {
          lat: location.lat,
          lng: location.lng,
          recorded_at: occurredAt.toISOString(),
        }
      : null,
    note,
  };

  await WebhookOutbox.create({
    eventId,
    platform: platform._id,
    delivery: order._id,
    event,
    payload,
    ordered: !isLocation,
    maxAttempts: isLocation ? 1 : 0,
  });

  kickOutbox();

  return eventId;
};

const sign = (secret, timestamp, body) =>
  crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

const backoffSeconds = (attempts) =>
  Math.min(5 * 2 ** Math.max(attempts - 1, 0), 1800);

const sendOne = async (item) => {
  const platform = await loadPlatform(item.platform);

  if (!platform?.webhookUrl || !platform.active) {
    return { ok: false, error: "Platform has no active webhook" };
  }

  const body = JSON.stringify(item.payload);

  const timestamp = Math.floor(Date.now() / 1000);

  const headers = {
    "Content-Type": "application/json",
    "X-Courier-Event-Id": item.eventId,
    "X-Courier-Event": item.event,
    "X-Courier-Timestamp": String(timestamp),
  };

  if (platform.webhookSecret) {
    headers["X-Courier-Signature"] =
      `sha256=${sign(platform.webhookSecret, timestamp, body)}`;
  }

  try {
    const response = await fetch(platform.webhookUrl, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(settings.webhookTimeoutMs),
    });

    if (response.ok) {
      return { ok: true };
    }

    const text = await response.text().catch(() => "");

    return {
      ok: false,
      error: `HTTP ${response.status} ${text.slice(0, 300)}`,
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

const claimNext = (skipped) => {
  const now = new Date();

  return WebhookOutbox.findOneAndUpdate(
    {
      _id: { $nin: skipped },
      status: "pending",
      nextAttemptAt: { $lte: now },
      $or: [
        { lockedUntil: null },
        { lockedUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        lockedUntil: new Date(now.getTime() + 60000),
      },
    },
    {
      sort: { createdAt: 1 },
      returnDocument: "after",
    }
  );
};

export const processOutbox = async () => {
  if (running) {
    rerun = true;
    return;
  }

  running = true;

  try {
    const skipped = [];

    const blocked = new Set();

    for (let i = 0; i < 200; i += 1) {
      const item = await claimNext(skipped);

      if (!item) {
        break;
      }

      const deliveryKey = String(item.delivery);

      if (item.ordered) {
        const earlier =
          blocked.has(deliveryKey) ||
          (await WebhookOutbox.exists({
            delivery: item.delivery,
            ordered: true,
            status: "pending",
            createdAt: { $lt: item.createdAt },
          }));

        if (earlier) {
          skipped.push(item._id);

          await WebhookOutbox.updateOne(
            { _id: item._id },
            { $set: { lockedUntil: null } }
          );

          continue;
        }
      }

      const result = await sendOne(item);

      if (result.ok) {
        if (item.event !== "courier.location") {
          console.log(
            `Webhook ${item.event} ${item.eventId} for ${deliveryKey} delivered after ${item.attempts + 1} attempt(s)`
          );
        }

        await WebhookOutbox.updateOne(
          { _id: item._id },
          {
            $set: {
              status: "delivered",
              deliveredAt: new Date(),
              lockedUntil: null,
              lastError: "",
            },
            $inc: { attempts: 1 },
          }
        );

        continue;
      }

      const attempts = item.attempts + 1;

      const tooOld =
        Date.now() - item.createdAt.getTime() >
        settings.webhookMaxRetryHours * 3600000;

      const dead =
        tooOld ||
        (item.maxAttempts > 0 && attempts >= item.maxAttempts);

      await WebhookOutbox.updateOne(
        { _id: item._id },
        {
          $set: {
            status: dead ? "dead" : "pending",
            attempts,
            lastError: result.error,
            lockedUntil: null,
            nextAttemptAt: new Date(
              Date.now() + backoffSeconds(attempts) * 1000
            ),
          },
        }
      );

      if (dead) {
        console.error(
          `Webhook ${item.event} ${item.eventId} for ${deliveryKey} gave up after ${attempts} attempt(s): ${result.error}`
        );
      } else {
        console.warn(
          `Webhook ${item.event} for ${deliveryKey} failed, retry ${attempts}: ${result.error}`
        );
      }

      if (item.ordered) {
        blocked.add(deliveryKey);
        skipped.push(item._id);
      }
    }
  } finally {
    running = false;

    if (rerun) {
      rerun = false;
      kickOutbox();
    }
  }
};

export const startOutboxWorker = () =>
  setInterval(() => {
    processOutbox().catch((error) =>
      console.error("Webhook worker error:", error.message)
    );
  }, settings.workerIntervalMs);
