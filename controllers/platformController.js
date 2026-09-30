import mongoose from "mongoose";

import Assignment from "../models/Assignment.js";
import Courier from "../models/Courier.js";
import DeliveryEvent from "../models/DeliveryEvent.js";
import Order from "../models/Order.js";
import {
  recordEvent,
  serializeDelivery,
} from "../services/deliveryEvents.js";
import {
  assignCourier,
  autoDispatch,
  cancelDelivery,
  courierWorkload,
  describeCourier,
  DispatchError,
  findNearbyCouriers,
  radiusFor,
  trackingView,
} from "../services/dispatch.js";
import { isCoordinate } from "../services/geo.js";
import { emitToCourier } from "../sockets/socketServer.js";

const SOURCE_TYPES = ["restaurant", "pharmacy", "store", "other"];

const EDITABLE_STATUSES = [
  "pending",
  "assigned",
  "accepted",
  "en_route_to_pickup",
  "arrived_pickup",
];

const text = (value, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
};

const cleanItems = (items) =>
  Array.isArray(items)
    ? items
        .slice(0, 100)
        .map((item) => ({
          name: text(item?.name, 200),
          quantity: Math.max(1, Math.floor(numberOrNull(item?.quantity) || 1)),
          note: text(item?.note, 300),
        }))
        .filter((item) => item.name)
    : [];

const fail = (res, error) => {
  if (error instanceof DispatchError) {
    return res.status(error.status).json({ message: error.message });
  }

  console.error("Platform API error:", error);

  return res.status(500).json({ message: "Server Error" });
};

const validatePoint = (point, label) => {
  const lat = numberOrNull(point?.lat ?? point?.latitude);

  const lng = numberOrNull(point?.lng ?? point?.longitude);

  if (!isCoordinate(lat, lng)) {
    throw new DispatchError(400, `Valid ${label} lat and lng are required`);
  }

  return { lat, lng };
};

const loadDelivery = async (req) => {
  const { id } = req.params;

  const query = mongoose.isValidObjectId(id)
    ? { _id: id, platform: req.platform._id }
    : { externalOrderId: id, platform: req.platform._id };

  let order = await Order.findOne(query);

  if (!order && mongoose.isValidObjectId(id)) {
    order = await Order.findOne({
      externalOrderId: id,
      platform: req.platform._id,
    });
  }

  if (!order) {
    throw new DispatchError(404, "Delivery not found");
  }

  return order;
};

const withRelations = async (order) => {
  const [courier, assignment] = await Promise.all([
    order.courier ? Courier.findById(order.courier) : null,
    order.currentAssignment
      ? Assignment.findById(order.currentAssignment)
      : null,
  ]);

  return serializeDelivery(order, { courier, assignment });
};

export const buildDelivery = (platform, body) => {
  const externalOrderId = text(body.external_order_id, 200);

  if (!externalOrderId) {
    throw new DispatchError(400, "external_order_id is required");
  }

  const pickup = body.pickup || {};

  const dropoff = body.dropoff || {};

  const pickupPoint = validatePoint(pickup, "pickup");

  const dropoffPoint = validatePoint(dropoff, "dropoff");

  const pickupAddress = text(pickup.address);

  const dropoffAddress = text(dropoff.address);

  if (!pickupAddress || !dropoffAddress) {
    throw new DispatchError(400, "pickup and dropoff addresses are required");
  }

  const fee = numberOrNull(body.fee?.amount ?? body.fee) ?? 0;

  if (fee < 0) {
    throw new DispatchError(400, "fee cannot be negative");
  }

  const type = text(pickup.type, 30);

  const dispatch =
    body.dispatch === "auto" || body.dispatch === "manual"
      ? body.dispatch
      : platform.dispatchMode;

  return {
    orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    platform: platform._id,
    externalOrderId,
    externalReference: text(body.external_reference, 100),
    metadata:
      body.metadata && typeof body.metadata === "object"
        ? body.metadata
        : {},
    dispatchMode: dispatch,
    customerName: text(dropoff.name, 200) || "Customer",
    customerPhone: text(dropoff.phone, 50),
    restaurantName: text(pickup.name, 200) || "Pickup",
    pickupPhone: text(pickup.phone, 50),
    pickupExternalId: text(pickup.external_id, 200),
    sourceType: SOURCE_TYPES.includes(type) ? type : "other",
    pickupAddress,
    pickupLocation: {
      type: "Point",
      coordinates: [pickupPoint.lng, pickupPoint.lat],
    },
    dropoffAddress,
    dropoffInstructions: text(dropoff.instructions, 500),
    dropoffLocation: {
      type: "Point",
      coordinates: [dropoffPoint.lng, dropoffPoint.lat],
    },
    fee,
    currency: text(body.currency || body.fee?.currency, 5) || "NGN",
    items: cleanItems(body.items),
    itemsCount: Math.max(
      0,
      Math.floor(numberOrNull(body.items_count) || 0),
      cleanItems(body.items).reduce((sum, item) => sum + item.quantity, 0)
    ),
    status: "pending",
    statusChangedAt: new Date(),
  };
};

