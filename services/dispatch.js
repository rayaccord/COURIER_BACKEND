import settings from "../config/settings.js";
import Assignment from "../models/Assignment.js";
import Courier from "../models/Courier.js";
import Order from "../models/Order.js";
import {
  emitToCourier,
  isCourierConnected,
} from "../sockets/socketServer.js";
import sendPushNotification from "../utils/sendPushNotification.js";
import {
  recordEvent,
  serializeCourier,
} from "./deliveryEvents.js";
import {
  distanceMeters,
  etaSeconds,
  pointOf,
} from "./geo.js";

export const ACTIVE_STATUSES = [
  "accepted",
  "en_route_to_pickup",
  "arrived_pickup",
  "picked_up",
  "in_transit",
  "arrived_delivery",
];

export const BEFORE_PICKUP = [
  "accepted",
  "en_route_to_pickup",
  "arrived_pickup",
];

export const TERMINAL_STATUSES = [
  "delivered",
  "cancelled",
  "failed",
];

export const LEGACY_STATUS = {
  heading_to_restaurant: "en_route_to_pickup",
  arrived_restaurant: "arrived_pickup",
  on_the_way: "in_transit",
  arrived_customer: "arrived_delivery",
};

export const NEXT_STATUS = {
  accepted: "en_route_to_pickup",
  en_route_to_pickup: "arrived_pickup",
  arrived_pickup: "picked_up",
  picked_up: "in_transit",
  in_transit: "arrived_delivery",
  arrived_delivery: "delivered",
};

export class DispatchError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const timeoutFor = (platform) =>
  platform?.assignmentTimeoutSeconds ||
  settings.assignmentTimeoutSeconds;

export const radiusFor = (platform, requested) => {
  const radius =
    Number(requested) ||
    platform?.defaultRadiusKm ||
    settings.defaultRadiusKm;

  return Math.min(Math.max(radius, 0.1), settings.maxRadiusKm);
};

const staleCutoff = () =>
  new Date(Date.now() - settings.locationStaleSeconds * 1000);

export const isLocationFresh = (courier) =>
  Boolean(
    courier?.location?.lastUpdated &&
      courier.location.lastUpdated >= staleCutoff() &&
      pointOf(courier.location)
  );

export const courierWorkload = async (courierIds) => {
  const ids = courierIds.map(String);

  const [active, offers] = await Promise.all([
    Order.find({
      courier: { $in: ids },
      status: { $in: ACTIVE_STATUSES },
    })
      .select("courier platform externalOrderId orderNumber status")
      .lean(),
    Assignment.find({
      courier: { $in: ids },
      status: "offered",
      expiresAt: { $gt: new Date() },
    })
      .select("courier delivery")
      .lean(),
  ]);

  const workload = new Map();

  for (const order of active) {
    workload.set(String(order.courier), {
      state: "busy",
      order,
    });
  }

  for (const offer of offers) {
    const key = String(offer.courier);

    if (!workload.has(key)) {
      workload.set(key, {
        state: "offered",
        deliveryId: offer.delivery,
      });
    }
  }

  return workload;
};

const activeDeliveryView = (work, platformId) => {
  if (!work) {
    return null;
  }

  if (work.state === "offered") {
    return {
      delivery_id: String(work.deliveryId),
      status: "assigned",
    };
  }

  const samePlatform =
    platformId &&
    String(work.order.platform) === String(platformId);

  return {
    delivery_id: samePlatform ? String(work.order._id) : null,
    external_order_id: samePlatform
      ? work.order.externalOrderId
      : null,
    order_number: samePlatform ? work.order.orderNumber : null,
    status: work.order.status,
  };
};

export const describeCourier = ({
  courier,
  work,
  platformId,
  pickup = null,
  dropoff = null,
}) => {
  const view = serializeCourier(courier);

  const point = pointOf(courier.location);

  const fresh = isLocationFresh(courier);

  const toPickup = distanceMeters(point, pickup);

  const toDropoff = distanceMeters(point, dropoff);

  let availability = "available";

  if (!courier.online) {
    availability = "offline";
  } else if (work?.state === "busy") {
    availability = "busy";
  } else if (work?.state === "offered") {
    availability = "offered";
  } else if (!fresh) {
    availability = "no_gps";
  }

  return {
    ...view,
    availability,
    available: availability === "available",
    location_fresh: fresh,
    last_location_at: view.location?.recorded_at || null,
    distance_to_pickup_m: toPickup,
    distance_to_dropoff_m: toDropoff,
    eta_to_pickup_seconds: etaSeconds(toPickup, courier.vehicle),
    active_delivery: activeDeliveryView(work, platformId),
  };
};

