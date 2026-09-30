import Assignment from "../models/Assignment.js";
import Order from "../models/Order.js";
import Courier from "../models/Courier.js";
import Transaction from "../models/Transaction.js";
import settings from "../config/settings.js";
import { recordEvent } from "../services/deliveryEvents.js";
import {
  ACTIVE_STATUSES,
  BEFORE_PICKUP,
  LEGACY_STATUS,
  NEXT_STATUS,
  autoDispatch,
  offerView,
  releaseCourier,
} from "../services/dispatch.js";
import {
  distanceMeters,
  pointOf,
} from "../services/geo.js";
import Platform from "../models/Platform.js";
import { emitToCourier } from "../sockets/socketServer.js";

const redispatchIfAuto = async (order, exclude) => {
  if (order?.dispatchMode !== "auto" || order.status !== "pending") {
    return;
  }

  const platform = order.platform
    ? await Platform.findById(order.platform)
    : null;

  await autoDispatch({ order, platform, exclude }).catch((error) =>
    console.error("Auto dispatch failed:", error.message)
  );
};

/* GET PENDING ORDERS */
export const getPendingOrders = async (req, res) => {
  try {
    const now = new Date();

    const courier = await Courier.findById(req.user.id);

    const orders = await Order.find({
      status: { $in: ["pending", "assigned"] },
      assignedCouriers: req.user.id,
    }).sort({ createdAt: -1 });

    const offers = await Assignment.find({
      courier: req.user.id,
      status: "offered",
      expiresAt: { $gt: now },
      delivery: { $in: orders.map((order) => order._id) },
    });

    const offerFor = new Map(
      offers.map((offer) => [String(offer.delivery), offer])
    );

    const visible = orders
      .filter(
        (order) =>
          order.status === "pending" ||
          offerFor.has(String(order._id))
      )
      .map((order) => {
        const offer = offerFor.get(String(order._id));

        return offerView(
          order,
          courier,
          offer?.expiresAt || null,
          offer || null
        );
      });

    return res.json(visible);
  } catch (err) {
    return res.status(500).json({
      error: err.message,
    });
  }
};

export const acceptOrder =
  async (req, res) => {
    try {
      const order =
        await Order.findById(
          req.params.id
        );

      if (!order) {
        return res.status(404).json({
          message: "Order not found",
        });
      }

      const existingActiveOrder =
        await Order.findOne({
          courier: req.user.id,
          status: { $in: ACTIVE_STATUSES },
        });

      if (existingActiveOrder) {
        return res.status(400).json({
          message:
            "Complete your current delivery before accepting a new one",
        });
      }

      const now = new Date();

      let assignment = null;

      if (order.status === "assigned") {
        assignment = await Assignment.findOneAndUpdate(
          {
            _id: order.currentAssignment,
            courier: req.user.id,
            status: "offered",
            expiresAt: { $gt: now },
          },
          {
            $set: {
              status: "accepted",
              respondedAt: now,
            },
          },
          { returnDocument: "after" }
        );

        if (!assignment) {
          return res.status(409).json({
            message:
              "This delivery request has expired or was given to another courier",
          });
        }
      } else if (
        order.status !== "pending" ||
        !order.assignedCouriers.some(
          (id) => id.toString() === req.user.id
        )
      ) {
        return res.status(409).json({
          message: "Order already accepted",
        });
      }

      const accepted = await Order.findOneAndUpdate(
        {
          _id: order._id,
          courier: null,
          status: order.status,
          ...(assignment
            ? { currentAssignment: assignment._id }
            : { assignedCouriers: req.user.id }),
        },
        {
          $set: {
            status: "accepted",
            courier: req.user.id,
            statusChangedAt: now,
          },
        },
        { returnDocument: "after" }
      );

      if (!accepted) {
        if (assignment) {
          await Assignment.updateOne(
            { _id: assignment._id },
            { $set: { status: "cancelled", reason: "delivery changed" } }
          );
        }

        return res.status(409).json({
          message: "Order already accepted",
        });
      }

      if (!assignment) {
        assignment = await Assignment.create({
          delivery: accepted._id,
          platform: accepted.platform,
          courier: req.user.id,
          source: "auto",
          status: "accepted",
          offeredAt: accepted.createdAt,
          respondedAt: now,
        });

        accepted.currentAssignment = assignment._id;

        await accepted.save();
      }

      const acceptedCourier =
        await Courier.findById(req.user.id);

      await recordEvent({
        order: accepted,
        event: "assignment.accepted",
        courier: acceptedCourier,
        assignment,
        actor: "courier",
      });

      for (const courierId of accepted.assignedCouriers) {
        if (courierId.toString() !== req.user.id) {
          emitToCourier(courierId, "order-accepted", accepted._id);
        }
      }

      res.status(200).json({
        message: "Order accepted",
        order: accepted,
      });
    } catch (error) {
      console.error("Accept order failed:", error);

      res.status(500).json({
        message: "Server Error",
      });
    }
  };

