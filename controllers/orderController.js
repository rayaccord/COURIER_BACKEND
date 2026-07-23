import Order from "../models/Order.js";
import Courier from "../models/Courier.js";
import {
  io,
  connectedCouriers,
} from "../server.js";


/* CREATE ORDER */
export const createOrder = async (
  req,
  res
) => {
  try {
    const {
  customerName,
  restaurantName,
  pickupAddress,
  pickupLocation,
  dropoffAddress,
  fee,
} = req.body;

    const order = await Order.create({
  orderNumber: `ORD-${Date.now()}`,
  customerName,
  restaurantName,
  pickupAddress,
  pickupLocation: req.body.pickupLocation,
  dropoffAddress,
  fee,
});


const nearbyCouriers =
  await Courier.find({
    online: true,
    location: {
      $near: {
        $geometry: order.pickupLocation,
        $maxDistance: 50000,
      },
    },
  });

console.log(
  "Pickup Location:",
  JSON.stringify(order.pickupLocation)
);

console.log(
  "Nearby Couriers Found:",
  nearbyCouriers
);


const allCouriers =
  await Courier.find({});

console.log(
  "ALL COURIERS:"
);

allCouriers.forEach(c => {

  console.log({
    email: c.email,
    online: c.online,
    location: c.location,
  });

});


for (const courier of nearbyCouriers) {

  console.log(
    "Courier DB ID:",
    courier._id.toString()
  );

  console.log(
    "Connected Couriers Map:",
    [...connectedCouriers.entries()]
  );

  const socketId =
    connectedCouriers.get(
      courier._id.toString()
    );

  console.log(
    "Socket Found:",
    socketId
  );

  if (socketId) {

  order.assignedCouriers.push(
  courier._id
);

await order.save();

  io.to(socketId).emit(
    "new-order",
    order
  );




  if (courier.expoPushToken) {
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: courier.expoPushToken,
        sound: "default",
        title: "🚚 New Delivery Available",
        body: `${order.restaurantName}\nFee: ₦${order.fee}`,
        data: {
          orderId: order._id.toString(),
          screen: "requests",
        },
      }),
    });

    console.log(
      `Push notification sent to ${courier.email}`
    );

  } catch (err) {
    console.log("Push Notification Error");
    console.log(err);
  }
}


  




  console.log(
    "Order sent to:",
    courier.email
  );

}

}

    

    res.status(201).json(order);

  } catch (error) {
    res.status(500).json({
      message: "Server Error",
    });
  }
};

/* GET PENDING ORDERS */
export const getPendingOrders = async (req, res) => {

  console.log("========== GET PENDING ==========");
  console.log("USER:", req.user);

  try {

    console.log("Before query...");

    const orders = await Order.find({
  status: "pending",
  assignedCouriers: req.user.id,
});

    console.log("After query...");
    console.log(orders);

    return res.json(orders);

  } catch (err) {

    console.log("ERROR OCCURRED");
    console.log(err);

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
        return res
          .status(404)
          .json({
            message:
              "Order not found",
          });
      }


      
      const existingActiveOrder =
  await Order.findOne({
    courier: req.user.id,
    status: {
      $in: [
        "accepted",
        "heading_to_restaurant",
        "arrived_restaurant",
        "picked_up",
        "on_the_way",
      ],
    },
  });

  
console.log(
  "Existing Active Order:",
  existingActiveOrder
);


if (existingActiveOrder) {

  console.log(
    "BLOCKED: Active order found",
    existingActiveOrder._id
  );

  return res.status(400).json({
    message:
      "Complete your current delivery before accepting a new one",
  });
}
      

      if (order.status !== "pending") {

  console.log(
    "BLOCKED: Order status is",
    order.status
  );

  return res.status(400).json({
    message: "Order already accepted",
  });
}






      order.status =
        "accepted";

      order.courier =
        req.user.id;

      await order.save();

      for (const courierId of order.assignedCouriers) {

  if (
    courierId.toString() !==
    req.user.id
  ) {

    const socketId =
      connectedCouriers.get(
        courierId.toString()
      );

    if (socketId) {

      io.to(socketId).emit(
        "order-accepted",
        order._id
      );

    }

  }

}

      res.status(200).json({
        message:
          "Order accepted",
        order,
      });

    } catch (error) {
      res.status(500).json({
        message:
          "Server Error",
      });
    }
  };

  export const updateOrderStatus =
  async (req, res) => {
    try {
      const { status } =
        req.body;

      const order =
        await Order.findById(
          req.params.id
        );

      if (!order) {
        return res
          .status(404)
          .json({
            message:
              "Order not found",
          });
      }

      const allowedStatuses = [
        "accepted",
        "heading_to_restaurant",
        "arrived_restaurant",
        "picked_up",
        "on_the_way",
        "delivered",
      ];

      if (
        !allowedStatuses.includes(
          status
        )
      ) {
        return res
          .status(400)
          .json({
            message:
              "Invalid status",
          });
      }

      // Prevent duplicate delivery payment
const alreadyDelivered =
  order.status === "delivered";

order.status =
  status;

await order.save();

/* PAY COURIER WHEN ORDER IS DELIVERED */
if (
  status === "delivered" &&
  !alreadyDelivered
) {
  const courier =
    await Courier.findById(
      order.courier
    );

  if (courier) {

    courier.completedOrders += 1;

    courier.wallet.available +=
      order.fee;

    courier.wallet.today +=
      order.fee;

    courier.wallet.weekly +=
      order.fee;

    courier.wallet.monthly +=
      order.fee;

    courier.wallet.totalEarned +=
      order.fee;

    courier.transactions.unshift({
      type: "delivery",
      amount: order.fee,
      status: "Completed",
      date: new Date(),
    });

    await courier.save();
  }
}

res.status(200).json({
  message:
    "Order updated",
  order,
});

    } catch (error) {
      res.status(500).json({
        message:
          "Server Error",
      });
    }
  };


  export const getActiveOrder =
  async (req, res) => {
    try {

      const order =
  await Order.findOne({
    courier: req.user.id,
    status: {
      $nin: [
        "delivered",
        "cancelled",
      ],
    },
  });


      if (!order) {
        return res
          .status(200)
          .json(null);
      }

      res.status(200).json(
        order
      );

    } catch (error) {
      res.status(500).json({
        message:
          "Server Error",
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


  export const rejectOrder =
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

      order.status = "pending";
order.courier = null;

// Remove this courier from the assigned list
order.assignedCouriers =
  order.assignedCouriers.filter(
    id => id.toString() !== req.user.id
  );

await order.save();

      res.status(200).json({
        message:
          "Order rejected",
      });

    } catch (error) {

      res.status(500).json({
        message:
          "Failed to reject order",
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
          message:
            "Order not found",
        });
      }

      if (
        order.status === "delivered"
      ) {
        return res.status(400).json({
          message:
            "Delivered orders cannot be cancelled",
        });
      }

order.status =
  "cancelled";

order.expiresAt = null;

await order.save();

if (order.courier) {

  const socketId =
    connectedCouriers.get(
      order.courier.toString()
    );

  if (socketId) {

    io.to(socketId).emit(
      "order-cancelled",
      {
        orderId: order._id,
      }
    );
  }
}


      res.status(200).json({
        message:
          "Order cancelled",
        order,
      });

    } catch (error) {

      res.status(500).json({
        message:
          "Failed to cancel order",
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
