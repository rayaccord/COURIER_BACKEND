const KNOWN = [
  "https://hooksfoodapp.com",
  "https://www.hooksfoodapp.com",
  "https://api.hooksfoodapp.com",
  "https://getcoredispatch.cloud",
  "https://www.getcoredispatch.cloud",
  "https://api.getcoredispatch.cloud",
  "https://courier.iraynetworking.org",
];

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const configured = (
  process.env.CORS_ORIGINS || ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin && origin !== "*");

const allowed = new Set([...KNOWN, ...configured]);

const corsOrigins = (origin, callback) => {
  callback(null, !origin || allowed.has(origin) || LOCAL.test(origin));
};

export default corsOrigins;