const creditCourier = async (order) => {
  const courier = await Courier.findById(order.courier);

  if (!courier) {
    return;
  }

  const reference = `EARNING-${order._id}`;

  if (await Transaction.exists({ reference })) {
    return;
  }

  const earning = Number(order.fee || 0);

  const balanceBefore = courier.wallet.available;

  courier.wallet.available += earning;
  courier.wallet.today += earning;
  courier.wallet.weekly += earning;
  courier.wallet.monthly += earning;
  courier.wallet.totalEarned += earning;
  courier.completedOrders += 1;

  await courier.save();

  await Transaction.create({
    walletId: courier._id,
    courier: courier._id,
    type: "earning",
    amount: earning,
    balanceBefore,
    balanceAfter: courier.wallet.available,
    reference,
    orderId: order._id,
    status: "completed",
  });
};

const PICKUP_CHECK = ["arrived_pickup", "picked_up"];

const DROPOFF_CHECK = ["arrived_delivery", "delivered"];

export const updateOrderStatus =
  async (req, res) => {
    try {
      const requested =
        LEGACY_STATUS[req.body?.status] || req.body?.status;

      const order =
        await Order.findById(
          req.params.id
        );

      if (!order) {
        return res.status(404).json({
          message: "Order not found",
        });
      }

      const allowedStatuses = [
        ...Object.values(NEXT_STATUS),
        "failed",
      ];

      if (!allowedStatuses.includes(requested)) {
        return res.status(400).json({
          message: "Invalid status",
        });
      }

      if (
        !order.courier ||
        order.courier.toString() !== req.user.id
      ) {
        return res.status(403).json({
          message: "You are not assigned to this order",
        });
      }

      const courier = await Courier.findById(req.user.id);

      if (!courier) {
        return res.status(404).json({
          message: "Courier not found",
        });
      }

      const courierPoint = pointOf(courier.location);

      if (requested === "failed") {
        if (!ACTIVE_STATUSES.includes(order.status)) {
          return res.status(400).json({
            message: "Delivery is already closed",
          });
        }
      } else {
        if (NEXT_STATUS[order.status] !== requested) {
          return res.status(400).json({
            message: `You cannot change the delivery from "${order.status}" to "${requested}". You must complete the current delivery step first.`,
          });
        }

        const target = PICKUP_CHECK.includes(requested)
          ? pointOf(order.pickupLocation)
          : DROPOFF_CHECK.includes(requested)
            ? pointOf(order.dropoffLocation)
            : null;

        if (target || PICKUP_CHECK.includes(requested) || DROPOFF_CHECK.includes(requested)) {
          if (!target) {
            return res.status(400).json({
              message: PICKUP_CHECK.includes(requested)
                ? "Pickup location is unavailable."
                : "Customer location is unavailable.",
            });
          }

          if (!courierPoint) {
            return res.status(400).json({
              message:
                "Your current location is unavailable. Please enable location services and try again.",
            });
          }

          const distance = distanceMeters(courierPoint, target);

          if (distance > settings.geofenceMeters) {
            return res.status(400).json({
              message: PICKUP_CHECK.includes(requested)
                ? "You must be at the pickup location before continuing."
                : "You must be at the customer address before continuing.",
              distance,
            });
          }
        }
      }

      const updated = await Order.findOneAndUpdate(
        {
          _id: order._id,
          courier: req.user.id,
          status: order.status,
        },
        {
          $set: {
            status: requested,
            statusChangedAt: new Date(),
            ...(requested === "failed"
              ? { cancelReason: String(req.body?.reason || "").slice(0, 300) }
              : {}),
          },
        },
        { returnDocument: "after" }
      );

      if (!updated) {
        return res.status(409).json({
          message: "The delivery was changed. Please refresh.",
        });
      }

      const assignment =
        ["delivered", "failed"].includes(requested) && updated.currentAssignment
          ? await Assignment.findByIdAndUpdate(
              updated.currentAssignment,
              { $set: { status: "completed", reason: requested } },
              { returnDocument: "after" }
            )
          : updated.currentAssignment
            ? await Assignment.findById(updated.currentAssignment)
            : null;

      await recordEvent({
        order: updated,
        event: `delivery.${requested}`,
        courier,
        assignment,
        actor: "courier",
        location: courierPoint,
        note: requested === "failed" ? updated.cancelReason : "",
      });

      if (requested === "delivered") {
        await creditCourier(updated);
      }

      res.status(200).json({
        message:
          requested === "failed"
            ? "Delivery marked as failed"
            : "Order updated",
        order: updated,
      });
    } catch (error) {
      console.error("Update order status failed:", error);

      res.status(500).json({
        message: "Server Error",
      });
    }
  };

