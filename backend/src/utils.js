function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function asPositiveInt(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

module.exports = { asyncHandler, asPositiveInt, normalizeEmail };
