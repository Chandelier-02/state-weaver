import { create, Patches, rawReturn } from "mutative";
import * as Y from "yjs";
import {
  ApplyUpdateResult,
  ChangeApplyUpdateResult,
  ChangeFromObjectResult,
  ChangeFromUpdatesResult,
  ChangeUpdateResult,
  CRDTWrapper,
  FromObjectResult,
  FromUpdatesResult,
  NoChangeApplyUpdateResult,
  NoChangeFromObjectResult,
  NoChangeFromUpdatesResult,
  NoChangeUpdateResult,
  UpdateResult,
} from "@state-weaver/interface";
import { JsonObject } from "type-fest";
import fastPatch from "fast-json-patch";
import { applyPatch, isEmptyUpdate } from "./util";

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
    if (
      "captureStackTrace" in Error &&
      typeof Error.captureStackTrace === "function"
    ) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export const ROOT_MAP_NAME = "__root" as const;

const alwaysTrue = <T>(_: unknown): _ is T => true;

export interface YjsWrapperFromConfig<T extends JsonObject> {
  validate?: (value: unknown) => value is T;
  yTextPaths?: Set<string>;
  actorId?: number;
}

export class YjsWrapper<T extends JsonObject>
  implements CRDTWrapper<T, Uint8Array, Y.Doc>
{
  readonly #yDoc: Y.Doc;
  readonly #yMap: Y.Map<any>;
  readonly #validate: (object: unknown) => object is T;
  readonly #yTextPaths: Set<string>;
  readonly #actorId: number | undefined;
  #state: T;

  public static fromObject<T extends JsonObject>(
    object: T,
    config?: YjsWrapperFromConfig<T>
  ): FromObjectResult<T, Uint8Array, Y.Doc, YjsWrapper<T>> {
    const yDoc = new Y.Doc();
    const yMap = yDoc.getMap(ROOT_MAP_NAME);
    if (config?.actorId) {
      yDoc.clientID = config.actorId;
    }

    const yTextPaths = config?.yTextPaths ?? new Set<string>();
    const validate = config?.validate ?? alwaysTrue;

    const beforeStateVector = Y.encodeStateVector(yDoc);

    let patches: Patches<true> = [];
    yDoc.transact(() => {
      [, patches] = create(
        {},
        () => {
          return rawReturn(object);
        },
        {
          enablePatches: true,
        }
      );
      for (const patch of patches) {
        applyPatch(yMap, patch, yTextPaths);
      }
    });

    const initialState = yMap.toJSON();
    if (!validate(initialState)) {
      throw new InvalidStateError(
        `Update to state breaks schema!`,
        undefined,
        initialState,
        patches
      );
    }

    const wrapper = new YjsWrapper<T>(
      initialState,
      yDoc,
      yMap,
      validate,
      yTextPaths,
      config?.actorId
    );

    if (Object.keys(initialState).length === 0) {
      return {
        changed: false,
        wrapper,
        state: initialState,
      } satisfies NoChangeFromObjectResult<T, Uint8Array, Y.Doc>;
    }

    const update = Y.encodeStateAsUpdateV2(yDoc, beforeStateVector);
    if (isEmptyUpdate(update)) {
      throw new Error(
        "Object is not empty, and change generated patches, but generated empty update. This should not happen."
      );
    }

    return {
      changed: true,
      wrapper,
      state: initialState,
      update,
    } satisfies ChangeFromObjectResult<T, Uint8Array, Y.Doc>;
  }

  public static fromUpdates<T extends JsonObject>(
    updates: Uint8Array[],
    config?: YjsWrapperFromConfig<T>
  ): FromUpdatesResult<T, Uint8Array, Y.Doc, YjsWrapper<T>> {
    const yDoc = new Y.Doc();
    const yMap = yDoc.getMap(ROOT_MAP_NAME);
    if (config?.actorId) {
      yDoc.clientID = config.actorId;
    }

    const yTextPaths = config?.yTextPaths ?? new Set<string>();
    const validate = config?.validate ?? alwaysTrue;

    for (const update of updates) {
      Y.applyUpdateV2(yDoc, update);
    }

    const initialState = yMap.toJSON();

    const patches = compare({}, initialState) as Patches;

    if (!validate(initialState)) {
      throw new InvalidStateError(
        `Object generated from applied updates breaks schema!`,
        undefined,
        initialState,
        patches
      );
    }

    const wrapper = new YjsWrapper<T>(
      initialState,
      yDoc,
      yMap,
      validate,
      yTextPaths,
      config?.actorId
    );

    if (Object.keys(initialState).length === 0 && patches.length === 0) {
      return {
        changed: false,
        wrapper,
        state: initialState,
      } satisfies NoChangeFromUpdatesResult<T, Uint8Array, Y.Doc>;
    }

    return {
      changed: true,
      wrapper,
      state: initialState,
    } satisfies ChangeFromUpdatesResult<T, Uint8Array, Y.Doc>;
  }

  private constructor(
    initialState: T,
    yDoc: Y.Doc,
    yMap: Y.Map<unknown>,
    validate: (value: unknown) => value is T,
    yTextPaths: Set<string>,
    actorId?: number
  ) {
    this.#state = initialState;
    this.#yDoc = yDoc;
    this.#yMap = yMap;
    this.#validate = validate;
    this.#yTextPaths = yTextPaths ?? new Set<string>();
    if (actorId) {
      this.#actorId = actorId;
      this.#yDoc.clientID = actorId;
    }
  }

  get doc(): Y.Doc {
    return this.#yDoc;
  }

  get state(): T {
    return this.#state;
  }

  update(changeFn: (value: T) => void): UpdateResult<T, Uint8Array> {
    const oldState = this.#state;
    const beforeStateVector = Y.encodeStateVector(this.#yDoc);

    let patches: Patches<true> = [];
    this.#yDoc.transact(() => {
      // @ts-ignore
      [, patches] = create(this.#state, changeFn, {
        enablePatches: true,
      });
      for (const patch of patches) {
        applyPatch(this.#yMap, patch, this.#yTextPaths);
      }
    });

    const newState = this.#yMap.toJSON();
    if (!this.#validate(newState)) {
      throw new InvalidStateError(
        `Update to state breaks schema!`,
        oldState,
        newState,
        patches
      );
    }

    const update = Y.encodeStateAsUpdateV2(this.#yDoc, beforeStateVector);

    if (patches.length === 0 && isEmptyUpdate(update)) {
      return { changed: false } satisfies NoChangeUpdateResult;
    }

    this.#state = newState;
    return {
      changed: true,
      oldState,
      newState,
      patches,
      update,
    } satisfies ChangeUpdateResult<T, Uint8Array>;
  }

  applyUpdates(updates: Uint8Array[]): ApplyUpdateResult<T> {
    const oldState = this.#state;

    this.#yDoc.transact(() => {
      for (const update of updates) {
        Y.applyUpdateV2(this.#yDoc, update);
      }
    });

    const newState = this.#yMap.toJSON();
    const patches = compare(oldState, newState) as Patches;

    if (!this.#validate(newState)) {
      throw new InvalidStateError(
        `Object generated from applied updates breaks schema!`,
        oldState,
        newState,
        patches
      );
    }

    if (this.#actorId) {
      this.#yDoc.clientID = this.#actorId;
    }

    if (patches.length === 0) {
      return { changed: false } satisfies NoChangeApplyUpdateResult;
    }

    this.#state = newState;
    return {
      changed: true,
      oldState,
      newState,
      patches,
    } satisfies ChangeApplyUpdateResult<T>;
  }

  [Symbol.dispose](): void {
    this.#yDoc.destroy();
  }
}
