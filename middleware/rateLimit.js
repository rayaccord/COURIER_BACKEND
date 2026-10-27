const hits = new Map();

const rateLimit = ({ max, windowMs, message = "Too many tries. Please wait a few minutes and try again." }) => (req, res, next) => {
  const now = Date.now();
  const key = `${req.baseUrl}${req.path}|${req.ip}`;
  const entry = hits.get(key);

  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  entry.count += 1;

  if (entry.count > max) {
    res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
    return res.status(429).json({ message });
  }

  return next();
};

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
}, 60000).unref();

export default rateLimit;
