import crypto from "crypto";

const safeCompare = (
  a,
  b
) => {
  const bufferA =
    Buffer.from(a);

  const bufferB =
    Buffer.from(b);

  if (
    bufferA.length !==
    bufferB.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    bufferA,
    bufferB
  );
};

const apiKeyMiddleware = (
  req,
  res,
  next
) => {
  const apiKey =
    process.env.COURIER_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      message:
        "COURIER_API_KEY is not configured",
    });
  }

  const authHeader =
    req.headers.authorization;

  if (
    !authHeader ||
    !authHeader.startsWith("Bearer ")
  ) {
    return res.status(401).json({
      message: "Not authorized",
    });
  }

  const token =
    authHeader.split(" ")[1];

  if (
    !token ||
    !safeCompare(token, apiKey)
  ) {
    return res.status(401).json({
      message: "Invalid token",
    });
  }

  next();
};

export default apiKeyMiddleware;