export const createPlatformDelivery = async (platform, body) => {
  const values = buildDelivery(platform, body);

  const existing = await Order.findOne({
    platform: platform._id,
    externalOrderId: values.externalOrderId,
  });

  if (existing) {
    return { order: existing, created: false };
  }

  let order;

  try {
    order = await Order.create(values);
  } catch (error) {
    if (error.code === 11000) {
      const raced = await Order.findOne({
        platform: platform._id,
        externalOrderId: values.externalOrderId,
      });

      if (raced) {
        return { order: raced, created: false };
      }
    }

    throw error;
  }

  await recordEvent({
    order,
    event: "delivery.created",
    actor: "platform",
  });

  if (order.dispatchMode === "auto") {
    await autoDispatch({ order, platform });
  }

  return { order, created: true };
};

export const createDelivery = async (req, res) => {
  try {
    const { order, created } = await createPlatformDelivery(
      req.platform,
      req.body || {}
    );

    return res.status(created ? 201 : 200).json({
      message: created ? "Delivery created" : "Delivery already exists",
      delivery: await withRelations(order),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const getDelivery = async (req, res) => {
  try {
    const order = await loadDelivery(req);

    return res.json({ delivery: await withRelations(order) });
  } catch (error) {
    return fail(res, error);
  }
};

export const updateDelivery = async (req, res) => {
  try {
    const order = await loadDelivery(req);

    if (!EDITABLE_STATUSES.includes(order.status)) {
      throw new DispatchError(
        409,
        "The delivery can only be changed before pickup"
      );
    }

    const body = req.body || {};

    const set = {};

    const dropoff = body.dropoff || {};

    const pickup = body.pickup || {};

    if (dropoff.name !== undefined) set.customerName = text(dropoff.name, 200) || order.customerName;
    if (dropoff.phone !== undefined) set.customerPhone = text(dropoff.phone, 50);
    if (dropoff.address !== undefined) set.dropoffAddress = text(dropoff.address) || order.dropoffAddress;
    if (dropoff.instructions !== undefined) set.dropoffInstructions = text(dropoff.instructions, 500);

    if (dropoff.lat !== undefined || dropoff.lng !== undefined) {
      const point = validatePoint(dropoff, "dropoff");

      set.dropoffLocation = {
        type: "Point",
        coordinates: [point.lng, point.lat],
      };
    }

    if (pickup.phone !== undefined) set.pickupPhone = text(pickup.phone, 50);

    if (["pending", "assigned"].includes(order.status)) {
      if (pickup.name !== undefined) set.restaurantName = text(pickup.name, 200) || order.restaurantName;
      if (pickup.address !== undefined) set.pickupAddress = text(pickup.address) || order.pickupAddress;

      if (pickup.lat !== undefined || pickup.lng !== undefined) {
        const point = validatePoint(pickup, "pickup");

        set.pickupLocation = {
          type: "Point",
          coordinates: [point.lng, point.lat],
        };
      }
    }

    if (body.fee !== undefined) {
      const fee = numberOrNull(body.fee?.amount ?? body.fee);

      if (fee === null || fee < 0) {
        throw new DispatchError(400, "fee must be a positive number");
      }

      set.fee = fee;
    }

    if (body.external_reference !== undefined) set.externalReference = text(body.external_reference, 100);
    if (Array.isArray(body.items)) set.items = cleanItems(body.items);
    if (body.items_count !== undefined) set.itemsCount = Math.max(0, Math.floor(numberOrNull(body.items_count) || 0));
    if (body.metadata && typeof body.metadata === "object") set.metadata = body.metadata;

    if (Object.keys(set).length === 0) {
      throw new DispatchError(400, "Nothing to update");
    }

    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: { $in: EDITABLE_STATUSES } },
      { $set: set },
      { returnDocument: "after" }
    );

    if (!updated) {
      throw new DispatchError(409, "Delivery changed, please try again");
    }

    const courier = updated.courier
      ? await Courier.findById(updated.courier)
      : null;

    if (updated.courier) {
      emitToCourier(updated.courier, "delivery-updated", updated);
    }

    await recordEvent({
      order: updated,
      event: "delivery.updated",
      courier,
      actor: "platform",
      note: Object.keys(set).join(","),
    });

    return res.json({ delivery: await withRelations(updated) });
  } catch (error) {
    return fail(res, error);
  }
};

export const cancelPlatformDelivery = async (req, res) => {
  try {
    const order = await loadDelivery(req);

    const cancelled = await cancelDelivery({
      order,
      reason: text(req.body?.reason, 300),
      cancelledBy: "platform",
    });

    return res.json({
      message: "Delivery cancelled",
      delivery: await withRelations(cancelled),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const assignDelivery = async (req, res) => {
  try {
    const order = await loadDelivery(req);

    const courierId = text(req.body?.courier_id, 50);

    if (!mongoose.isValidObjectId(courierId)) {
      throw new DispatchError(400, "A valid courier_id is required");
    }

    const result = await assignCourier({
      order,
      courierId,
      platform: req.platform,
    });

    return res.json({
      message: "Delivery offered to courier",
      delivery: serializeDelivery(result.order, {
        assignment: result.assignment,
      }),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const dispatchDelivery = async (req, res) => {
  try {
    const order = await loadDelivery(req);

    if (order.status !== "pending") {
      throw new DispatchError(409, `Delivery is ${order.status}`);
    }

    const notified = await autoDispatch({
      order,
      platform: req.platform,
    });

    return res.json({
      message: notified
        ? `${notified} couriers notified`
        : "No available courier nearby",
      notified,
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const getDeliveryEvents = async (req, res) => {
  try {
    const order = await loadDelivery(req);

    const events = await DeliveryEvent.find({ delivery: order._id })
      .sort({ occurredAt: 1 })
      .populate("courier", "fullName phone")
      .lean();

    return res.json({
      delivery_id: String(order._id),
      external_order_id: order.externalOrderId,
      events: events.map((item) => ({
        event_id: item.eventId,
        event: item.event,
        status: item.status,
        actor: item.actor,
        note: item.note,
        courier: item.courier
          ? {
              id: String(item.courier._id),
              name: item.courier.fullName,
              phone: item.courier.phone,
            }
          : null,
        occurred_at: item.occurredAt.toISOString(),
      })),
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const getDeliveryTracking = async (req, res) => {
  try {
    const order = await loadDelivery(req);

    const courier = order.courier
      ? await Courier.findById(order.courier).select(
          "fullName phone email vehicle vehicleRegistration rating online location"
        )
      : null;

    const assignment = order.currentAssignment
      ? await Assignment.findById(order.currentAssignment)
      : null;

    return res.json({
      ...trackingView(order, courier),
      assigned_at: assignment?.offeredAt?.toISOString() || null,
      accepted_at:
        assignment?.status === "accepted" || assignment?.status === "completed"
          ? assignment.respondedAt?.toISOString() || null
          : null,
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const getNearbyCouriers = async (req, res) => {
  try {
    const lat = numberOrNull(req.query.lat);

    const lng = numberOrNull(req.query.lng);

    if (!isCoordinate(lat, lng)) {
      throw new DispatchError(400, "Valid lat and lng are required");
    }

    const dropoffLat = numberOrNull(req.query.dropoff_lat);

    const dropoffLng = numberOrNull(req.query.dropoff_lng);

    const radiusKm = radiusFor(req.platform, req.query.radius_km);

    const couriers = await findNearbyCouriers({
      lat,
      lng,
      radiusKm,
      limit: Math.min(Math.max(Number(req.query.limit) || 20, 1), 50),
      includeBusy: req.query.include_busy === "true",
      dropoff: isCoordinate(dropoffLat, dropoffLng)
        ? { lat: dropoffLat, lng: dropoffLng }
        : null,
      platformId: req.platform._id,
    });

    return res.json({
      radius_km: radiusKm,
      count: couriers.length,
      couriers,
    });
  } catch (error) {
    return fail(res, error);
  }
};

export const listCouriers = async (req, res) => {
  try {
    const filter = {};

    const search = text(req.query.search, 100);

    if (search) {
      const pattern = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );

      filter.$or = [
        { fullName: pattern },
        { phone: pattern },
        { email: pattern },
      ];
    }

    const couriers = await Courier.find(filter)
      .select("fullName phone email vehicle vehicleRegistration rating online location createdAt")
      .sort({ online: -1, fullName: 1 })
      .limit(500);

    const workload = await courierWorkload(
      couriers.map((courier) => courier._id)
    );

    let rows = couriers.map((courier) =>
      describeCourier({
        courier,
        work: workload.get(String(courier._id)),
        platformId: req.platform._id,
      })
    );

    const status = text(req.query.status, 20);

    if (status && status !== "all") {
      rows = rows.filter((row) =>
        status === "online" ? row.online : row.availability === status
      );
    }

    return res.json({ count: rows.length, couriers: rows });
  } catch (error) {
    return fail(res, error);
  }
};

export const getCourier = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new DispatchError(404, "Courier not found");
    }

    const courier = await Courier.findById(req.params.id).select(
      "fullName phone email vehicle vehicleRegistration rating online location completedOrders createdAt"
    );

    if (!courier) {
      throw new DispatchError(404, "Courier not found");
    }

    const workload = await courierWorkload([courier._id]);

    return res.json({
      courier: {
        ...describeCourier({
          courier,
          work: workload.get(String(courier._id)),
          platformId: req.platform._id,
        }),
        completed_deliveries: courier.completedOrders || 0,
      },
    });
  } catch (error) {
    return fail(res, error);
  }
};
