import { CRDTToPojoBinder } from "@crdt-wrapper/binder-interface";
import {
  CRDTCompatibleArray,
  CRDTCompatiblePojo,
  CRDTCompatibleValue,
} from "@crdt-wrapper/shared-types";
import * as Y from "yjs";
import { Patch, Patches, create } from "mutative";
import createPatch, { Change } from "textdiff-create";

export type SupportedSource = Y.Map<any> | Y.Array<any> | Y.Text;

export function isJSONArray(v: CRDTCompatibleValue): v is CRDTCompatibleArray {
  return Array.isArray(v);
}

export function isJSONObject(v: CRDTCompatibleValue): v is CRDTCompatiblePojo {
  return !isJSONArray(v) && typeof v === "object";
}

function isString(v: CRDTCompatibleValue): v is string {
  return typeof v === "string";
}

export class YjsBinder<
  T extends CRDTCompatibleArray | CRDTCompatiblePojo | string
> implements CRDTToPojoBinder<T>
{
  readonly #source: SupportedSource;
  #snapshot: T;
  #observeDeepFunc = (events: Y.YEvent<any>[]) => {
    this.#snapshot = this.#applyEvents(events);
  };

  constructor(
    source: SupportedSource,
    yjsUpdateHandler?: (update: Uint8Array) => void
  ) {
    this.#source = source;
    this.#source.observeDeep(this.#observeDeepFunc);
    this.#snapshot = source.toJSON() as T;
    if (yjsUpdateHandler) {
      this.#source.doc?.on("update", yjsUpdateHandler);
    }
  }

  get snapshot(): T {
    return this.#snapshot;
  }

  public unbind(): void {
    this.#source.unobserveDeep(this.#observeDeepFunc);
  }

  public update(changeFn: (snapshot: T) => void): void {
    this.#source.doc?.transact(() => {
      this.#applyUpdate(this.#source, this.#snapshot, changeFn);
    });
  }

  #applyEvents(events: Y.YEvent<any>[]): T {
    return {} as T;
  }

  #applyUpdate(
    source: SupportedSource,
    snapshot: T,
    changeFn: (snapshot: T) => void
  ) {
    if (typeof snapshot === "string" && source instanceof Y.Text) {
      const changes = createPatch(
        snapshot,
        ((): string => {
          changeFn(snapshot);
          return snapshot;
        })()
      );
      this.#applyStringChanges(source, changes);
      return;
    }

    const [, patches] = create(snapshot, changeFn, { enablePatches: true });
    for (const patch of patches) {
      this.#applyPatch(source, patch);
    }
  }

  #applyPatch(target: SupportedSource, patch: Patch) {
    const { path, op, value } = patch;
    if (!Array.isArray(path)) {
      if (op !== "replace") {
        throw new Error("Invalid patch.");
      }
      if (target instanceof Y.Map && isJSONObject(value)) {
        target.clear();
        for (const k in value) {
          target.set(k, toYDataType(value[k]));
        }
      } else if (target instanceof Y.Array && isJSONArray(value)) {
        target.delete(0, target.length);
        target.push(value.map(toYDataType));
      } else if (target instanceof Y.Text && isString(value)) {
        target.delete(0, target.length);
        target.insert(0, value);
      }
    }
  }

  #applyStringChanges(yText: Y.Text, changes: Change[]): void {
    let cursor = 0;
    for (const change of changes) {
      if (change[0] === -1) {
        yText.delete(cursor, change[1]);
      } else if (change[0] === 0) {
        cursor += change[1];
      } else if (change[0] === 1) {
        yText.insert(cursor, change[1]);
        cursor += change[1].length;
      }
    }
  }

  #toYDataType(v: CRDTCompatibleValue): SupportedSource | undefined {
    if (isJSONPrimitiveWithoutString(v)) {
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
}
