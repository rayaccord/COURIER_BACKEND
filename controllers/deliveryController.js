import { createPlatformDelivery } from "./platformController.js";
import { DispatchError } from "../services/dispatch.js";

const firstName = (...values) =>
  values.find((value) => typeof value === "string" && value.trim()) || "";

const fromLegacyBody = (body) => {
  const pickup = body.pickup || {};

  const dropoff = body.dropoff || {};

  let type = body.hooks_entity_type || body.source?.type || pickup.type || "";

  let externalId = body.hooks_entity_id || body.source?.id || pickup.id || "";

  if (!type && body.hooks_restaurant_id) {
    type = "restaurant";
    externalId = body.hooks_restaurant_id;
  } else if (!type && body.hooks_pharmacy_id) {
    type = "pharmacy";
    externalId = body.hooks_pharmacy_id;
  } else if (!type && body.hooks_store_id) {
    type = "store";
    externalId = body.hooks_store_id;
  }

  return {
    external_order_id: body.external_order_id || body.hooks_order_id,
    external_reference: body.external_reference || body.order_number || "",
    dispatch: body.dispatch || "auto",
    pickup: {
      name: firstName(
        pickup.name,
        body.source?.name,
        body.store?.name,
        body.pharmacy?.name,
        body.restaurant?.name
      ),
      type,
      external_id: externalId,
      phone: pickup.phone,
      address: pickup.address,
      lat: pickup.lat ?? pickup.latitude,
      lng: pickup.lng ?? pickup.longitude,
    },
    dropoff: {
      name: firstName(dropoff.name, body.customer?.name),
      phone: firstName(dropoff.phone, body.customer?.phone),
      address: dropoff.address,
      instructions: dropoff.instructions || dropoff.delivery_instruction,
      lat: dropoff.lat ?? dropoff.latitude,
      lng: dropoff.lng ?? dropoff.longitude,
    },
    fee: body.delivery_fee ?? body.order?.delivery_fee ?? body.fee ?? 0,
    items: Array.isArray(body.items)
      ? body.items.map((item) => ({
          name: item?.name,
          quantity: item?.quantity,
          note: item?.note,
        }))
      : [],
    metadata: {
      user_id: body.hooks_user_id || "",
      restaurant_id: body.hooks_restaurant_id || "",
      pharmacy_id: body.hooks_pharmacy_id || "",
      store_id: body.hooks_store_id || "",
      payment_method: body.payment_method || "",
    },
  };
};

export const createDelivery = async (req, res) => {
  try {
    const { order, created } = await createPlatformDelivery(
      req.platform,
      fromLegacyBody(req.body || {})
    );

    return res.status(created ? 201 : 200).json({
      message: created ? "Delivery created" : "Delivery already exists",
      delivery: order,
      order,
    });
  } catch (error) {
    if (error instanceof DispatchError) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error("CREATE DELIVERY ERROR:", error);

    return res.status(500).json({
      message: "Server Error",
    });
  }
};
