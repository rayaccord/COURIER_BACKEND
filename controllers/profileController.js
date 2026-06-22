import Courier from "../models/Courier.js";

/* GET PROFILE */
export const getProfile = async (req, res) => {
  try {
    const courier = await Courier.findById(req.user.id);

    if (!courier) {
      return res.status(404).json({
        message: "Courier not found",
      });
    }

    res.status(200).json({
      fullName: courier.fullName,
      email: courier.email,
      phone: courier.phone,
      vehicle: courier.vehicle,
      city: courier.city,
      rating: courier.rating,
      completedOrders: courier.completedOrders,
    });

  } catch (error) {
    res.status(500).json({
      message: "Server Error",
    });
  }
};

/* UPDATE PROFILE */
export const updateProfile = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      vehicle,
      city,
    } = req.body;

    const courier = await Courier.findById(req.user.id);

    if (!courier) {
      return res.status(404).json({
        message: "Courier not found",
      });
    }

    courier.fullName =
      fullName ?? courier.fullName;

    courier.phone =
      phone ?? courier.phone;

    courier.vehicle =
      vehicle ?? courier.vehicle;

    courier.city =
      city ?? courier.city;

    await courier.save();

    res.status(200).json({
      message: "Profile updated successfully",
      courier,
    });

  } catch (error) {
    res.status(500).json({
      message: "Server Error",
    });
  }
};


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
        coordinates: [
          lng,
          lat,
        ],
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



  export const updateOnlineStatus =
  async (req, res) => {

    try {

      const { online } =
        req.body;

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

      courier.online =
        online;

      await courier.save();

      res.status(200).json({
        message:
          "Status updated",
        online:
          courier.online,
      });

    } catch (error) {

      res.status(500).json({
        message:
          "Failed to update status",
      });

    }
  };