// src/index.ts
function isJsonCompatible(value) {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonCompatible);
  }
  if (typeof value === "object") {
    return Object.values(value).every(isJsonCompatible);
  }
  return false;
}
function isJsonObject(value) {
  const valueIsCompatible = isJsonCompatible(value);
  if (!valueIsCompatible) {
    return false;
  }
  return typeof value === "object" && !Array.isArray(value);
}
function isJsonArray(value) {
  const valueIsCompatible = isJsonCompatible(value);
  if (!valueIsCompatible) {
    return false;
  }
  return typeof value === "object" && Array.isArray(value);
}
function isJsonPrimitive(value) {
  return typeof value === "boolean" || typeof value === "number" || typeof value === "string" || value === null;
}
var IllegalValueError = class extends Error {
  illegalValue;
  constructor(illegalValue) {
    super(`Value does not align with Json`);
    this.illegalValue = illegalValue;
    this.name = this.constructor.name;
    if ("captureStackTrace" in Error && typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
};
export {
  IllegalValueError,
  isJsonArray,
  isJsonCompatible,
  isJsonObject,
  isJsonPrimitive
};
