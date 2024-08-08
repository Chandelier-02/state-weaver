import {
  CRDTCompatibleArray,
  CRDTCompatiblePojo,
  CRDTCompatibleValue,
  JSONPrimitive,
} from "@crdt-wrapper/shared-types";
import { isJSONArray, isJSONObject, isJSONPrimitive } from "@crdt-wrapper/util";
import * as Y from "yjs";
import { SupportedSource } from "./types";

/**
 * Asserts that the provided Yjs event is supported.
 * Throws an error if the event is not one of the supported types.
 *
 * Supported events include:
 * - Y.YMapEvent
 * - Y.YArrayEvent
 * - Y.YTextEvent (with a path length greater than 1)
 *
 * @param event - The Yjs event to check.
 * @throws {Error} If the event is not supported.
 */
export function assertSupportedEvent(event: Y.YEvent<any>): void {
  if (
    !(
      event instanceof Y.YMapEvent ||
      event instanceof Y.YArrayEvent ||
      event instanceof Y.YTextEvent
    )
  ) {
    throw new Error(
      `Cannot handle change events from ${event.constructor.name}`
    );
  }
}

/**
 * Asserts that the provided source and object are valid for binding.
 * Throws an error if the source or object is not compatible.
 *
 * The function checks:
 * - The type of the object (must be an object or array)
 * - For arrays, the source must be a Y.Array
 * - For objects, the source must be a Y.Map and the object must be a plain object (POJO)
 *
 * @param source - The Yjs type source to check.
 * @param object - The object to validate.
 * @throws {Error} If the object or source is invalid.
 */
export function assertSourceAndPojoAreValid(
  source: SupportedSource,
  object: CRDTCompatiblePojo | CRDTCompatibleArray
): void {
  if (typeof object !== "object") {
    throw new Error("Invalid argument. Initial object must be of type object.");
  }

  if (Array.isArray(object)) {
    if (!(source instanceof Y.Array)) {
      throw new Error(
        "Invalid argument. For an array, the source must be a Y.Array."
      );
    }
  } else {
    if (!isPojo(object)) {
      throw new Error("Invalid argument. Initial object must be a POJO.");
    }
    if (!(source instanceof Y.Map)) {
      throw new Error(
        "Invalid argument. For an object, the source must be a Y.Map."
      );
    }
  }
}

/**
 * Checks if the given object is a plain JavaScript object (POJO).
 *
 * @param object - The object to check.
 * @returns True if the object is a POJO, otherwise false.
 */
function isPojo(object: unknown): object is CRDTCompatiblePojo {
  return (
    object !== null &&
    typeof object === "object" &&
    [null, Object.prototype].includes(Object.getPrototypeOf(object))
  );
}

/**
 * Converts a Yjs shared type or CRDT-compatible value to a plain JavaScript object.
 * This function converts Yjs shared types like Y.Map, Y.Array, and Y.Text to their equivalent JavaScript objects.
 *
 * @param v - The Yjs shared type or CRDT-compatible value to convert.
 * @returns The plain JavaScript object representation of the provided value.
 */
export function toPojo(
  v: SupportedSource | CRDTCompatibleValue
): CRDTCompatibleValue {
  if (v instanceof Y.Map || v instanceof Y.Array || v instanceof Y.Text) {
    return v.toJSON() as CRDTCompatiblePojo | CRDTCompatibleArray | string;
  } else {
    return v;
  }
}

/**
 * Converts a CRDT-compatible value to its corresponding Yjs data type.
 * This function handles the conversion of JSON primitives, arrays, objects, and strings to Yjs types.
 *
 * @param v - The CRDT-compatible value to convert.
 * @returns The corresponding Yjs data type, or undefined if the conversion is not possible.
 */
export function toYDataType(
  v: CRDTCompatibleValue
): SupportedSource | Y.Text | JSONPrimitive | undefined {
  if (isJSONPrimitive(v)) {
    return v;
  } else if (typeof v === "string") {
    const text = new Y.Text();
    applyJsonText(text, v);
    return text;
  } else if (isJSONArray(v)) {
    const arr = new Y.Array();
    applyJsonArray(arr, v);
    return arr;
  } else if (isJSONObject(v)) {
    const map = new Y.Map();
    applyJsonObject(map, v);
    return map;
  } else {
    return undefined;
  }
}

/**
 * Applies the contents of a CRDT-compatible array to a Yjs Y.Array.
 * This function maps each element of the array to its corresponding Yjs data type and pushes it to the destination Y.Array.
 *
 * @param dest - The Yjs Y.Array to which the contents will be applied.
 * @param source - The CRDT-compatible array whose contents will be mapped and applied.
 */
export function applyJsonArray(
  dest: Y.Array<unknown>,
  source: CRDTCompatibleArray
) {
  dest.push(source.map(toYDataType));
}

/**
 * Applies the contents of a CRDT-compatible object to a Yjs Y.Map.
 * This function maps each key-value pair of the object to its corresponding Yjs data type and sets it in the destination Y.Map.
 *
 * @param dest - The Yjs Y.Map to which the contents will be applied.
 * @param source - The CRDT-compatible object whose contents will be mapped and applied.
 */
export function applyJsonObject(
  dest: Y.Map<unknown>,
  source: CRDTCompatiblePojo
) {
  Object.entries(source).forEach(([k, v]) => {
    dest.set(k, toYDataType(v));
  });
}

/**
 * Applies the contents of a string to a Yjs Y.Text.
 * This function inserts the provided string into the destination Y.Text starting at the beginning.
 *
 * @param dest - The Yjs Y.Text to which the contents will be applied.
 * @param source - The string whose contents will be inserted.
 */
export function applyJsonText(dest: Y.Text, source: string) {
  dest.insert(0, source);
}
