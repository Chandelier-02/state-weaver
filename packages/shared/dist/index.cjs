"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  IllegalValueError: () => IllegalValueError,
  isJsonArray: () => isJsonArray,
  isJsonCompatible: () => isJsonCompatible,
  isJsonObject: () => isJsonObject,
  isJsonPrimitive: () => isJsonPrimitive
});
module.exports = __toCommonJS(src_exports);
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  IllegalValueError,
  isJsonArray,
  isJsonCompatible,
  isJsonObject,
  isJsonPrimitive
});
