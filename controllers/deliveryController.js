import Order from "../models/Order.js";
import Courier from "../models/Courier.js";
import { io, connectedCouriers } from "../server.js";

export const createDelivery = async (req, res) => {
  try {
    const {
      // ------------------------------------------
      // HOOKS IDENTIFIERS
      // ------------------------------------------
      hooks_order_id,
      hooks_user_id,

      // Restaurant
      hooks_restaurant_id,

      // Pharmacy
      hooks_pharmacy_id,

      // Store
      hooks_store_id,

      // Generic source/entity
      hooks_entity_type,
      hooks_entity_id,

      // ------------------------------------------
      // CUSTOMER
      // ------------------------------------------
      customer,

      // ------------------------------------------
      // BUSINESS / PICKUP SOURCE
      // ------------------------------------------
      restaurant,
      pharmacy,
      store,
      source,

      // ------------------------------------------
      // LOCATIONS
      // ------------------------------------------
      pickup,
      dropoff,

      // ------------------------------------------
      // ORDER
      // ------------------------------------------
      order,

      // ------------------------------------------
      // DELIVERY FEE
      // ------------------------------------------
      delivery_fee,
    } = req.body;

    // ============================================================
    // REQUIRED HOOKS ORDER ID
    // ============================================================

    if (!hooks_order_id) {
      return res.status(400).json({
        message: "hooks_order_id is required",
      });
    }

    // ============================================================
    // PREVENT DUPLICATE DELIVERY
    // ============================================================

    const existingOrder = await Order.findOne({
      hooksOrderId: hooks_order_id,
    });

    if (existingOrder) {
      return res.status(200).json({
        message: "Delivery already exists",
        order: existingOrder,
      });
    }

    // ============================================================
    // VALIDATE PICKUP
    // ============================================================

    if (
      !pickup ||
      typeof pickup.latitude !== "number" ||
      typeof pickup.longitude !== "number"
    ) {
      return res.status(400).json({
        message: "Valid pickup coordinates are required",
      });
    }

    // ============================================================
    // VALIDATE DROPOFF
    // ============================================================

    if (
      !dropoff ||
      typeof dropoff.latitude !== "number" ||
      typeof dropoff.longitude !== "number"
    ) {
      return res.status(400).json({
        message: "Valid dropoff coordinates are required",
      });
    }

    // ============================================================
    // DETERMINE DELIVERY SOURCE
    // ============================================================

    let entityType = hooks_entity_type || "";
    let entityId = hooks_entity_id || "";

    // ------------------------------------------------------------
    // Restaurant
    // ------------------------------------------------------------

    if (
      !entityType &&
      hooks_restaurant_id
    ) {
      entityType = "restaurant";
      entityId = hooks_restaurant_id;
    }

    // ------------------------------------------------------------
    // Pharmacy
    // ------------------------------------------------------------

    if (
      !entityType &&
      hooks_pharmacy_id
    ) {
      entityType = "pharmacy";
      entityId = hooks_pharmacy_id;
    }

    // ------------------------------------------------------------
    // Store
    // ------------------------------------------------------------

    if (
      !entityType &&
      hooks_store_id
    ) {
      entityType = "store";
      entityId = hooks_store_id;
    }

    // ------------------------------------------------------------
    // Generic source
    // ------------------------------------------------------------

    if (
      !entityType &&
      source?.type
    ) {
      entityType = source.type;
      entityId =
        source.id ||
        "";
    }

    // ============================================================
    // DETERMINE BUSINESS NAME
    // ============================================================

    let businessName = "Pickup Location";

    // Restaurant
    if (restaurant?.name) {
      businessName = restaurant.name;
    }

    // Pharmacy
    if (pharmacy?.name) {
      businessName = pharmacy.name;
    }

    // Store
    if (store?.name) {
      businessName = store.name;
    }

    // Generic source
    if (source?.name) {
      businessName = source.name;
    }

    // Generic pickup name
    if (pickup?.name) {
      businessName = pickup.name;
    }

    // ============================================================
    // CREATE COURIER DELIVERY
    // ============================================================

    const newOrder = await Order.create({
      // ----------------------------------------------------------
      // COURIER ORDER NUMBER
      // ----------------------------------------------------------

      orderNumber: `ORD-${Date.now()}`,

      // ----------------------------------------------------------
      // HOOKS ORDER
      // ----------------------------------------------------------

      hooksOrderId: hooks_order_id,

      // ----------------------------------------------------------
      // HOOKS USER
      // ----------------------------------------------------------

      hooksUserId:
        hooks_user_id || "",

      // ----------------------------------------------------------
      // RESTAURANT
      // ----------------------------------------------------------

      hooksRestaurantId:
        hooks_restaurant_id || "",

      // ----------------------------------------------------------
      // PHARMACY
      // ----------------------------------------------------------

      hooksPharmacyId:
        hooks_pharmacy_id || "",

      // ----------------------------------------------------------
      // STORE
      // ----------------------------------------------------------

      hooksStoreId:
        hooks_store_id || "",

      // ----------------------------------------------------------
      // GENERIC ENTITY
      // ----------------------------------------------------------

      hooksEntityType:
        entityType || "",

      hooksEntityId:
        entityId || "",

      // ----------------------------------------------------------
      // CUSTOMER
      // ----------------------------------------------------------

      customerName:
        customer?.name ||
        "Customer",

      customerPhone:
        customer?.phone ||
        "",

      // ----------------------------------------------------------
      // BUSINESS NAME
      // ----------------------------------------------------------

      restaurantName:
        businessName,

      // ----------------------------------------------------------
      // PICKUP ADDRESS
      // ----------------------------------------------------------

      pickupAddress:
        pickup?.address ||
        "",

      // ----------------------------------------------------------
      // PICKUP LOCATION
      // ----------------------------------------------------------

      pickupLocation: {
        type: "Point",

        coordinates: [
          pickup.longitude,
          pickup.latitude,
        ],
      },

      // ----------------------------------------------------------
      // DROPOFF ADDRESS
      // ----------------------------------------------------------

      dropoffAddress:
        dropoff?.address ||
        "",

      // ----------------------------------------------------------
      // DROPOFF LOCATION
      // ----------------------------------------------------------

      dropoffLocation: {
        type: "Point",

        coordinates: [
          dropoff.longitude,
          dropoff.latitude,
        ],
      },

      // ----------------------------------------------------------
      // DELIVERY FEE
      // ----------------------------------------------------------

      fee: Number(
        delivery_fee ??
        order?.delivery_fee ??
        0
      ),

      // ----------------------------------------------------------
      // STATUS
      // ----------------------------------------------------------

      status: "pending",
    });

    // ============================================================
    // FIND NEARBY ONLINE COURIERS
    // ============================================================

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

    // ============================================================
    // SEND DELIVERY TO CONNECTED COURIERS
    // ============================================================

    for (
      const courier
      of nearbyCouriers
    ) {
      const socketId =
        connectedCouriers.get(
          courier._id.toString()
        );

      // ----------------------------------------------------------
      // COURIER NOT CONNECTED
      // ----------------------------------------------------------

      if (!socketId) {
        continue;
      }

      // ----------------------------------------------------------
      // ADD COURIER TO ASSIGNED COURIERS
      // ----------------------------------------------------------

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

      // ----------------------------------------------------------
      // SEND REAL-TIME ORDER
      // ----------------------------------------------------------

      io.to(socketId).emit(
        "new-order",
        newOrder
      );
    }

    // ============================================================
    // SAVE ORDER
    // ============================================================

    await newOrder.save();

    // ============================================================
    // RESPONSE TO HOOKS BACKEND
    // ============================================================

    return res.status(201).json({
      message:
        "Delivery created",

      delivery:
        newOrder,
    });

  } catch (error) {

    console.error(
      "CREATE DELIVERY ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Server Error",

      error:
        error.message,
    });
  }
};
