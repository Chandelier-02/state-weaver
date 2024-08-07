import * as Y from "yjs";
import { toPojo, toYDataType } from "./util";
import { isJSONArray, isJSONObject, isString } from "@crdt-wrapper/util";
import { create, Patch } from "mutative";
import createStringPatches, { Change } from "textdiff-create";
import {
  CRDTCompatibleArray,
  CRDTCompatiblePojo,
} from "@crdt-wrapper/shared-types";

type SubscriptionMap<T> = Map<
  keyof T,
  Set<(state: Readonly<T[keyof T]>) => void>
>;

type StateMap<T> = Map<keyof T, T[keyof T]>;

export type SupportedYType = Y.Array<any> | Y.Map<any> | Y.Text;

export type TopLevelSchema = { [key: string]: "object" | "array" | "string" };

export interface CRDTWrapper<T, U> {
  getDocState<K extends keyof T>(): Readonly<Map<K, T[K]>>;

  getSharedTypeState<K extends keyof T>(
    sharedTypeName: K
  ): Readonly<T[K]> | undefined;

  applyUpdate(update: U): void;

  update<K extends keyof T>(
    sharedTypeName: K,
    changeFn: (value: T[K]) => void
  ): void;

  update<K extends keyof T>(
    sharedTypeName: K,
    changeFn: (value: T[K]) => T[K]
  ): void;

  subscribe<K extends keyof T>(
    sharedTypeName: K,
    listener: (state: Readonly<T[K]>) => void
  ): void;

  unsubscribe<K extends keyof T>(
    sharedTypeName: K,
    listener: (state: Readonly<T[K]>) => void
  ): void;

  dispose(): void;
}

export type TopLevelPojo = {
  [key: string]: CRDTCompatibleArray | CRDTCompatiblePojo | string;
};

