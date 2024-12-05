"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  InvalidStateError: () => InvalidStateError,
  ROOT_MAP_NAME: () => ROOT_MAP_NAME,
  YjsWrapper: () => YjsWrapper
});
module.exports = __toCommonJS(src_exports);

// src/wrapper.ts
var import_mutative = require("mutative");
var Y2 = __toESM(require("yjs"), 1);
var import_textdiff_create = __toESM(require("textdiff-create"), 1);

// src/util.ts
var Y = __toESM(require("yjs"), 1);

// ../shared/src/index.ts
function isJsonCompatible(value) {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonCompatible);
  }
  if (typeof value === "object") {
    return Object.values(value).every(isJsonCompatible);
  }
  return false;
}
function isJsonObject(value) {
  const valueIsCompatible = isJsonCompatible(value);
  if (!valueIsCompatible) {
    return false;
  }
  return typeof value === "object" && !Array.isArray(value);
}
function isJsonArray(value) {
  const valueIsCompatible = isJsonCompatible(value);
  if (!valueIsCompatible) {
    return false;
  }
  return typeof value === "object" && Array.isArray(value);
}
function isJsonPrimitive(value) {
  return typeof value === "boolean" || typeof value === "number" || typeof value === "string" || value === null;
}
var IllegalValueError = class extends Error {
  illegalValue;
  constructor(illegalValue) {
    super(`Value does not align with Json`);
    this.illegalValue = illegalValue;
    this.name = this.constructor.name;
    if ("captureStackTrace" in Error && typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
};

// src/util.ts
function createYTypes(value) {
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

// src/wrapper.ts
var import_fast_json_patch = __toESM(require("fast-json-patch"), 1);
var { compare } = import_fast_json_patch.default;
var InvalidStateError = class extends Error {
  constructor(message, oldState, newState, patches) {
    super(message);
    this.message = message;
    this.oldState = oldState;
    this.newState = newState;
    this.patches = patches;
    this.name = this.constructor.name;
    if ("captureStackTrace" in Error && typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
};
var ROOT_MAP_NAME = "__root";
var YjsWrapper = class {
  #yDoc;
  #yMap;
  #validate;
  #state;
  constructor(validate, clientId) {
    this.#yDoc = new Y2.Doc();
    this.#yMap = this.#yDoc.getMap(ROOT_MAP_NAME);
    if (clientId) {
      this.#yDoc.clientID = clientId;
    }
    this.#validate = validate;
  }
  get yDoc() {
    return this.#yDoc;
  }
  get state() {
    return this.#state;
  }
  // @ts-ignore
  async init(data) {
    let patches = [];
    await new Promise((resolve) => {
      this.#yDoc.once("update", () => resolve());
      this.#yDoc.transact(() => {
        if (Array.isArray(data)) {
          for (const update of data) {
            Y2.applyUpdate(this.#yDoc, update);
          }
        } else {
          [, patches] = (0, import_mutative.create)(
            {},
            () => {
              return (0, import_mutative.rawReturn)(data);
            },
            {
              enablePatches: true
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
        void 0,
        newState,
        patches
      );
    }
    this.#state = newState;
    return this.#state;
  }
  //@ts-ignore
  async applyUpdates(updates) {
    if (!this.#state) {
      throw new Error(
        `Wrapper must be initialized before calling applyUpdates`
      );
    }
    const oldState = this.#state;
    await new Promise((resolve) => {
      this.#yDoc.once("update", () => resolve());
      this.#yDoc.transact(() => {
        for (const update of updates) {
          Y2.applyUpdate(this.#yDoc, update);
        }
      });
    });
    const newState = this.#getState();
    const patches = compare(oldState, newState);
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
  async update(changeFn) {
    if (!this.#state) {
      throw new Error(`Wrapper must be initialized before calling update`);
    }
    const oldState = this.#state;
    let patches = [];
    await new Promise((resolve) => {
      this.#yDoc.once("update", () => resolve());
      this.#yDoc.transact(() => {
        [, patches] = (0, import_mutative.create)(this.#state, changeFn, {
          enablePatches: true
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
  [Symbol.dispose]() {
    this.#yDoc.destroy();
  }
  #getState() {
    const state = this.#yMap.toJSON();
    if (Object.keys(state).length === 0) {
      return void 0;
    }
    return state;
  }
  #applyPatch(patch) {
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
    let base = this.#yMap;
    for (let i = 0; i < path.length - 1; i++) {
      const step = path[i];
      base = base.get(step);
    }
    const property = path[path.length - 1];
    if (base instanceof Y2.Map && typeof property === "string") {
      switch (op) {
        case "add":
          base.set(property, createYTypes(value));
          break;
        case "replace":
          if (typeof value === "string") {
            const yText = base.get(property);
            if (!yText) {
              base.set(property, createYTypes(value));
              break;
            }
            const string = yText.toJSON();
            const patches = (0, import_textdiff_create.default)(string, value);
            this.#applyStringPatches(yText, patches);
          } else {
            base.set(property, createYTypes(value));
          }
          break;
        case "remove":
          base.delete(property);
          break;
      }
    } else if (base instanceof Y2.Array && typeof property === "number") {
      base = base;
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
    } else if (base instanceof Y2.Array && property === "length") {
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
  #applyStringPatches(target, patches) {
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
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  InvalidStateError,
  ROOT_MAP_NAME,
  YjsWrapper
});