export const findNearbyCouriers = async ({
  lat,
  lng,
  radiusKm,
  limit = 20,
  includeBusy = false,
  dropoff = null,
  platformId = null,
}) => {
  const pickup = { lat, lng };

  const couriers = await Courier.find({
    online: true,
    "location.lastUpdated": { $gte: staleCutoff() },
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [lng, lat],
        },
        $maxDistance: radiusKm * 1000,
      },
    },
  })
    .select("-password -bankAccount -wallet -verificationCode -resetPasswordCode")
    .limit(200);

  const workload = await courierWorkload(
    couriers.map((courier) => courier._id)
  );

  return couriers
    .map((courier) =>
      describeCourier({
        courier,
        work: workload.get(String(courier._id)),
        platformId,
        pickup,
        dropoff,
      })
    )
    .filter((courier) => includeBusy || courier.available)
    .sort(
      (a, b) =>
        (a.distance_to_pickup_m ?? Infinity) -
        (b.distance_to_pickup_m ?? Infinity)
    )
    .slice(0, limit);
};

export const offerView = (order, courier, expiresAt, assignment = null) => {
  const pickup = pointOf(order.pickupLocation);

  const dropoff = pointOf(order.dropoffLocation);

  const courierPoint = pointOf(courier?.location);

  const toPickup = distanceMeters(courierPoint, pickup);

  const trip = distanceMeters(pickup, dropoff);

  return {
    ...order.toObject(),
    offer: {
      assignmentId: assignment ? String(assignment._id) : null,
      expiresAt,
      distanceToPickupM: toPickup,
      tripDistanceM: trip,
      etaToPickupSeconds: etaSeconds(toPickup, courier?.vehicle),
      tripEtaSeconds: etaSeconds(trip, courier?.vehicle),
    },
  };
};

const pushOffer = async (order, courier) => {
  if (!courier.expoPushToken) {
    return;
  }

  await sendPushNotification(
    courier.expoPushToken,
    "New delivery request",
    `${order.restaurantName}\nFee: ₦${order.fee}`,
    {
      orderId: String(order._id),
      screen: "requests",
    }
  );
};

const notifyOffer = async (order, courier, expiresAt, assignment) => {
  emitToCourier(
    courier._id,
    "new-order",
    offerView(order, courier, expiresAt, assignment)
  );

  if (!isCourierConnected(courier._id)) {
    await pushOffer(order, courier).catch(() => null);
  }
};

const withdrawOffer = async (assignment, reason) => {
  const updated = await Assignment.findOneAndUpdate(
    { _id: assignment._id, status: "offered" },
    {
      $set: {
        status: "cancelled",
        respondedAt: new Date(),
        reason,
      },
    },
    { returnDocument: "after" }
  );

  if (updated) {
    emitToCourier(updated.courier, "offer-withdrawn", {
      orderId: String(updated.delivery),
      reason,
    });
  }

  return updated;
};

