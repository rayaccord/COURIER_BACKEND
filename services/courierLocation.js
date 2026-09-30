import settings from "../config/settings.js";
import Courier from "../models/Courier.js";
import Order from "../models/Order.js";
import { recordEvent } from "./deliveryEvents.js";
import { ACTIVE_STATUSES } from "./dispatch.js";
import { isCoordinate } from "./geo.js";

export const saveCourierLocation = async (
  courierId,
  lat,
  lng
) => {
  if (!isCoordinate(lat, lng)) {
    return null;
  }

  const now = new Date();

  const courier = await Courier.findByIdAndUpdate(
    courierId,
    {
      $set: {
        location: {
          type: "Point",
          coordinates: [lng, lat],
          lastUpdated: now,
        },
      },
    },
    { returnDocument: "after" }
  );

  if (!courier) {
    return null;
  }

  const order = await Order.findOneAndUpdate(
    {
      courier: courier._id,
      status: { $in: ACTIVE_STATUSES },
    },
    {
      $set: {
        courierLocation: {
          lat,
          lng,
          recordedAt: now,
        },
      },
    },
    { returnDocument: "after" }
  );

  if (!order) {
    return courier;
  }

  const due = new Date(
    now.getTime() - settings.locationEventSeconds * 1000
  );

  const claimed = await Order.findOneAndUpdate(
    {
      _id: order._id,
      $or: [
        { lastLocationEventAt: null },
        { lastLocationEventAt: { $lte: due } },
      ],
    },
    { $set: { lastLocationEventAt: now } },
    { returnDocument: "after" }
  );

  if (claimed) {
    await recordEvent({
      order: claimed,
      event: "courier.location",
      courier,
      actor: "courier",
      location: { lat, lng },
      persist: false,
    }).catch((error) =>
      console.error("Location event failed:", error.message)
    );
  }

  return courier;
};
