const HOOKS_BACKEND_URL =
  process.env.HOOKS_BACKEND_URL;

const HOOKS_API_KEY =
  process.env.HOOKS_API_KEY;

export const notifyHooks = async ({
  event,
  order,
  courier = null,
}) => {
  if (!HOOKS_BACKEND_URL) {
    console.error(
      "HOOKS_BACKEND_URL is not configured"
    );
    return;
  }

  if (!HOOKS_API_KEY) {
    console.error(
      "HOOKS_API_KEY is not configured"
    );
    return;
  }

  try {
    const response = await fetch(
      `${HOOKS_BACKEND_URL}/api/courier/webhook`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${HOOKS_API_KEY}`,
        },

        body: JSON.stringify({
          event,

          hooks_order_id:
            order.hooksOrderId,

          delivery_id:
            order._id.toString(),

          status: order.status,

          courier: courier
            ? {
                id: courier._id.toString(),
                fullName:
                  courier.fullName || "",
                phone:
                  courier.phone || "",
                email:
                  courier.email || "",
              }
            : null,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error(
        "HOOKS WEBHOOK ERROR:",
        result
      );

      return;
    }

    console.log(
      "Hooks notified successfully:",
      event
    );

    return result;

  } catch (error) {
    console.error(
      "HOOKS WEBHOOK REQUEST FAILED:",
      error
    );
  }
};