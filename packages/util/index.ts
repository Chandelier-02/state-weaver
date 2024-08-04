import {
  CRDTCompatibleValue,
  CRDTCompatibleArray,
  CRDTCompatiblePojo,
} from "@crdt-wrapper/shared-types";

export function isJSONArray(v: CRDTCompatibleValue): v is CRDTCompatibleArray {
  return Array.isArray(v);
}

export function isJSONObject(v: CRDTCompatibleValue): v is CRDTCompatiblePojo {
  return !isJSONArray(v) && typeof v === "object";
}

export function isString(v: CRDTCompatibleValue): v is string {
  return typeof v === "string";
}

export function isJSONPrimitive(
  v: CRDTCompatibleValue
): v is string | number | boolean | null {
  const t = typeof v;
  return t === "number" || t === "boolean" || v === null;
}
