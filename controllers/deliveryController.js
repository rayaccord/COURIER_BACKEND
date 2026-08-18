import Order from "../models/Order.js";
import Courier from "../models/Courier.js";
import { io, connectedCouriers } from "../server.js";

export const createDelivery = async (req, res) => {
  try {
    const {
      hooks_order_id,
      hooks_user_id,
      hooks_restaurant_id,
      customer,
      restaurant,
      pickup,
      dropoff,
      order,
      delivery_fee,
    } = req.body;

    // ------------------------------------------
    // REQUIRED HOOKS ORDER ID
    // ------------------------------------------

    if (!hooks_order_id) {
      return res.status(400).json({
        message: "hooks_order_id is required",
      });
    }

    // ------------------------------------------
    // PREVENT DUPLICATE DELIVERY
    // ------------------------------------------

    const existingOrder = await Order.findOne({
      hooksOrderId: hooks_order_id,
    });

    if (existingOrder) {
      return res.status(200).json({
        message: "Delivery already exists",
        order: existingOrder,
      });
    }

    // ------------------------------------------
    // VALIDATE PICKUP
    // ------------------------------------------

    if (
      !pickup ||
      typeof pickup.latitude !== "number" ||
      typeof pickup.longitude !== "number"
    ) {
      return res.status(400).json({
        message: "Valid pickup coordinates are required",
      });
    }

    // ------------------------------------------
    // VALIDATE DROPOFF
    // ------------------------------------------

    if (
      !dropoff ||
      typeof dropoff.latitude !== "number" ||
      typeof dropoff.longitude !== "number"
    ) {
      return res.status(400).json({
        message: "Valid dropoff coordinates are required",
      });
    }

    // ------------------------------------------
    // CREATE COURIER DELIVERY
    // ------------------------------------------

    const newOrder = await Order.create({
      orderNumber: `ORD-${Date.now()}`,

      hooksOrderId: hooks_order_id,
      hooksUserId: hooks_user_id || "",
      hooksRestaurantId:
        hooks_restaurant_id || "",

customerName:
  customer?.name || "Customer",

customerPhone:
  customer?.phone || "",

      restaurantName:
        restaurant?.name || "Restaurant",

      pickupAddress:
        pickup?.address || "",

      pickupLocation: {
        type: "Point",
        coordinates: [
          pickup.longitude,
          pickup.latitude,
        ],
      },

      dropoffAddress:
        dropoff?.address || "",

      dropoffLocation: {
        type: "Point",
        coordinates: [
          dropoff.longitude,
          dropoff.latitude,
        ],
      },

fee: Number(
  delivery_fee ??
    order?.delivery_fee ??
    0
),
      status: "pending",
    });

    // ------------------------------------------
    // FIND NEARBY ONLINE COURIERS
    // ------------------------------------------

    const nearbyCouriers =
      await Courier.find({
        online: true,
        location: {
          $near: {
            $geometry:
              newOrder.pickupLocation,
            $maxDistance: 50000,
          },
        },
      });

    // ------------------------------------------
    // SEND DELIVERY TO CONNECTED COURIERS
    // ------------------------------------------

    for (const courier of nearbyCouriers) {
      const socketId =
        connectedCouriers.get(
          courier._id.toString()
        );

      if (!socketId) {
        continue;
      }

      // Add courier to the list of couriers
      // who received this delivery.
      if (
        !newOrder.assignedCouriers.some(
          (id) =>
            id.toString() ===
            courier._id.toString()
        )
      ) {
        newOrder.assignedCouriers.push(
          courier._id
        );
      }

      io.to(socketId).emit(
        "new-order",
        newOrder
      );
    }

    await newOrder.save();

    // ------------------------------------------
    // RESPONSE TO HOOKS
    // ------------------------------------------

    return res.status(201).json({
      message: "Delivery created",
      delivery: newOrder,
    });
  } catch (error) {
    console.error(
      "CREATE DELIVERY ERROR:",
      error
    );

    return res.status(500).json({
      message: "Server Error",
    });
  }
};