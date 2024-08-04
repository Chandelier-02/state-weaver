import { CRDTWrapper } from "@crdt-wrapper/interface";
import {
  CRDTCompatibleArray,
  CRDTCompatiblePojo,
} from "@crdt-wrapper/shared-types";
import { isJSONArray, isJSONObject, isString } from "@crdt-wrapper/util";
import * as Y from "yjs";
import { Patch, create } from "mutative";
import createStringPatch, { Change } from "textdiff-create";
import { assertSupportedEvent, toPojo, toYDataType } from "./util";
import { SupportedSource } from "./types";

/**
 * YjsWrapper is a class that wraps a Yjs shared type and provides an interface to interact with it using plain JavaScript objects.
 * It supports synchronization, updates, and observing changes within the CRDT framework.
 *
 * @template Snapshot - The type of the CRDT-compatible value, which can be a JSONObject or JSONArray.
 */
export class YjsWrapper<
  Snapshot extends CRDTCompatibleArray | CRDTCompatiblePojo
> implements CRDTWrapper<Snapshot>
{
  readonly #source: SupportedSource;
  readonly #doc: Y.Doc;
  #snapshot: Snapshot;
  #observeDeepFunc = (events: Y.YEvent<any>[]) => {
    this.#snapshot = this.#applyYEvents(events);
  };

  /**
   * Creates a new YjsWrapper instance and returns it along with the initial update that reflects the provided initial object.
   *
   * @param initialObject - The initial state of the CRDT, represented as a plain JavaScript object.
   * @param source - The Yjs shared type that this wrapper will manage (either Y.Map or Y.Array).
   * @returns An object containing the created wrapper and the initial update as a Uint8Array.
   * @throws {Error} If the initial object is not of type object.
   * @throws {Error} If the initial object is an array but the source is not a Y.Array.
   * @throws {Error} If the initial object is an object but the source is not a Y.Map.
   * @throws {Error} If the source is not bound to a document.
   */
  public static wrap<Snapshot extends CRDTCompatibleArray | CRDTCompatiblePojo>(
    initialObject: Snapshot,
    source: SupportedSource
  ): { wrapper: YjsWrapper<Snapshot>; initialUpdate: Uint8Array | undefined } {
    if (typeof initialObject !== "object") {
      throw new Error(
        "Invalid argument. Initial object must be of type object."
      );
    }

    if (Array.isArray(initialObject)) {
      if (!(source instanceof Y.Array)) {
        throw new Error(
          "Invalid argument. For an array, the source must be a Y.Array."
        );
      }
    } else {
      if (!(source instanceof Y.Map)) {
        throw new Error(
          "Invalid argument. For an object, the source must be a Y.Map."
        );
      }
    }

    const wrapper = new YjsWrapper<Snapshot>(source);
    const initialUpdate = wrapper.update(() => initialObject);

    return { wrapper, initialUpdate };
  }

  /**
   * Constructs a new YjsWrapper instance for a given Yjs shared type.
   *
   * @param source - The Yjs shared type (Y.Map or Y.Array) that this wrapper will manage.
   */
  private constructor(source: SupportedSource) {
    if (!source.doc) {
      throw new Error("Source must be bound to a document");
    }
    this.#doc = source.doc;
    this.#source = source;
    this.#source.observeDeep(this.#observeDeepFunc);
    this.#snapshot = this.#source.toJSON() as Snapshot;
  }

  /**
   * Gets the current snapshot of the CRDT state, represented as a plain JavaScript object.
   */
  get snapshot(): Snapshot {
    return this.#snapshot;
  }

  /**
   * Unbinds the Pojo from the CRDT, releasing any resources and stopping synchronization.
   * After calling this method, the snapshot will no longer reflect changes from the CRDT.
   */
  public unbind(): void {
    this.#source.unobserveDeep(this.#observeDeepFunc);
  }

  // TODO: Figure out if I can dynamically tell the changeFn to return a string if the snapshot is a string
  /**
   * Updates the CRDT state using the provided change function, which modifies the snapshot.
   * The change function receives the current snapshot and can make changes that are then propagated to the underlying CRDT.
   *
   * @param changeFn - A function that accepts the current snapshot and modifies it to reflect the desired changes.
   * @returns A Uint8Array representing the encoded update to be applied to the Yjs document.
   */
  public update(changeFn: (snapshot: Snapshot) => void): Uint8Array {
    return this.#doc.transact((): Uint8Array => {
      return this.#applyPojoUpdate(this.#source, this.#snapshot, changeFn);
    });
  }

  /**
   * Applies a given update to the CRDT state. This update is typically an encoded representation
   * of changes that need to be merged into the current state. The method ensures that the local
   * snapshot is updated accordingly to reflect the changes made in the update.
   *
   * @param update - A Uint8Array containing the encoded changes to be applied to the CRDT.
   *                 This update is generally produced by a remote peer or another part of the system
   *                 and represents a set of changes that need to be integrated into the current state.
   */
  public applyCRDTUpdate(update: Uint8Array): void {
    this.#doc.transact(() => {
      Y.applyUpdate(this.#doc, update);
    });
  }

  /**
   * Applies Yjs events to the current snapshot, updating the state based on the events.
   *
   * @param events - An array of Yjs events to apply.
   * @returns The updated snapshot after applying the events.
   */
  #applyYEvents(events: Y.YEvent<any>[]): Snapshot {
    return create(this.#snapshot, (target) => {
      for (const event of events) {
        assertSupportedEvent(event);
        let base: any = target;
        for (const step of event.path) {
          if (
            typeof step === "string" &&
            typeof base === "object" &&
            base !== null &&
            this.#source
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

  /**
   * Applies a Yjs event to the given base object, updating it based on the event.
   *
   * @param base - The base object to apply the event to.
   * @param event - The Yjs event to apply.
   * @returns The updated base object or string after applying the event.
   */
  #applyYEvent(base: Snapshot, event: Y.YEvent<any>): Snapshot | string {
    if (event instanceof Y.YMapEvent && isJSONObject(base)) {
      const source = event.target as Y.Map<any>;

      event.changes.keys.forEach((change, key) => {
        switch (change.action) {
          case "add":
          case "update":
            base[key] = toPojo(source.get(key));
            break;
          case "delete":
            delete base[key];
            break;
        }
      });
    } else if (event instanceof Y.YArrayEvent && isJSONArray(base)) {
      const arr = base as any[];

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
            arr.splice(retain, 0, ...change.insert.map(toPojo));
          } else {
            arr.splice(retain, 0, toPojo(change.insert));
          }
          retain += change.insert.length;
        }
      });
    } else if (event instanceof Y.YTextEvent && isString(base)) {
      return this.#applyYTextEvent(base, event);
    }

    return base as Snapshot;
  }

  /**
   * Applies a Yjs text event to the given string, updating it based on the event.
   *
   * @param base - The base string to apply the event to.
   * @param event - The Yjs text event to apply.
   * @returns The updated string after applying the event.
   */
  #applyYTextEvent(base: string, event: Y.YTextEvent): string {
    let text = base;

    let retain = 0;
    event.changes.delta.forEach((change) => {
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
    });
    return text;
  }

  /**
   * Applies a local update to the CRDT state using the provided change function and returns the resulting update as a Uint8Array.
   * This method wraps the update operation in a Yjs transaction, ensuring that the changes are applied atomically.
   *
   * @param source - The Yjs data structure (Y.Array or Y.Map) being updated.
   * @param snapshot - The current state snapshot of the CRDT represented as a plain JavaScript object.
   * @param changeFn - A function that receives the current snapshot and applies changes to it.
   *                   This function should modify the snapshot as needed to reflect the desired state.
   * @returns A Uint8Array representing the encoded update to be applied to the Yjs document, which can be used for further synchronization.
   */
  #applyPojoUpdate(
    source: SupportedSource,
    snapshot: Snapshot,
    changeFn: (snapshot: Snapshot) => void
  ): Uint8Array {
    const [, patches] = create(snapshot, changeFn, { enablePatches: true });
    const updates: Uint8Array[] = [];
    for (const patch of patches) {
      updates.push(this.#applyPatch(source, patch));
    }
    return Y.mergeUpdates(updates);
  }

  /**
   * Applies a patch to the target Yjs data structure and returns the resulting update as a Uint8Array.
   *
   * @param target - The Yjs data structure (Y.Array or Y.Map) being updated.
   * @param patch - The patch to apply, which contains information about the changes to be made.
   * @returns A Uint8Array representing the encoded update to be applied to the Yjs document.
   */
  #applyPatch(target: SupportedSource, patch: Patch): Uint8Array {
    const oldStateVector = Y.encodeStateVector(this.#doc);
    const { path, op, value } = patch;
    if (!Array.isArray(path) || path.length === 0) {
      if (op !== "replace") {
        throw new Error("Cannot add or remove top level properties of object.");
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
        const string = (target as Y.Text).toJSON();
        const patches = createStringPatch(string, value);
        this.#applyStringPatches(target, patches);
      }
      return Y.encodeStateAsUpdate(this.#doc, oldStateVector);
    }

    let base = target;
    for (let i = 0; i < path.length - 1; i++) {
      const step = path[i];
      base = base.get(step as never);
    }

    const property = path[path.length - 1];

    if (base instanceof Y.Map && typeof property === "string") {
      switch (op) {
        case "add":
        case "replace":
          base.set(property, toYDataType(value));
          break;
        case "remove":
          base.delete(property);
          break;
      }
    } else if (base instanceof Y.Array && typeof property === "number") {
      switch (op) {
        case "add":
          base.insert(property, [toYDataType(value)]);
          break;
        case "replace":
          base.delete(property);
          base.insert(property, [toYDataType(value)]);
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
    } else if (base instanceof Y.Text && typeof property === "string") {
      if (op !== "replace") {
        throw new Error();
      }
    } else {
      throw new Error(
        `Cannot handle patch ${patch} on instance of ${base.constructor.name}`
      );
    }

    return Y.encodeStateAsUpdate(this.#doc, oldStateVector);
  }

  /**
   * Applies a list of string patches to a Y.Text instance, modifying the text accordingly.
   *
   * @param target - The Y.Text instance to apply the patches to.
   * @param patches - An array of changes representing the differences to apply to the text.
   */
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