export class YjsDocWrapper<T extends TopLevelPojo, U extends Uint8Array>
  implements CRDTWrapper<T, U>
{
  readonly #yDoc: Y.Doc;
  readonly #subscriptions: SubscriptionMap<T>;
  readonly #state: StateMap<T>;
  readonly #observeDeepFunc =
    (sharedTypeName: keyof T) => (events: Y.YEvent<any>[]) => {
      const updatedValue = this.#applyYEvents(sharedTypeName, events);
      for (const subscription of this.#subscriptions.get(sharedTypeName)!) {
        subscription(Object.freeze(updatedValue));
      }
    };

  constructor(initialObject: T);
  constructor(fromUpdates: U[], topLevelSchema: TopLevelSchema);
  constructor(arg0: T | U[], arg1?: TopLevelSchema) {
    this.#yDoc = new Y.Doc();
    this.#subscriptions = new Map();
    this.#state = new Map();

    if (Array.isArray(arg0)) {
      for (const [key, value] of Object.entries(arg1!)) {
        this.#subscriptions.set(key, new Set());
        switch (value) {
          case "array":
            this.#yDoc.getArray(key).observeDeep(this.#observeDeepFunc(key));
            break;
          case "object":
            this.#yDoc.getMap(key).observeDeep(this.#observeDeepFunc(key));
            break;
          case "string":
            this.#yDoc.getText(key).observeDeep(this.#observeDeepFunc(key));
        }
      }
      this.#yDoc.transact(() => {
        for (const update of arg0) {
          Y.applyUpdate(this.#yDoc, update);
        }
      });
    } else {
      for (const key in arg0) {
        this.#subscriptions.set(key, new Set());
        if (typeof arg0[key] === "object" && Array.isArray(arg0[key])) {
          const yArray = this.#yDoc.getArray(key);
          yArray.observeDeep(this.#observeDeepFunc(key));
          yArray.insert(0, arg0[key]);
        } else if (typeof arg0[key] === "string") {
          const yText = this.#yDoc.getText(key);
          yText.observeDeep(this.#observeDeepFunc(key));
          yText.insert(0, arg0[key]);
        } else {
          const yMap = this.#yDoc.getMap(key);
          yMap.observeDeep(this.#observeDeepFunc(key));
          for (const [subKey, value] of Object.entries(arg0[key])) {
            yMap.set(subKey, value);
          }
        }
      }
    }
  }

  getDocState<K extends keyof T>(): Readonly<Map<K, T[K]>> {
    return Object.freeze(this.#state) as Readonly<Map<K, T[K]>>;
  }

  getSharedTypeState<K extends keyof T>(
    sharedTypeName: K
  ): Readonly<T[K]> | undefined {
    return Object.freeze(this.#state.get(sharedTypeName) as T[K] | undefined);
  }

  applyUpdate(update: U): void {
    Y.applyUpdate(this.#yDoc, update);
  }

  update<K extends keyof T>(
    sharedTypeName: K,
    changeFn: (object: T[K]) => T[K]
  ): void;
  update<K extends keyof T>(
    sharedTypeName: K,
    changeFn: (object: T[K]) => void
  ): void;
  update<K extends keyof T>(
    sharedTypeName: K,
    changeFn: ((object: string) => string) | ((object: T[K]) => void)
  ): void {
    this.#yDoc.transact(() => {
      const sharedType = this.#yDoc.share.get(
        sharedTypeName as string
      ) as SupportedYType;

      if (sharedType instanceof Y.Text) {
        this.#applyStringUpdate(
          sharedType,
          changeFn as (object: string) => string
        );
      } else if (sharedType instanceof Y.Array || sharedType instanceof Y.Map) {
        const snapshot = sharedType.toJSON() as T[K];
        this.#applyArrayOrObjectUpdate(
          sharedType,
          snapshot,
          changeFn as (object: T[K]) => void
        );
      }
    });
  }

  public subscribe<K extends keyof T>(
    sharedTypeName: K,
    listener: (state: T[K]) => void
  ): void {
    if (!this.#subscriptions.has(sharedTypeName)) {
      const sharedType = this.#yDoc.share.get(sharedTypeName as string);
      if (!sharedType) {
        throw new Error(
          `Shared type with name ${
            sharedTypeName as string
          } does not exist or is not bound to document`
        );
      }
      sharedType.observeDeep(this.#observeDeepFunc(sharedTypeName));
      this.#subscriptions.set(
        sharedTypeName,
        new Set([listener as (state: Readonly<T[keyof T]>) => void])
      );
      return;
    }
    this.#subscriptions
      .get(sharedTypeName)!
      .add(listener as (state: Readonly<T[keyof T]>) => void);
  }

  public unsubscribe<K extends keyof T>(
    sharedTypeName: K,
    listener: (state: Readonly<T[K]>) => void
  ): void {
    if (!this.#subscriptions.has(sharedTypeName)) {
      return;
    }
    const subset = this.#subscriptions.get(sharedTypeName)!;
    if (subset.has(listener as (state: Readonly<T[keyof T]>) => void)) {
      subset.delete(listener as (state: Readonly<T[keyof T]>) => void);
    }
    return;
  }

  public dispose(): void {
    this.#yDoc.destroy();
  }

  #applyStringUpdate(
    yText: Y.Text,
    changeFn: (string: string) => string
  ): void {
    const currentString = yText.toJSON() as string;
    const updatedString = changeFn(currentString);
    const patches = createStringPatches(currentString, updatedString);
    this.#applyStringPatches(yText, patches);
  }

  #applyStringPatches(yText: Y.Text, patches: Change[]): void {
    let cursor = 0;
    for (const change of patches) {
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

  #applyArrayOrObjectUpdate<V>(
    yArrayOrMap: Y.Array<any> | Y.Map<any>,
    snapshot: V,
    changeFn: (object: V) => void
  ): void {
    const [, patches] = create(snapshot, changeFn, { enablePatches: true });
    for (const patch of patches) {
      this.#applyArrayOrObjectPatch(yArrayOrMap, patch);
    }
  }

  #applyArrayOrObjectPatch(
    yArrayOrMap: Y.Array<any> | Y.Map<any>,
    patch: Patch
  ): void {
    const { path, op, value } = patch;
    if (!Array.isArray(path) || path.length === 0) {
      if (yArrayOrMap instanceof Y.Map && isJSONObject(value)) {
        const yMap = yArrayOrMap;
        yMap.clear();
        for (const k in value) {
          yMap.set(k, toYDataType(value[k]));
        }
      } else if (yArrayOrMap instanceof Y.Array && isJSONArray(value)) {
        yArrayOrMap.delete(0, yArrayOrMap.length);
        yArrayOrMap.push(value.map(toYDataType));
      } else if (yArrayOrMap instanceof Y.Text && isString(value)) {
        const string = (yArrayOrMap as Y.Text).toJSON();
        const patches = createStringPatches(string, value);
        this.#applyStringPatches(yArrayOrMap, patches);
      }
      return;
    }

    let base = yArrayOrMap;
    for (let i = 0; i < path.length - 1; i++) {
      const step = path[i];
      base = base.get(step as never);
    }

    const property = path[path.length - 1];

    if (base instanceof Y.Map && typeof property === "string") {
      switch (op) {
        case "add":
        case "replace":
          base.set(property, value);
          break;
        case "remove":
          base.delete(property);
          break;
      }
    } else if (base instanceof Y.Array && typeof property === "number") {
      switch (op) {
        case "add":
          base.insert(property, [value]);
          break;
        case "replace":
          base.delete(property);
          base.insert(property, [value]);
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

  #applyYEvents<K extends keyof T>(
    sharedTypeName: K,
    events: Y.YEvent<any>[]
  ): T[K] {
    const value = this.#yDoc.get(sharedTypeName as string).toJSON() as T[K];
    return create(value, (target) => {
      for (const event of events) {
        if (
          event! instanceof Y.YTextEvent ||
          event! instanceof Y.YArrayEvent ||
          event! instanceof Y.YMapEvent
        ) {
          continue;
        }
        let base: any = target;
        for (const step of event.path) {
          if (
            typeof step === "string" &&
            typeof base === "object" &&
            base !== null &&
            this.#yDoc.share.has(sharedTypeName as string)
          ) {
            base = base[step];
          } else if (typeof step === "number" && Array.isArray(base)) {
            base = base[step];
          } else {
            throw new Error(`Invalid path: ${event.path}`);
          }
        }
        this.#applyYEvent(base, event);
      }
    });
  }

  #applyYEvent(
    base: CRDTCompatiblePojo | CRDTCompatibleArray | string,
    event: Y.YEvent<any>
  ): CRDTCompatiblePojo | CRDTCompatibleArray | string {
    if (event instanceof Y.YMapEvent && isJSONObject(base)) {
      const source = event.target as Y.Map<any>;

      for (const [key, change] of event.changes.keys) {
        switch (change.action) {
          case "add":
          case "update":
            base[key] = toPojo(source.get(key));
            break;
          case "delete":
            delete base[key];
            break;
        }
      }
    } else if (event instanceof Y.YArrayEvent && isJSONArray(base)) {
      const arr = base as any[];

      let retain = 0;
      for (const change of event.changes.delta) {
        if (change.retain) {
          retain += change.retain;
        }
        if (change.delete) {
          arr.splice(retain, change.delete);
        }
        if (change.insert) {
          if (Array.isArray(change.insert)) {
            arr.splice(retain, 0, ...change.insert.map(toPojo));
          } else {
            arr.splice(retain, 0, toPojo(change.insert));
          }
          retain += change.insert.length;
        }
      }
    } else if (event instanceof Y.YTextEvent && isString(base)) {
      return this.#applyYTextEvent(base, event);
    }

    return base as CRDTCompatiblePojo | CRDTCompatibleArray | string;
  }

  #applyYTextEvent(base: string, event: Y.YTextEvent): string {
    let text = base;

    let retain = 0;
    for (const change of event.changes.delta) {
      if (change.retain) {
        retain += change.retain;
      }
      if (change.delete) {
        const deleteLength = change.delete;
        text = text.slice(0, retain) + text.slice(retain + deleteLength);
      }
      if (change.insert) {
        const insertText = Array.isArray(change.insert)
          ? change.insert.join("")
          : change.insert;
        text = text.slice(0, retain) + insertText + text.slice(retain);
        retain += insertText.length;
      }
    }
    return text;
  }
}
