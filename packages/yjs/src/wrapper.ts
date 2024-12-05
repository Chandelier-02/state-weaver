import { create, Patch, Patches, rawReturn } from "mutative";
import * as Y from "yjs";
import createStringPatches, { Change } from "textdiff-create";
import { createYTypes } from "./util.js";
import { CRDTWrapper } from "@state-weaver/interface";
import { JsonObject } from "type-fest";
import fastPatch from "fast-json-patch";
const { compare } = fastPatch;

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

  // @ts-ignore
  async init(data: T | Uint8Array[]): Promise<T> {
    let patches: Patches<true> = [];

    await new Promise<void>((resolve) => {
      this.#yDoc.once("update", () => resolve());
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

  //@ts-ignore
  async applyUpdates(
    updates: Uint8Array[]
  ): Promise<{ newState: T; patches: Patches }> {
    if (!this.#state) {
      throw new Error(
        `Wrapper must be initialized before calling applyUpdates`
      );
    }

    const oldState = this.#state;

    await new Promise<void>((resolve) => {
      this.#yDoc.once("update", () => resolve());
      this.#yDoc.transact(() => {
        for (const update of updates) {
          Y.applyUpdate(this.#yDoc, update);
        }
      });
    });

    const newState = this.#getState()!;

    const patches = compare(oldState, newState) as Patches;

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

  //@ts-ignore
  async update(changeFn: (value: T) => void): Promise<{
    newState: T;
    patches: Patches;
  }> {
    if (!this.#state) {
      throw new Error(`Wrapper must be initialized before calling update`);
    }

    const oldState = this.#state;
    let patches: Patches<true> = [];

    // ensure the updates are applied correctly
    await new Promise<void>((resolve) => {
      this.#yDoc.once("update", () => resolve());

      this.#yDoc.transact(() => {
        // @ts-ignore
        [, patches] = create(this.#state, changeFn, {
          enablePatches: true,
        });
        for (const patch of patches) {
          this.#applyPatch(patch);
        }
      });
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
          base.set(property, createYTypes(value));
          break;
        case "replace":
          if (typeof value === "string") {
            const yText = base.get(property) as Y.Text | undefined;
            if (!yText) {
              base.set(property, createYTypes(value));
              break;
            }

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
}