export const getActiveOrder =
  async (req, res) => {
    try {
      const order =
        await Order.findOne({
          courier: req.user.id,
          status: { $in: ACTIVE_STATUSES },
        });

      res.status(200).json(order || null);
    } catch (error) {
      res.status(500).json({
        message: "Server Error",
      });
    }
  };

  export const getOrderHistory =
  async (req, res) => {
    try {

      const orders =
        await Order.find({
          courier: req.user.id,
          status: "delivered",
        })
        .sort({
          updatedAt: -1,
        });

      res.status(200).json(
        orders
      );

    } catch (error) {

      res.status(500).json({
        message:
          "Failed to fetch history",
      });

    }
  };


const declineOrder = async (req, res, reason) => {
  const order =
    await Order.findById(
      req.params.id
    );

  if (!order) {
    return res.status(404).json({
      message: "Order not found",
    });
  }

  const now = new Date();

  const courier = await Courier.findById(req.user.id);

  if (order.status === "assigned") {
    const assignment = await Assignment.findOneAndUpdate(
      {
        _id: order.currentAssignment,
        courier: req.user.id,
        status: "offered",
      },
      {
        $set: {
          status: "rejected",
          respondedAt: now,
          reason,
        },
      },
      { returnDocument: "after" }
    );

    if (!assignment) {
      return res.status(403).json({
        message: "You are not assigned to this order",
      });
    }

    const released = await Order.findOneAndUpdate(
      {
        _id: order._id,
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

    if (released) {
      await recordEvent({
        order: released,
        event: "assignment.rejected",
        courier,
        assignment,
        actor: "courier",
        note: reason,
      });

      await redispatchIfAuto(released, [req.user.id]);
    }

    return res.status(200).json({
      message: "Order rejected",
    });
  }

  if (
    order.courier &&
    order.courier.toString() === req.user.id
  ) {
    if (!BEFORE_PICKUP.includes(order.status)) {
      return res.status(400).json({
        message:
          "The order cannot be rejected after pickup",
      });
    }

    const released = await releaseCourier({
      order,
      courierId: req.user.id,
      assignmentStatus: "rejected",
      reason,
      event: "assignment.rejected",
      actor: "courier",
    });

    if (!released) {
      return res.status(409).json({
        message: "The delivery was changed. Please refresh.",
      });
    }

    await redispatchIfAuto(released, [req.user.id]);

    return res.status(200).json({
      message: "Order rejected",
    });
  }

  if (
    order.status === "pending" &&
    order.assignedCouriers.some(
      (id) => id.toString() === req.user.id
    )
  ) {
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: "pending" },
      { $pull: { assignedCouriers: order.assignedCouriers.find((id) => id.toString() === req.user.id) } },
      { returnDocument: "after" }
    );

    if (updated) {
      const assignment = await Assignment.create({
        delivery: updated._id,
        platform: updated.platform,
        courier: req.user.id,
        source: "auto",
        status: "rejected",
        offeredAt: updated.createdAt,
        respondedAt: now,
        reason,
      });

      await recordEvent({
        order: updated,
        event: "assignment.rejected",
        courier,
        assignment,
        actor: "courier",
        note: reason,
      });
    }

    return res.status(200).json({
      message: "Order rejected",
    });
  }

  if (order.courier) {
    return res.status(403).json({
      message:
        "Another courier is assigned to this order",
    });
  }

  return res.status(403).json({
    message: "You are not assigned to this order",
  });
};

