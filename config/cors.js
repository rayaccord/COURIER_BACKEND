const configured = (
  process.env.CORS_ORIGINS || ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOrigins =
  configured.length === 0 ||
  configured.includes("*")
    ? "*"
    : configured;

export default corsOrigins;
