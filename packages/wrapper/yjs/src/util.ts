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
 * Asserts that the provided Yjs event is supported. Throws an error if the event is not one of the supported types.
 *
 * @param event - The Yjs event to check.
 * @throws {Error} If the event is not a Y.YMapEvent, Y.YArrayEvent, or a Y.YTextEvent with a path length greater than 1.
 */
export function assertSupportedEvent(event: Y.YEvent<any>): void {
  if (
    !(
      event instanceof Y.YMapEvent ||
      event instanceof Y.YArrayEvent ||
      (event instanceof Y.YTextEvent && event.path.length > 1)
    )
  ) {
    throw new Error(
      `Cannot handle change events from ${event.constructor.name}`
    );
  }
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
 * This function handles conversion of JSON primitives, arrays, objects, and strings to Yjs types.
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
