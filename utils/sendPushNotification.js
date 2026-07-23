const sendPushNotification = async (
  expoPushToken,
  title,
  body,
  data = {}
) => {
  try {
    const message = {
      to: expoPushToken,
      sound: "default",
      title,
      body,
      data,
    };

    const response = await fetch(
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