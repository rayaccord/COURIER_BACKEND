import bcrypt from "bcryptjs";
import Courier from "../models/Courier.js";
import PendingCourier from "../models/PendingCourier.js";
import generateCode from "../utils/generateCode.js";
import sendEmail from "../utils/sendEmail.js";
import generateToken from "../utils/generateToken.js";

/* ================= REGISTER COURIER ================= */
export const registerCourier = async (req, res) => {
  try {
    const {
  fullName,
  email,
  phone,
  city,
  homeAddress,
  vehicle,
  vehicleRegistration,
  governmentIdType,
  password,
} = req.body;

    /* VALIDATION */
   const governmentIdFront =
  req.files?.governmentIdFront?.[0]?.filename || "";

const governmentIdBack =
  req.files?.governmentIdBack?.[0]?.filename || "";

const vehiclePhoto =
  req.files?.vehiclePhoto?.[0]?.filename || "";

if (
  !fullName ||
  !email ||
  !phone ||
  !city ||
  !homeAddress ||
  !vehicle ||
  !vehicleRegistration ||
  !governmentIdType ||
  !password ||
  !governmentIdFront ||
  !governmentIdBack ||
  !vehiclePhoto
) {
  return res.status(400).json({
    message: "All fields are required",
  });
}

/* CHECK EXISTING COURIER */
const existingCourier =
  await Courier.findOne({ email });

if (existingCourier) {
  return res.status(400).json({
    message: "Courier already exists",
  });
}

/* CHECK PENDING COURIER */
const existingPending =
  await PendingCourier.findOne({
    email,
  });

if (existingPending) {
  await PendingCourier.deleteOne({
    _id: existingPending._id,
  });
}
    /* HASH PASSWORD */
    const salt = await bcrypt.genSalt(10);

    const hashedPassword = await bcrypt.hash(password, salt);

    /* GENERATE OTP */
    const verificationCode = generateCode();

    console.log(
  "Verification Code:",
  verificationCode
);

    /* CREATE COURIER */
/* SAVE TEMPORARY COURIER */
await PendingCourier.create({
  fullName,
  email,
  phone,
  city,
  homeAddress,
  vehicle,
  vehicleRegistration,
  governmentIdType,
  governmentIdFront,
  governmentIdBack,
  vehiclePhoto,
  password: hashedPassword,
  verificationCode,
  verificationCodeExpires:
    Date.now() + 10 * 60 * 1000,
});


/* SEND EMAIL */
await sendEmail(
  email,
  "HOOKS FOOD - Verify Your Courier Account",
  `
    <div style="font-family: Arial; padding:20px;">
      <h2 style="color:#f97316;">
        Welcome to HOOKS FOOD 🚴
      </h2>

      <p>
        Thank you for joining the HOOKS FOOD courier network.
      </p>

      <p>
        Use the verification code below to activate your rider account:
      </p>

      <div style="
        font-size:32px;
        font-weight:bold;
        letter-spacing:6px;
        margin:20px 0;
        color:#ea580c;
      ">
        ${verificationCode}
      </div>

      <p>
        This code will expire in
        <strong>10 minute</strong>.
      </p>

      <p>
        If you did not create this account,
        please ignore this email.
      </p>

      <hr />

      <small style="color:gray;">
        HOOKS FOOD Courier Team
      </small>
    </div>
  `
);

    res.status(201).json({
  message:
    "Verification code sent successfully",
});

  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

/* ================= VERIFY COURIER ================= */


export const verifyCourier = async (req, res) => {
  try {

    const { email, code } = req.body;

    const pendingCourier =
      await PendingCourier.findOne({
        email,
      });

    if (!pendingCourier) {
      return res.status(404).json({
        message:
          "Verification request not found",
      });
    }

    if (
      pendingCourier.verificationCode !==
      code
    ) {
      return res.status(400).json({
        message:
          "Invalid verification code",
      });
    }

    if (
      pendingCourier.verificationCodeExpires <
      Date.now()
    ) {
      return res.status(400).json({
        message:
          "Verification code expired",
      });
    }

   const courier = await Courier.create({
  fullName: pendingCourier.fullName,

  email: pendingCourier.email,

  phone: pendingCourier.phone,

  city: pendingCourier.city,

  homeAddress: pendingCourier.homeAddress,

  vehicle: pendingCourier.vehicle,

  vehicleRegistration:
    pendingCourier.vehicleRegistration,

  governmentIdType:
    pendingCourier.governmentIdType,

  governmentIdFront:
    pendingCourier.governmentIdFront,

  governmentIdBack:
    pendingCourier.governmentIdBack,

  vehiclePhoto:
    pendingCourier.vehiclePhoto,

  password: pendingCourier.password,

  isVerified: true,
});

    await PendingCourier.deleteOne({
      _id: pendingCourier._id,
    });

    const token =
      generateToken(courier._id);

    res.status(200).json({
      message:
        "Account created successfully",

      token,

      courier: {
  id: courier._id,
  fullName: courier.fullName,
  email: courier.email,
  phone: courier.phone,
  city: courier.city,
  homeAddress: courier.homeAddress,
    vehicle: courier.vehicle,
  vehicleRegistration:
    courier.vehicleRegistration,
  governmentIdType: courier.governmentIdType,
    governmentIdFront:
    courier.governmentIdFront,
  governmentIdBack:
    courier.governmentIdBack,
  vehiclePhoto:
    courier.vehiclePhoto,
},
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      message:
        "Verification failed",
    });

  }
};


/* LOGIN COURIER */
export const loginCourier = async (req, res) => {
  try {
    const { email, password } = req.body;

    /* FIND USER */
    const courier = await Courier.findOne({ email });

    if (!courier) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    /* CHECK VERIFIED */
    if (!courier.isVerified) {
      return res.status(401).json({
        message: "Please verify your account first",
      });
    }

    /* CHECK PASSWORD */
    const isMatch = await bcrypt.compare(
      password,
      courier.password
    );

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }


    courier.online = false;

await courier.save();


    /* TOKEN */
    const token = generateToken(courier._id);

    res.status(200).json({
      message: "Login successful",

      token,

     courier: {
  id: courier._id,
  fullName: courier.fullName,
  email: courier.email,
  phone: courier.phone,
  city: courier.city,
  homeAddress:
  courier.homeAddress,
  vehicle: courier.vehicle,
  vehicleRegistration:
    courier.vehicleRegistration,
  governmentIdType:
  courier.governmentIdType,
  governmentIdFront:
    courier.governmentIdFront,
  governmentIdBack:
    courier.governmentIdBack,
  vehiclePhoto:
    courier.vehiclePhoto,
},
    });

  } catch (error) {
  console.error("LOGIN ERROR:");
  console.error(error);

  res.status(500).json({
    message: "Server Error",
    error: error.message,
  });
}
};

/* ================= FORGOT PASSWORD ================= */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const courier = await Courier.findOne({ email });

    if (!courier) {
      return res.status(404).json({
        message: "Courier not found",
      });
    }

    const resetCode = generateCode();

    courier.resetPasswordCode = resetCode;

    courier.resetPasswordCodeExpires =
      Date.now() + 10 * 60 * 1000;

    await courier.save();

    /* SEND EMAIL */
    await sendEmail(
      email,
      "HOOKS FOOD - Password Reset Code",
      `
        <div style="font-family: Arial; padding:20px;">
          <h2 style="color:#f97316;">
            Password Reset Request 🔐
          </h2>

          <p>
            We received a request to reset your
            HOOKS FOOD courier password.
          </p>

          <p>
            Use the code below to continue:
          </p>

          <div style="
            font-size:32px;
            font-weight:bold;
            letter-spacing:6px;
            margin:20px 0;
            color:#ea580c;
          ">
            ${resetCode}
          </div>

          <p>
            This code expires in
            <strong>10 minutes</strong>.
          </p>

          <p>
            If you did not request this,
            please ignore this email.
          </p>

          <hr />

          <small style="color:gray;">
            HOOKS FOOD Courier Team
          </small>
        </div>
      `
    );

    res.status(200).json({
      message:
        "Reset code sent to your email",
    });

  } catch (error) {
    res.status(500).json({
      message: "Server Error",
    });
  }
};

