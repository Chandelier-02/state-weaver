import { create, current, Draft, Patch, Patches, rawReturn } from "mutative";
import * as Y from "yjs";
import createStringPatches, { Change } from "textdiff-create";
import { createYTypes, toPlainValue } from "./util.js";
import { CRDTWrapper } from "@state-weaver/interface";
import { JsonArray, JsonObject, JsonValue } from "type-fest";
import { isJsonArray, isJsonObject } from "../../shared/src/index.js";

export class InvalidStateError<T> extends Error {
  constructor(
    public message: string,
    public oldState: T | undefined,
    public newState: unknown,
    public patches?: Patches
  ) {
    super(message);
    this.name = this.constructor.name;
    // @ts-ignore // TODO: Figure out why this is giving my type issues...
    if (
      "captureStackTrace" in Error &&
      typeof Error.captureStackTrace === "function"
    ) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export const ROOT_MAP_NAME = "__root" as const;

export class YjsWrapper<T extends JsonObject, D extends Y.Doc = Y.Doc>
  implements CRDTWrapper<T, D, Uint8Array>
{
  readonly #yDoc: D;
  readonly #yMap: Y.Map<any>;
  readonly #validate: (object: unknown) => object is T;
  #state: T | undefined;

  constructor(validate: (value: unknown) => value is T, clientId?: number) {
    this.#yDoc = new Y.Doc() as D;
    this.#yMap = this.#yDoc.getMap(ROOT_MAP_NAME);

    if (clientId) {
      // @ts-ignore
      this.#yDoc.clientID = clientId;
    }
    this.#validate = validate;
  }

  get yDoc(): D {
    return this.#yDoc;
  }

  get state(): T | undefined {
    return this.#state;
  }

  init(data: T | Uint8Array[]): T {
    let patches: Patches<true> = [];
    this.#yDoc.transact(() => {
      if (Array.isArray(data)) {
        for (const update of data) {
          Y.applyUpdate(this.#yDoc, update);
        }
      } else {
        // @ts-ignore
        [, patches] = create(
          {},
          () => {
            return rawReturn(data);
          },
          {
            enablePatches: true,
          }
        );
        for (const patch of patches) {
          this.#applyPatch(patch);
        }
      }
    });

    const newState = this.#getState();
    if (!this.#validate(newState)) {
      throw new InvalidStateError(
        `Update to state breaks schema!`,
        undefined,
        newState,
        patches
      );
    }

    this.#state = newState;
    return this.#state;
  }

  applyUpdates(updates: Uint8Array[]): { newState: T; patches: Patches } {
    if (!this.#state) {
      throw new Error(
        `Wrapper must be initialized before calling applyUpdates`
      );
    }

    const oldState = this.#state;
    let patches: Patches = [];

    const observeDeepHandler = (events: Y.YEvent<any>[]) => {
      [, patches] = create(
        oldState,
        (draft) => this.#applyYEvents(draft, events),
        { enablePatches: true, strict: false }
      );
    };

    this.#yMap.observeDeep(observeDeepHandler);

    this.#yDoc.transact(() => {
      for (const update of updates) {
        Y.applyUpdate(this.#yDoc, update);
      }
    });

    this.#yMap.unobserveDeep(observeDeepHandler);

    const newState = this.#getState();

    if (!this.#validate(newState)) {
      throw new InvalidStateError(
        `Object generated from applied updates breaks schema!`,
        oldState,
        newState,
        patches
      );
    }

    this.#state = newState;
    return { newState, patches };
  }

  update(changeFn: (value: T) => void): { newState: T; patches: Patches } {
    if (!this.#state) {
      throw new Error(`Wrapper must be initialized before calling update`);
    }

    const oldState = this.#state;
    let patches: Patches<true> = [];

    this.#yDoc.transact(() => {
      // @ts-ignore
      [, patches] = create(this.#state, changeFn, {
        enablePatches: true,
      });
      for (const patch of patches) {
        this.#applyPatch(patch);
      }
    });

    const newState = this.#getState();
    if (!this.#validate(newState)) {
      throw new InvalidStateError(
        `Update to state breaks schema!`,
        oldState,
        newState,
        patches
      );
    }

    this.#state = newState;
    return { newState: this.#state, patches };
  }

  [Symbol.dispose](): void {
    this.#yDoc.destroy();
  }

  #getState(): T | undefined {
    const state = this.#yMap.toJSON();
    if (Object.keys(state).length === 0) {
      return undefined;
    }
    return state as T;
  }

  #applyPatch(patch: Patch): void {
    const { path, op, value } = patch;

    if (path.length === 0) {
      if (op !== "replace") {
        throw new Error("Cannot add or remove elements from top level object!");
      }

      this.#yMap.clear();
      for (const k in value) {
        const yType = createYTypes(value[k]);
        this.#yMap.set(k, yType);
      }
      return;
    }

    let base: Y.Map<any> | Y.Array<any> = this.#yMap;
    for (let i = 0; i < path.length - 1; i++) {
      const step = path[i];
      base = base.get(step as never);
    }

    const property = path[path.length - 1];

    if (base instanceof Y.Map && typeof property === "string") {
      switch (op) {
        case "add":
        case "replace":
          if (typeof value === "string") {
            const yText = base.get(property) as Y.Text;
            const string = yText.toJSON();
            const patches = createStringPatches(string, value);
            this.#applyStringPatches(yText, patches);
          } else {
            base.set(property, createYTypes(value));
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
          base.insert(property, [createYTypes(value)]);
          break;
        case "replace":
          base.delete(property);
          base.insert(property, [createYTypes(value)]);
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

  #applyStringPatches(target: Y.Text, patches: Change[]): void {
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

  #applyYEvents(draft: Draft<T>, events: Y.YEvent<any>[]): void {
    for (const event of events) {
      // @ts-ignore
      const base = event.path.reduce((obj, step) => {
        return obj[step];
      }, current(draft));
      this.#applyYEvent<typeof base>(base, event);
    }
  }

  #applyYEvent<T extends JsonValue>(base: T, event: Y.YEvent<any>) {
    if (event instanceof Y.YMapEvent && isJsonObject(base)) {
      const obj = base as JsonObject;
      const source = event.target as Y.Map<any>;
      event.changes.keys.forEach((change, key) => {
        switch (change.action) {
          case "add":
          case "update":
            obj[key] = toPlainValue(source.get(key));
            break;
          case "delete":
            delete obj[key];
            break;
        }
      });
    } else if (event instanceof Y.YArrayEvent && isJsonArray(base)) {
      const arr = base as unknown as any[];

      let retain = 0;
      event.changes.delta.forEach((change) => {
        if (change.retain) {
          retain += change.retain;
        }
        if (change.delete) {
          arr.splice(retain, change.delete);
        }
        if (change.insert) {
          if (Array.isArray(change.insert)) {
            arr.splice(retain, 0, ...change.insert.map(toPlainValue));
          } else {
            arr.splice(retain, 0, toPlainValue(change.insert));
          }
          retain += change.insert.length;
        }
      });
    } else if (event instanceof Y.YTextEvent && typeof base === "string") {
      base = this.#applyYTextEvent(base, event) as T;
    } else {
      throw new Error(
        `Received unsupported YEvent. YEVent type: ${event.constructor.name}`
      );
    }
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
        text = insertText;
        retain += insertText.length;
      }
    }
    return text;
  }
}
