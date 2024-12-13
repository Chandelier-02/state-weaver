import * as Y from "yjs";
import { JsonObject, JsonPrimitive } from "type-fest";
import {
  isJsonArray,
  isJsonObject,
  isJsonPrimitive,
  IllegalValueError,
} from "../../shared/src/index.js";
import { Patch } from "mutative";
import createStringPatches, { Change } from "textdiff-create";

export function isYTextPath(
  yTextPaths: Set<string>,
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

  return yTextPaths.has(path);
}

export function createYTypes<T extends JsonObject>(
  value: unknown,
  yTextPaths: Set<string>,
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
      if (isYTextPath(yTextPaths, currentPathParts)) {
        return new Y.Text(value);
      }
    }
    return value;
  } else {
    throw new IllegalValueError(value);
  }
}

export function applyPatch<T extends JsonObject>(
  yMap: Y.Map<any>,
  patch: Patch,
  yTextPaths: Set<string>
): void {
  let { path, op, value } = patch;

  if (typeof path === "string") {
    path = [path];
  }

  if (path.length === 0) {
    if (op !== "replace") {
      throw new Error("Cannot add or remove elements from top level object!");
    }

    yMap.clear();
    for (const k in value) {
      const yType = createYTypes<T>(value[k], yTextPaths, [...path, k]);
      yMap.set(k, yType);
    }
    return;
  }

  let base: Y.Map<any> | Y.Array<any> = yMap;
  for (let i = 0; i < path.length - 1; i++) {
    const step = path[i];
    base = base.get(step as never);
  }

  const property = path[path.length - 1];

  if (base instanceof Y.Map && typeof property === "string") {
    switch (op) {
      case "add":
        base.set(property, createYTypes(value, yTextPaths, path));
        break;
      case "replace":
        if (typeof value === "string") {
          if (isYTextPath(yTextPaths, path)) {
            const yText = base.get(property) as Y.Text | undefined;
            if (!yText) {
              base.set(property, createYTypes(value, yTextPaths, path));
              break;
            }

            const string = yText.toJSON();
            const patches = createStringPatches(string, value);
            applyStringPatches(yText, patches);
          } else {
            base.set(property, createYTypes(value, yTextPaths, path));
          }
        } else {
          base.set(property, createYTypes(value, yTextPaths, path));
        }
        break;
      case "remove":
        base.delete(property);
        break;
    }
  } else if (base instanceof Y.Array && typeof property === "number") {
    base = base as Y.Array<any>;
    switch (op) {
      case "add":
        base.insert(property, [createYTypes(value, yTextPaths, path)]);
        break;
      case "replace":
        base.delete(property);
        base.insert(property, [createYTypes(value, yTextPaths, path)]);
        break;
      case "remove":
        base.delete(property);
        break;
    }
  } else if (base instanceof Y.Array && property === "length") {
    if (value < base.length) {
      const diff = base.length - value;
      base.delete(value, diff);
    }
  } else {
    throw new Error(
      `Cannot handle patch ${patch} on instance of ${base.constructor.name}`
    );
  }
}

function applyStringPatches(target: Y.Text, patches: Change[]): void {
  let cursor = 0;
  for (const change of patches) {
    if (change[0] === -1) {
      target.delete(cursor, change[1]);
    } else if (change[0] === 0) {
      cursor += change[1];
    } else if (change[0] === 1) {
      target.insert(cursor, change[1]);
      cursor += change[1].length;
    }
  }
}

export function isEmptyUpdate(update: Uint8Array): boolean {
  const v1EmptyUpdate = [0, 0];
  const v2EmptyUpdate = [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0];
  if (update.length < v1EmptyUpdate.length) return true;
  else if (
    update.length === v1EmptyUpdate.length &&
    update.every((val, idx) => val === v1EmptyUpdate[idx])
  )
    return true;
  else if (
    update.length === v2EmptyUpdate.length &&
    update.every((val, idx) => val === v2EmptyUpdate[idx])
  )
    return true;
  else return false;
}