/* ================= VERIFY RESET CODE ================= */
export const verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    const courier = await Courier.findOne({ email });

    if (!courier) {
      return res.status(404).json({
        message: "Courier not found",
      });
    }

    if (
      courier.resetPasswordCode !== code
    ) {
      return res.status(400).json({
        message: "Invalid reset code",
      });
    }

    if (
      courier.resetPasswordCodeExpires <
      Date.now()
    ) {
      return res.status(400).json({
        message: "Reset code expired",
      });
    }

    res.status(200).json({
      message: "Code verified successfully",
    });

  } catch (error) {
    res.status(500).json({
      message: "Server Error",
    });
  }
};

/* ================= RESET PASSWORD ================= */
export const resetPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    const courier = await Courier.findOne({ email });

    if (!courier) {
      return res.status(404).json({
        message: "Courier not found",
      });
    }

    const salt = await bcrypt.genSalt(10);

    const hashedPassword = await bcrypt.hash(
      password,
      salt
    );

    courier.password = hashedPassword;

    courier.resetPasswordCode = null;
    courier.resetPasswordCodeExpires = null;

    await courier.save();

    res.status(200).json({
      message:
        "Password reset successful",
    });

  } catch (error) {
    res.status(500).json({
      message: "Server Error",
    });
  }
};



/* ================= RESEND VERIFICATION CODE ================= */
export const resendVerificationCode =
  async (req, res) => {
    try {

      const { email } = req.body;

      const pendingCourier =
        await PendingCourier.findOne({
          email,
        });

      if (!pendingCourier) {
        return res.status(404).json({
          message:
            "Verification request not found",
        });
      }

      const verificationCode =
        generateCode();

      pendingCourier.verificationCode =
        verificationCode;

      pendingCourier.verificationCodeExpires =
        Date.now() +
        10 * 60 * 1000;

      await pendingCourier.save();

      console.log(
        "Verification Code:",
        verificationCode
      );

      await sendEmail(
        email,
        "HOOKS FOOD - Verification Code",
        `
          <h2>Your new verification code</h2>

          <h1>${verificationCode}</h1>

          <p>
            This code expires in 10 minutes.
          </p>
        `
      );

      res.status(200).json({
        message:
          "Verification code sent successfully",
      });

    } catch (error) {

      console.log(error);

      res.status(500).json({
        message:
          "Failed to resend code",
      });

    }
  };
