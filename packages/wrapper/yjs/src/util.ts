import {
  CRDTCompatibleArray,
  CRDTCompatiblePojo,
  CRDTCompatibleValue,
  JSONPrimitive,
} from "@crdt-wrapper/shared-types";
import { isJSONArray, isJSONObject, isJSONPrimitive } from "@crdt-wrapper/util";
import * as Y from "yjs";
import { SupportedSource } from "./types";

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

export function toPojo(
  v: SupportedSource | CRDTCompatibleValue
): CRDTCompatibleValue {
  if (v instanceof Y.Map || v instanceof Y.Array || v instanceof Y.Text) {
    return v.toJSON() as CRDTCompatiblePojo | CRDTCompatibleArray | string;
  } else {
    return v;
  }
}

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

export function applyJsonArray(
  dest: Y.Array<unknown>,
  source: CRDTCompatibleArray
) {
  dest.push(source.map(toYDataType));
}

export function applyJsonObject(
  dest: Y.Map<unknown>,
  source: CRDTCompatiblePojo
) {
  Object.entries(source).forEach(([k, v]) => {
    dest.set(k, toYDataType(v));
  });
}

export function applyJsonText(dest: Y.Text, source: string) {
  dest.insert(0, source);
}
