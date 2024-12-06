import * as Y from "yjs";
import { JsonObject, JsonPrimitive } from "type-fest";
import {
  isJsonArray,
  isJsonObject,
  isJsonPrimitive,
  IllegalValueError,
} from "../../shared/src/index.js";
import { StringPropertyPath } from "./types.js";

export function isYTextPath<T extends JsonObject>(
  yTextPaths: Set<StringPropertyPath<T>>,
  pathParts: (string | number)[]
): boolean {
  let path = "";
  for (const part of pathParts) {
    if (typeof part === "number") {
      path += "[]";
    } else {
      path += path ? `.${part}` : part;
    }
  }

  return yTextPaths.has(path as StringPropertyPath<T>);
}

export function createYTypes<T extends JsonObject>(
  value: unknown,
  yTextPaths: Set<StringPropertyPath<T>>,
  currentPathParts: (string | number)[] = []
): Y.Map<any> | Y.Array<any> | Y.Text | JsonPrimitive {
  if (isJsonObject(value)) {
    const yMap = new Y.Map();
    for (const [key, subValue] of Object.entries(value)) {
      currentPathParts.push(key);
      yMap.set(key, createYTypes<T>(subValue, yTextPaths, currentPathParts));
      currentPathParts.pop();
    }
    return yMap;
  } else if (isJsonArray(value)) {
    const yArray = new Y.Array();
    for (let i = 0; i < value.length; i++) {
      currentPathParts.push(i);
      yArray.push([createYTypes<T>(value[i], yTextPaths, currentPathParts)]);
      currentPathParts.pop();
    }
    return yArray;
  } else if (isJsonPrimitive(value)) {
    if (typeof value === "string") {
      if (isYTextPath<T>(yTextPaths, currentPathParts)) {
        return new Y.Text(value);
      }
    }
    return value;
  } else {
    throw new IllegalValueError(value);
  }
}
