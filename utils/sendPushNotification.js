const sendPushNotification = async (
  expoPushToken,
  title,
  body,
  data = {},
  options = {}
) => {
  try {
    const message = {
      to: expoPushToken,
      sound: "default",
      title,
      body,
      data,
      ...options,
    };

    const response = await fetch(
      process.env.EXPO_PUSH_URL ||
        "https://exp.host/--/api/v2/push/send",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      }
    );

    const result = await response.json();

    console.log("Push Result:", result);

    return result;
  } catch (err) {
    console.log(err);
  }
};

export default sendPushNotification;