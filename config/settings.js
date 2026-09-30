const number = (
  name,
  fallback
) => {
  const value =
    Number(process.env[name]);

  return Number.isFinite(value) && value > 0
    ? value
    : fallback;
};

const settings = {
  assignmentTimeoutSeconds:
    number("ASSIGNMENT_TIMEOUT_SECONDS", 60),

  locationStaleSeconds:
    number("LOCATION_STALE_SECONDS", 120),

  defaultRadiusKm:
    number("DEFAULT_RADIUS_KM", 10),

  maxRadiusKm:
    number("MAX_RADIUS_KM", 50),

  geofenceMeters:
    number("GEOFENCE_METERS", 100),

  locationEventSeconds:
    number("LOCATION_EVENT_INTERVAL_SECONDS", 15),

  webhookTimeoutMs:
    number("WEBHOOK_TIMEOUT_SECONDS", 10) * 1000,

  webhookMaxRetryHours:
    number("WEBHOOK_MAX_RETRY_HOURS", 24),

  workerIntervalMs:
    number("WORKER_INTERVAL_SECONDS", 5) * 1000,
};

export default settings;
