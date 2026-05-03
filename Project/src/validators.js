const STATUS_VALUES = ["todo", "in_progress", "done"];

function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return value;
}

function isValidStatus(value) {
  return STATUS_VALUES.includes(value);
}

module.exports = {
  STATUS_VALUES,
  isNonEmpty,
  isValidEmail,
  normalizeDate,
  isValidStatus,
};