export const rejectOrder =
  async (req, res) => {
    try {
      return await declineOrder(
        req,
        res,
        String(req.body?.reason || "declined by courier").slice(0, 300)
      );
    } catch (error) {
      console.error("Reject order failed:", error);

      res.status(500).json({
        message: "Failed to reject order",
      });
    }
  };

  export const getCourierStats =
  async (req, res) => {

    try {

      const deliveredOrders =
        await Order.find({
          courier: req.user.id,
          status: "delivered",
        });

      const totalDeliveries =
        deliveredOrders.length;

      const totalEarnings =
        deliveredOrders.reduce(
          (sum, order) =>
            sum + (order.fee || 0),
          0
        );

      const averageFee =
        totalDeliveries
          ? (
              totalEarnings /
              totalDeliveries
            ).toFixed(2)
          : 0;

      res.json({
        totalDeliveries,
        totalEarnings,
        averageFee,
      });

    } catch (error) {

      res.status(500).json({
        message:
          "Failed to fetch stats",
      });

    }
  };



  



export const cancelOrder =
  async (req, res) => {
    try {
      const order =
        await Order.findById(
          req.params.id
        );

      if (!order) {
        return res.status(404).json({
          message: "Order not found",
        });
      }

      if (
        !order.courier ||
        order.courier.toString() !== req.user.id
      ) {
        return res.status(403).json({
          message: "You are not assigned to this order",
        });
      }

      if (!BEFORE_PICKUP.includes(order.status)) {
        return res.status(400).json({
          message:
            "After pickup the delivery cannot be dropped. Mark it as failed instead.",
        });
      }

      const released = await releaseCourier({
        order,
        courierId: req.user.id,
        assignmentStatus: "cancelled",
        reason: String(req.body?.reason || "dropped by courier").slice(0, 300),
        event: "assignment.cancelled",
        actor: "courier",
      });

      if (!released) {
        return res.status(409).json({
          message: "The delivery was changed. Please refresh.",
        });
      }

      await redispatchIfAuto(released, [req.user.id]);

      res.status(200).json({
        message: "You have been removed from this delivery",
        order: released,
      });
    } catch (error) {
      console.error("Cancel order failed:", error);

      res.status(500).json({
        message: "Failed to cancel order",
      });
    }
  };


  export const getEarningsAnalytics =
  async (req, res) => {

    try {

      const {
        start,
        end,
      } = req.query;

      const startDate =
        new Date(start);

      const endDate =
        new Date(end);

      endDate.setHours(
        23,
        59,
        59,
        999
      );

      const orders =
        await Order.find({
          courier: req.user.id,
          status: "delivered",
          updatedAt: {
            $gte: startDate,
            $lte: endDate,
          },
        });

      const totalOrders =
        orders.length;

      const totalEarnings =
        orders.reduce(
          (sum, order) =>
            sum + (order.fee || 0),
          0
        );

      const averageOrderValue =
        totalOrders > 0
          ? (
              totalEarnings /
              totalOrders
            ).toFixed(2)
          : 0;

      res.status(200).json({
        totalOrders,
        totalEarnings,
        averageOrderValue,
      });

    } catch (error) {

      res.status(500).json({
        message:
          "Failed to fetch analytics",
      });

    }
  };



  export const getWeeklyEarnings =
async (req, res) => {

  try {

    const weekData = [
      0,0,0,0,0,0,0
    ];

    const today = new Date();

    const startOfWeek = new Date(today);

    startOfWeek.setDate(
      today.getDate() - today.getDay()
    );

    startOfWeek.setHours(
      0,
      0,
      0,
      0
    );

    const orders =
      await Order.find({

        courier: req.user.id,

        status: "delivered",

        updatedAt: {
          $gte: startOfWeek,
        },

      });

    orders.forEach(order => {

      const day =
        new Date(
          order.updatedAt
        ).getDay();

      weekData[day] +=
        order.fee;

    });

    res.json(weekData);

  } catch (error) {

    res.status(500).json({

      message:
        "Failed to fetch weekly earnings",

    });

  }

};