export const releaseCourier = async ({
  order,
  courierId,
  assignmentStatus,
  reason,
  event,
  actor,
  notifyCourier = false,
}) => {
  const released = await Order.findOneAndUpdate(
    {
      _id: order._id,
      courier: courierId,
      status: { $in: BEFORE_PICKUP },
    },
    {
      $set: {
        status: "pending",
        courier: null,
        currentAssignment: null,
        assignedCouriers: [],
        statusChangedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  if (!released) {
    return null;
  }

  const assignment = order.currentAssignment
    ? await Assignment.findByIdAndUpdate(
        order.currentAssignment,
        {
          $set: {
            status: assignmentStatus,
            respondedAt: new Date(),
            reason,
          },
        },
        { returnDocument: "after" }
      )
    : null;

  const courier = await Courier.findById(courierId);

  if (notifyCourier) {
    emitToCourier(courierId, "order-cancelled", {
      orderId: String(order._id),
      reason,
    });
  }

  await recordEvent({
    order: released,
    event,
    courier,
    assignment,
    actor,
    note: reason,
  });

  return released;
};

export const assignCourier = async ({
  order,
  courierId,
  platform,
}) => {
  const courier = await Courier.findById(courierId);

  if (!courier) {
    throw new DispatchError(404, "Courier not found");
  }

  if (TERMINAL_STATUSES.includes(order.status)) {
    throw new DispatchError(409, `Delivery is already ${order.status}`);
  }

  if (
    ["picked_up", "in_transit", "arrived_delivery"].includes(order.status)
  ) {
    throw new DispatchError(
      409,
      "The order has already been picked up and cannot be reassigned"
    );
  }

  if (
    order.courier &&
    String(order.courier) === String(courier._id)
  ) {
    throw new DispatchError(
      409,
      "This courier is already handling the delivery"
    );
  }

  const openOffer = order.currentAssignment
    ? await Assignment.findOne({
        _id: order.currentAssignment,
        status: "offered",
      })
    : null;

  if (
    openOffer &&
    String(openOffer.courier) === String(courier._id) &&
    openOffer.expiresAt > new Date()
  ) {
    return { order, assignment: openOffer, courier };
  }

  if (!courier.online) {
    throw new DispatchError(409, "Courier is offline");
  }

  const workload = await courierWorkload([courier._id]);

  const work = workload.get(String(courier._id));

  if (work?.state === "busy") {
    throw new DispatchError(409, "Courier is busy with another delivery");
  }

  if (
    work?.state === "offered" &&
    String(work.deliveryId) !== String(order._id)
  ) {
    throw new DispatchError(
      409,
      "Courier is answering another delivery request"
    );
  }

  let current = order;

  if (openOffer) {
    await withdrawOffer(openOffer, "reassigned");
  }

  if (order.courier && BEFORE_PICKUP.includes(order.status)) {
    current = await releaseCourier({
      order,
      courierId: order.courier,
      assignmentStatus: "cancelled",
      reason: "reassigned",
      event: "assignment.cancelled",
      actor: "platform",
      notifyCourier: true,
    });

    if (!current) {
      throw new DispatchError(409, "Delivery changed, please try again");
    }
  }

  const expiresAt = new Date(
    Date.now() + timeoutFor(platform) * 1000
  );

  const assignment = await Assignment.create({
    delivery: order._id,
    platform: order.platform,
    courier: courier._id,
    source: "platform",
    status: "offered",
    expiresAt,
  });

  const offered = await Order.findOneAndUpdate(
    {
      _id: order._id,
      courier: null,
      status: { $in: ["pending", "assigned"] },
    },
    {
      $set: {
        status: "assigned",
        currentAssignment: assignment._id,
        assignedCouriers: [courier._id],
        statusChangedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  if (!offered) {
    await Assignment.updateOne(
      { _id: assignment._id },
      { $set: { status: "cancelled", reason: "delivery changed" } }
    );

    throw new DispatchError(409, "Delivery changed, please try again");
  }

  await recordEvent({
    order: offered,
    event: "assignment.offered",
    courier,
    assignment,
    actor: "platform",
  });

  await notifyOffer(offered, courier, expiresAt, assignment);

  return { order: offered, assignment, courier };
};

export const autoDispatch = async ({
  order,
  platform,
  exclude = [],
}) => {
  const pickup = pointOf(order.pickupLocation);

  if (!pickup) {
    return 0;
  }

  const excluded = new Set(exclude.map(String));

  const candidates = await findNearbyCouriers({
    lat: pickup.lat,
    lng: pickup.lng,
    radiusKm: radiusFor(platform),
    limit: 50,
    dropoff: pointOf(order.dropoffLocation),
    platformId: order.platform,
  });

  const chosen = candidates.filter(
    (candidate) =>
      !excluded.has(candidate.id) &&
      isCourierConnected(candidate.id)
  );

  if (chosen.length === 0) {
    return 0;
  }

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: "pending", courier: null },
    {
      $set: {
        assignedCouriers: chosen.map((candidate) => candidate.id),
      },
    },
    { returnDocument: "after" }
  );

  if (!updated) {
    return 0;
  }

  const couriers = await Courier.find({
    _id: { $in: chosen.map((candidate) => candidate.id) },
  });

  const expiresAt = new Date(
    Date.now() + timeoutFor(platform) * 1000
  );

  for (const courier of couriers) {
    await notifyOffer(updated, courier, expiresAt, null);
  }

  await recordEvent({
    order: updated,
    event: "delivery.dispatched",
    note: `${couriers.length} couriers notified`,
  });

  return couriers.length;
};

export const expireOffers = async () => {
  for (let i = 0; i < 100; i += 1) {
    const now = new Date();

    const assignment = await Assignment.findOneAndUpdate(
      { status: "offered", expiresAt: { $lte: now } },
      { $set: { status: "expired", respondedAt: now } },
      { returnDocument: "after" }
    );

    if (!assignment) {
      return;
    }

    emitToCourier(assignment.courier, "offer-expired", {
      orderId: String(assignment.delivery),
    });

    const order = await Order.findOneAndUpdate(
      {
        _id: assignment.delivery,
        currentAssignment: assignment._id,
        status: "assigned",
      },
      {
        $set: {
          status: "pending",
          currentAssignment: null,
          assignedCouriers: [],
          statusChangedAt: now,
        },
      },
      { returnDocument: "after" }
    );

    if (order) {
      const courier = await Courier.findById(assignment.courier);

      await recordEvent({
        order,
        event: "assignment.expired",
        courier,
        assignment,
        note: "No answer from the courier",
      });
    }
  }
};

export const startDispatchWorker = () =>
  setInterval(() => {
    expireOffers().catch((error) =>
      console.error("Offer expiry error:", error.message)
    );
  }, settings.workerIntervalMs);

export const cancelDelivery = async ({
  order,
  reason,
  cancelledBy,
}) => {
  const cancellable = [
    "pending",
    "assigned",
    ...BEFORE_PICKUP,
  ];

  if (!cancellable.includes(order.status)) {
    throw new DispatchError(
      409,
      TERMINAL_STATUSES.includes(order.status)
        ? `Delivery is already ${order.status}`
        : "The order has already been picked up. The courier must mark it failed if it cannot be delivered."
    );
  }

  const cancelled = await Order.findOneAndUpdate(
    { _id: order._id, status: { $in: cancellable } },
    {
      $set: {
        status: "cancelled",
        cancelReason: reason || "",
        cancelledBy,
        expiresAt: null,
        statusChangedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  if (!cancelled) {
    throw new DispatchError(409, "Delivery changed, please try again");
  }

  const assignment = cancelled.currentAssignment
    ? await Assignment.findOneAndUpdate(
        {
          _id: cancelled.currentAssignment,
          status: { $in: ["offered", "accepted"] },
        },
        {
          $set: {
            status: "cancelled",
            respondedAt: new Date(),
            reason: "delivery cancelled",
          },
        },
        { returnDocument: "after" }
      )
    : null;

  if (cancelled.courier) {
    emitToCourier(cancelled.courier, "order-cancelled", {
      orderId: String(cancelled._id),
      reason: reason || "",
    });
  }

  for (const courierId of cancelled.assignedCouriers || []) {
    if (String(courierId) !== String(cancelled.courier)) {
      emitToCourier(courierId, "offer-withdrawn", {
        orderId: String(cancelled._id),
        reason: "cancelled",
      });
    }
  }

  const courier = cancelled.courier
    ? await Courier.findById(cancelled.courier)
    : null;

  await recordEvent({
    order: cancelled,
    event: "delivery.cancelled",
    courier,
    assignment,
    actor: cancelledBy === "courier" ? "courier" : "platform",
    note: reason || "",
  });

  return cancelled;
};

export const trackingView = (order, courier) => {
  const pickup = pointOf(order.pickupLocation);

  const dropoff = pointOf(order.dropoffLocation);

  let courierPoint = pointOf(courier?.location);

  let recordedAt = courier?.location?.lastUpdated || null;

  if (
    order.courierLocation?.recordedAt &&
    (!recordedAt || order.courierLocation.recordedAt > recordedAt)
  ) {
    courierPoint = {
      lat: order.courierLocation.lat,
      lng: order.courierLocation.lng,
    };

    recordedAt = order.courierLocation.recordedAt;
  }

  let remaining = null;

  if (courierPoint && BEFORE_PICKUP.includes(order.status)) {
    remaining =
      distanceMeters(courierPoint, pickup) +
      distanceMeters(pickup, dropoff);
  } else if (
    courierPoint &&
    ["picked_up", "in_transit", "arrived_delivery"].includes(order.status)
  ) {
    remaining = distanceMeters(courierPoint, dropoff);
  }

  return {
    delivery_id: String(order._id),
    external_order_id: order.externalOrderId || null,
    status: order.status,
    pickup: {
      name: order.restaurantName || "",
      address: order.pickupAddress || "",
      lat: pickup?.lat ?? null,
      lng: pickup?.lng ?? null,
    },
    dropoff: {
      name: order.customerName || "",
      address: order.dropoffAddress || "",
      lat: dropoff?.lat ?? null,
      lng: dropoff?.lng ?? null,
    },
    courier: courier
      ? {
          ...serializeCourier(courier),
          location: courierPoint
            ? {
                ...courierPoint,
                recorded_at: recordedAt
                  ? new Date(recordedAt).toISOString()
                  : null,
              }
            : null,
        }
      : null,
    last_location_at: recordedAt
      ? new Date(recordedAt).toISOString()
      : null,
    location_stale: recordedAt
      ? recordedAt < staleCutoff()
      : true,
    distance_remaining_m: remaining,
    eta_seconds: etaSeconds(remaining, courier?.vehicle),
  };
};
