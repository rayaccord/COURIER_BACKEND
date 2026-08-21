import "dotenv/config";

/*
|--------------------------------------------------------------------------
| HOOKS FOOD INTEGRATION
|--------------------------------------------------------------------------
|
| Courier Backend
|        ↓
| services/hooksIntegration.js
|        ↓
| Hooks FastAPI
|        ↓
| https://api.hooksfoodapp.com
|
|--------------------------------------------------------------------------
*/

const HOOKS_API_URL = (
  process.env.HOOKS_API_URL ||
  "https://api.hooksfoodapp.com"
).replace(/\/$/, "");


/*
|--------------------------------------------------------------------------
| HELPER
|--------------------------------------------------------------------------
*/

const hooksRequest = async (
  endpoint,
  options = {}
) => {

  const url =
    `${HOOKS_API_URL}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",

    ...(process.env.HOOKS_API_KEY
      ? {
          Authorization:
            `Bearer ${process.env.HOOKS_API_KEY}`,
        }
      : {}),

    ...(options.headers || {}),
  };

  const response =
    await fetch(url, {
      ...options,
      headers,
    });

  let data = null;

  try {

    data = await response.json();

  } catch {

    data = null;

  }

  if (!response.ok) {

    const errorMessage =
      data?.detail ||
      data?.message ||
      `Hooks API returned ${response.status}`;

    throw new Error(errorMessage);
  }

  return data;
};


/*
|--------------------------------------------------------------------------
| SEND COURIER EVENT TO HOOKS
|--------------------------------------------------------------------------
|
| Used for:
|
| delivery.accepted
| delivery.picked_up
| delivery.in_transit
| delivery.arrived
| delivery.delivered
| delivery.cancelled
|
|--------------------------------------------------------------------------
*/

export const notifyHooks = async ({
  event,
  order,
  courier = null,
}) => {

  if (!order) {

    throw new Error(
      "Order is required for Hooks notification"
    );

  }


  /*
  |--------------------------------------------------------------------------
  | HOOKS ORDER ID
  |--------------------------------------------------------------------------
  |
  | This MUST be the UUID of the Hooks
  | orders.id column.
  |
  */

  const hooksOrderId =
    order.hooksOrderId;

  if (!hooksOrderId) {

    console.warn(
      "⚠️ Cannot notify Hooks: hooksOrderId is missing"
    );

    return null;
  }


  /*
  |--------------------------------------------------------------------------
  | COURIER INFORMATION
  |--------------------------------------------------------------------------
  */

  const courierBackendId =
    courier?._id
      ? courier._id.toString()
      : null;


  /*
  |--------------------------------------------------------------------------
  | CURRENT LOCATION
  |--------------------------------------------------------------------------
  */

  let latitude = null;
  let longitude = null;


  if (
    courier?.location &&
    Array.isArray(
      courier.location.coordinates
    ) &&
    courier.location.coordinates.length === 2
  ) {

    /*
     * MongoDB GeoJSON:
     *
     * coordinates[0] = longitude
     * coordinates[1] = latitude
     */

    longitude =
      courier.location.coordinates[0];

    latitude =
      courier.location.coordinates[1];
  }


  /*
  |--------------------------------------------------------------------------
  | DELIVERY FEE
  |--------------------------------------------------------------------------
  */

  const deliveryFee =
    order.fee !== undefined &&
    order.fee !== null
      ? Number(order.fee)
      : null;


  /*
  |--------------------------------------------------------------------------
  | PAYLOAD
  |--------------------------------------------------------------------------
  */

  const payload = {

    event,

    hooks_order_id:
      hooksOrderId,

    courier_backend_id:
      courierBackendId,

    courier_name:
      courier?.fullName ||
      courier?.name ||
      null,

    courier_phone:
      courier?.phone ||
      null,

    courier_email:
      courier?.email ||
      null,

    status:
      order.status ||
      null,

    delivery_fee:
      deliveryFee,

    latitude,

    longitude,
  };


  console.log(
    "📡 Sending Courier event to Hooks:"
  );

  console.log(
    JSON.stringify(
      payload,
      null,
      2
    )
  );


  try {

    const result =
      await hooksRequest(
        "/couriers/events",
        {
          method: "POST",

          body: JSON.stringify(
            payload
          ),
        }
      );


    console.log(
      "✅ Hooks event accepted:"
    );

    console.log(
      JSON.stringify(
        result,
        null,
        2
      )
    );


    return result;

  } catch (error) {

    console.error(
      "❌ Hooks integration error:"
    );

    console.error(
      error.message
    );

    /*
     * Do not crash the Courier request
     * simply because Hooks is temporarily
     * unavailable.
     */

    return null;
  }
};


/*
|--------------------------------------------------------------------------
| SYNC COURIER TO HOOKS
|--------------------------------------------------------------------------
|
| Sends the Courier profile to:
|
| POST /couriers/sync
|
|--------------------------------------------------------------------------
*/

export const syncCourierToHooks =
  async (courier) => {

    if (!courier) {

      throw new Error(
        "Courier is required"
      );

    }


    const courierBackendId =
      courier._id
        ? courier._id.toString()
        : null;


    if (!courierBackendId) {

      throw new Error(
        "Courier ID is missing"
      );

    }


    /*
     * Convert MongoDB GeoJSON
     * into latitude / longitude.
     */

    let latitude = null;
    let longitude = null;


    if (
      courier.location &&
      Array.isArray(
        courier.location.coordinates
      ) &&
      courier.location.coordinates.length === 2
    ) {

      longitude =
        courier.location.coordinates[0];

      latitude =
        courier.location.coordinates[1];
    }


    const payload = {

      courier_backend_id:
        courierBackendId,

      full_name:
        courier.fullName ||
        courier.name ||
        "Courier",

      phone:
        courier.phone ||
        null,

      email:
        courier.email ||
        null,

      status:
        courier.online
          ? "online"
          : "offline",

      vehicle_type:
        courier.vehicleType ||
        null,

      vehicle_number:
        courier.vehicleNumber ||
        null,

      current_latitude:
        latitude,

      current_longitude:
        longitude,

      expo_push_token:
        courier.expoPushToken ||
        null,
    };


    console.log(
      "🔄 Syncing courier with Hooks:"
    );

    console.log(
      JSON.stringify(
        payload,
        null,
        2
      )
    );


    try {

      const result =
        await hooksRequest(
          "/couriers/sync",
          {
            method: "POST",

            body: JSON.stringify(
              payload
            ),
          }
        );


      console.log(
        "✅ Courier synced with Hooks"
      );

      return result;

    } catch (error) {

      console.error(
        "❌ Courier sync failed:"
      );

      console.error(
        error.message
      );

      return null;
    }
  };


/*
|--------------------------------------------------------------------------
| CONVENIENCE EVENT FUNCTIONS
|--------------------------------------------------------------------------
*/

export const notifyOrderAccepted =
  async (order, courier) => {

    return notifyHooks({
      event:
        "delivery.accepted",

      order,

      courier,
    });
  };


export const notifyOrderPickedUp =
  async (order, courier) => {

    return notifyHooks({
      event:
        "delivery.picked_up",

      order,

      courier,
    });
  };


export const notifyOrderInTransit =
  async (order, courier) => {

    return notifyHooks({
      event:
        "delivery.in_transit",

      order,

      courier,
    });
  };


export const notifyOrderArrived =
  async (order, courier) => {

    return notifyHooks({
      event:
        "delivery.arrived",

      order,

      courier,
    });
  };


export const notifyOrderDelivered =
  async (order, courier) => {

    return notifyHooks({
      event:
        "delivery.delivered",

      order,

      courier,
    });
  };


export const notifyOrderCancelled =
  async (order, courier) => {

    return notifyHooks({
      event:
        "delivery.cancelled",

      order,

      courier,
    });
  };
