const EARTH_RADIUS_M = 6371e3;

const ROAD_FACTOR = 1.3;

const SPEED_KMH = {
  bicycle: 12,
  bike: 22,
  car: 20,
  van: 18,
};

const toRad = (degrees) =>
  (degrees * Math.PI) / 180;

export const isCoordinate = (lat, lng) =>
  typeof lat === "number" &&
  typeof lng === "number" &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180 &&
  !(lat === 0 && lng === 0);

export const pointOf = (location) => {
  const coordinates =
    location?.coordinates;

  if (
    !Array.isArray(coordinates) ||
    coordinates.length !== 2
  ) {
    return null;
  }

  const [lng, lat] = coordinates;

  return isCoordinate(lat, lng)
    ? { lat, lng }
    : null;
};

export const distanceMeters = (a, b) => {
  if (!a || !b) {
    return null;
  }

  const dLat = toRad(b.lat - a.lat);

  const dLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) *
      Math.cos(toRad(b.lat)) *
      Math.sin(dLng / 2) ** 2;

  return Math.round(
    EARTH_RADIUS_M *
      2 *
      Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  );
};

export const etaSeconds = (
  meters,
  vehicle
) => {
  if (meters === null || meters === undefined) {
    return null;
  }

  const speed =
    SPEED_KMH[vehicle] || SPEED_KMH.bike;

  return Math.round(
    (meters * ROAD_FACTOR) / (speed / 3.6)
  );
};
