import { create, Patch, rawReturn } from "mutative";
import * as Y from "yjs";
import createStringPatches, { Change } from "textdiff-create";
import { createYTypes } from "./util.js";
import { CRDTWrapper } from "@state-weaver/interface";
import { isUint8ArrayArray } from "../../shared/src/index.js";
import { JsonObject } from "type-fest";

export class InvalidStateError extends Error {
  constructor(message: string) {
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

// TODO: Add support for constants
export class YjsWrapper<T extends JsonObject, D extends Y.Doc = Y.Doc>
  implements CRDTWrapper<T, D, Uint8Array>
{
  readonly #yDoc: Readonly<D>;
  readonly #yMap: Y.Map<any>;
  readonly #validate: (object: unknown) => object is T;
  #state!: T;

  constructor(
    initialData: T | Uint8Array[],
    validate: (value: unknown) => value is T,
    clientId?: number
  ) {
    this.#yDoc = new Y.Doc() as D;
    this.#yMap = this.#yDoc.getMap("__root");
    if (clientId) {
      // @ts-ignore
      this.#yDoc.clientID = clientId;
    }
    this.#validate = validate;

    if (isUint8ArrayArray(initialData)) {
      this.applyUpdates(initialData);
    } else {
      this.#initializeObject(initialData);
    }
  }

  get yDoc(): Readonly<D> {
    return this.#yDoc;
  }

  get state(): T {
    return this.#state;
  }

  applyUpdates(updates: Uint8Array[]): T {
    this.#yDoc.transact(() => {
      for (const update of updates) {
        Y.applyUpdate(this.#yDoc, update);
      }
    });

    const newState = this.#getState();
    if (!this.#validate(newState)) {
      throw new InvalidStateError(
        `Object generated from applied updates breaks schema!`
      );
    }

    this.#state = newState;
    return this.state;
  }

  update(changeFn: (value: T) => void): T {
    this.#yDoc.transact(() => {
      // @ts-ignore
      const [, patches] = create(this.#state, changeFn, {
        enablePatches: true,
      });
      for (const patch of patches) {
        this.#applyPatch(patch);
      }
    });

    const newState = this.#getState();
    if (!this.#validate(newState)) {
      throw new InvalidStateError(`Update to state breaks schema!`);
    }

    this.#state = newState;
    return this.state;
  }

  [Symbol.dispose](): void {
    this.#yDoc.destroy();
  }

  #getState(): T {
    return this.#yMap.toJSON() as T;
  }

  #initializeObject(object: T): void {
    this.#yDoc.transact(() => {
      const [, patches] = create({}, () => rawReturn(object as object), {
        enablePatches: true,
      });
      for (const patch of patches) {
        this.#applyPatch(patch);
      }
    });

    const newState = this.#getState();
    if (!this.#validate(newState)) {
      throw new InvalidStateError(`Object passed does not match schema!`);
    }

    this.#state = newState;
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
}
