import * as Y from "yjs";
import { SupportedYType } from "./types";
import { JSONArray, JSONObject, JSONValue } from "../../shared/src/types";

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

export function assertSupportedYType(yType: Y.AbstractType<any>): void {
  if (
    !(
      yType instanceof Y.Text ||
      yType instanceof Y.Array ||
      yType instanceof Y.Map
    )
  ) {
    throw new Error(`Cannot handle yType ${yType.constructor.name}`);
  }
}

export function createYTypes(
  value: any,
  yDoc: Y.Doc
): Y.AbstractType<any> | any {
  if (typeof value === "string") {
    const yText = new Y.Text();
    yText.insert(0, value);
    return yText;
  } else if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "symbol" ||
    typeof value === "bigint" ||
    value === null ||
    value === undefined
  ) {
    return value;
  } else if (Array.isArray(value)) {
    const yArray = new Y.Array();
    for (const item of value) {
      yArray.push([createYTypes(item, yDoc)]);
    }
    return yArray;
  } else if (typeof value === "object") {
    const yMap = new Y.Map();
    for (const [key, val] of Object.entries(value)) {
      yMap.set(key, createYTypes(val, yDoc));
    }
    return yMap;
  }
}

/**
 * Converts a Yjs shared type or CRDT-compatible value to a plain JavaScript object.
 * This function converts Yjs shared types like Y.Map, Y.Array, and Y.Text to their equivalent JavaScript objects.
 *
 * @param v - The Yjs shared type or CRDT-compatible value to convert.
 * @returns The plain JavaScript object representation of the provided value.
 */
export function toPojo(v: SupportedYType | JSONValue): JSONValue {
  if (v instanceof Y.Map || v instanceof Y.Array || v instanceof Y.Text) {
    return v.toJSON() as JSONObject | JSONArray | string;
  } else {
    return v;
  }
}

export function isSupportedYType(v: unknown): v is SupportedYType {
  return v instanceof Y.Map || v instanceof Y.Array || v instanceof Y.Text;
}
