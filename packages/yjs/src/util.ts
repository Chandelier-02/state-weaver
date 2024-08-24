import * as Y from "yjs";
import { JsonArray, JsonObject, JsonPrimitive } from "type-fest";
import {
  isJsonArray,
  isJsonObject,
  isJsonPrimitive,
  IllegalValueError,
} from "../../shared/src/index.js";

/**
 * Okay, so values of an object can be defined as constants
 */

export function createYTypes(
  value: unknown
): Y.Map<any> | Y.Array<any> | Y.Text | JsonPrimitive {
  if (isJsonObject(value)) {
    const yMap = new Y.Map();
    for (const [key, subValue] of Object.entries(value)) {
      yMap.set(key, createYTypes(subValue));
    }
    return yMap;
  } else if (isJsonArray(value)) {
    const yArray = new Y.Array();
    for (const entry of value) {
      yArray.push([createYTypes(entry)]);
    }
    return yArray;
  } else if (isJsonPrimitive(value)) {
    if (typeof value === "string") {
      return new Y.Text(value);
    }
    return value;
  } else {
    throw new IllegalValueError(value);
  }
}

export function createYTypesFromObject(object: JsonObject): Y.Map<any> {
  const yMap = new Y.Map();
  for (const [key, subValue] of Object.entries(object)) {
    if (isJsonObject(subValue)) {
      yMap.set(key, createYTypesFromObject(subValue));
    } else if (isJsonArray(subValue)) {
      yMap.set(key, createYTypesFromArray(subValue));
    } else if (isJsonPrimitive(subValue)) {
      yMap.set(key, subValue);
    } else {
      throw new IllegalValueError(subValue);
    }
  }
  return yMap;
}

export function createYTypesFromArray(array: JsonArray): Y.Array<any> {
  const yArray = new Y.Array();
  for (const value of array) {
    if (isJsonObject(value)) {
      yArray.push([createYTypesFromObject(value)]);
    } else if (isJsonArray(value)) {
      yArray.push([createYTypesFromArray(value)]);
    } else if (isJsonPrimitive(value)) {
      yArray.push([value]);
    } else {
      throw new IllegalValueError(value);
    }
  }
  return yArray;
}
