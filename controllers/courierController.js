import Courier from "../models/Courier.js";
export const updateLocation =
  async (req, res) => {

    try {

      const {
        lat,
        lng,
      } = req.body;

      const courier =
        await Courier.findById(
          req.user.id
        );

      if (!courier) {
        return res.status(404).json({
          message:
            "Courier not found",
        });
      }

      courier.location = {
  type: "Point",
  coordinates: [lng, lat],
};

      await courier.save();

      res.status(200).json({
        message:
          "Location updated",
      });

    } catch (error) {

      res.status(500).json({
        message:
          "Failed to update location",
      });

    }
  };



  export const getProfile =
  async (req, res) => {

    try {

      const courier =
        await Courier.findById(
          req.user.id
        ).select("-password");

      if (!courier) {
        return res.status(404).json({
          message:
            "Courier not found",
        });
      }

      res.status(200).json(
        courier
      );

    } catch (error) {

      res.status(500).json({
        message:
          "Failed to fetch profile",
      });

    }
  };



  export const updateProfile =
  async (req, res) => {

    try {

      const {
        fullName,
        phone,
        city,
        vehicle,
      } = req.body;

      const courier =
        await Courier.findById(
          req.user.id
        );

      if (!courier) {
        return res.status(404).json({
          message:
            "Courier not found",
        });
      }

      if (fullName)
        courier.fullName =
          fullName;

      if (phone)
        courier.phone =
          phone;

      if (city)
        courier.city =
          city;

      if (vehicle)
        courier.vehicle =
          vehicle;

      await courier.save();

      res.status(200).json({
        message:
          "Profile updated",
        courier,
      });

    } catch (error) {

      res.status(500).json({
        message:
          "Failed to update profile",
      });

    }
  };



  export const savePushToken = async (req, res) => {

  try {

    const { expoPushToken } = req.body;

    const courier =
      await Courier.findById(req.user.id);

    if (!courier) {
      return res.status(404).json({
        message: "Courier not found",
      });
    }

    courier.expoPushToken =
      expoPushToken;

    await courier.save();

    res.json({
      message: "Push token saved",
    });

  } catch (error) {

    res.status(500).json({
      message: "Failed to save push token",
    });

  }

};