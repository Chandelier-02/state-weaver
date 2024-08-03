import {
  CRDTCompatibleArray,
  CRDTCompatiblePojo,
  CRDTCompatibleString,
} from "@crdt-wrapper/shared-types";
import { CRDTWrapper, StateVector, VersionedUpdate } from "./interface";
import * as Y from "yjs";
import { YjsBinder } from "@crdt-wrapper/binder-yjs";

/**
 * Calculates the clock value from a given Yjs update.
 *
 * This function decodes a binary update and extracts the clock value from the last structure in the update.
 * The clock value is a logical timestamp used to track the version of the CRDT state, helping in conflict resolution.
 *
 * @param update - A binary representation of the Yjs update containing the changes to the CRDT state.
 * @returns The clock value associated with the last structure in the update. Returns 0 if update is a no-op.
 */
function calculateClockFromUpdate(update: Uint8Array): number | undefined {
  if (update.length === 0 && update[0] === 0 && update[1] === 0) {
    return undefined;
  }

  const decodedNewUpdate = Y.decodeUpdate(update);
  const lastStructInUpdate = decodedNewUpdate.structs.at(-1);

  return lastStructInUpdate!.id.clock;
}

/**
 * YjsCRDTWrapper is an implementation of the CRDTWrapper interface, leveraging Y.js for conflict-free replicated data type (CRDT) functionalities.
 * It provides methods to interact with a Y.js document, manage updates, and synchronize state across distributed systems.
 *
 * @template T - The type of the CRDT-compatible plain old JavaScript object (Pojo), constrained to be either a `JSONObject` or `JSONArray`.
 */
export class YjsCRDTWrapper<
  T extends CRDTCompatibleArray | CRDTCompatiblePojo | CRDTCompatibleString
> implements CRDTWrapper<T>
{
  readonly #yDoc: Y.Doc;
  readonly #binder: YjsBinder<T>;

  /**
   * Creates a YjsCRDTWrapper instance with an initial object and optional Y.Doc.
   * Initializes the CRDT state with the given object.
   *
   * @param initialObject - The initial state of the CRDT represented as a plain JavaScript object.
   * @param yDoc - An optional Y.Doc instance to associate with the CRDT.
   * @returns An object containing the wrapper instance and initial update data, if any.
   */
  public static create<T extends CRDTCompatiblePojo>(
    initialObject: T,
    yDoc?: Y.Doc
  ): {
    wrapper: YjsCRDTWrapper<T>;
    initialUpdateData: VersionedUpdate | undefined;
  };

  /**
   * Creates a YjsCRDTWrapper instance from a series of updates and an optional Y.Doc.
   * Applies the provided updates to reconstruct the CRDT state.
   *
   * @param updatesToLoadFrom - An array of binary updates representing the CRDT state.
   * @param yDoc - An optional Y.Doc instance to associate with the CRDT.
   * @returns An object containing the wrapper instance.
   */
  public static create<T extends CRDTCompatiblePojo>(
    updatesToLoadFrom: Uint8Array[],
    yDoc?: Y.Doc
  ): { wrapper: YjsCRDTWrapper<T> };

  public static create<T extends CRDTCompatiblePojo>(
    arg0: T | Uint8Array[],
    arg1?: Y.Doc
  ):
    | {
        wrapper: YjsCRDTWrapper<T>;
        initialUpdateData: VersionedUpdate | undefined;
      }
    | { wrapper: YjsCRDTWrapper<T> } {
    const doc = arg1 ?? new Y.Doc();
    const topLevelObjectMap = doc.getMap("top-level-object-map");
    const binder = new YjsBinder<T>(topLevelObjectMap);
    const binder = bind<T>(topLevelObjectMap);

    if (Array.isArray(arg0)) {
      doc.transact(() => {
        for (const update of arg0) {
          Y.applyUpdate(doc, update);
        }
      });
      return { wrapper: new YjsCRDTWrapper<T>(doc, binder) };
    } else {
      binder.update(() => arg0);
      const initialUpdate = Y.encodeStateAsUpdate(doc);
      const initialClock = calculateClockFromUpdate(initialUpdate);

      return {
        wrapper: new YjsCRDTWrapper<T>(doc, binder),
        initialUpdateData:
          initialClock !== undefined
            ? { clock: initialClock, update: initialUpdate }
            : undefined,
      };
    }
  }

  /**
   * Private constructor to instantiate a YjsCRDTWrapper. Use the static `create` method instead.
   *
   * @param yDoc - The Y.Doc instance associated with this CRDT.
   * @param binder - The binder that links the CRDT state with the Y.js document.
   * @param initialStateVector - The initial state vector for the Y.js document.
   */
  private constructor(yDoc: Y.Doc, binder: Binder<T>) {
    this.#yDoc = yDoc;
    this.#binder = binder;
  }

  /**
   * The state vector representing the current state of the CRDT.
   * This is used for tracking changes and resolving conflicts.
   *
   * @returns An array of tuples of actor IDs to their respective clock values, or undefined if the state vector is not available.
   */
  get stateVector(): StateVector | undefined {
    const encodedStateVector = Y.encodeStateVector(this.#yDoc);
    const decodedStateVector = Y.decodeStateVector(encodedStateVector);
    return Array.from(decodedStateVector.entries());
  }

  /**
   * The clock from the last update to the CRDT.
   *
   * @returns A number representing the clock value of the last update or undefined if there are no updates available.
   */
  get clockFromLastUpdate(): number | undefined {
    return calculateClockFromUpdate(Y.encodeStateAsUpdate(this.#yDoc));
  }

  /**
   * The plain JavaScript object representation of the CRDT state.
   *
   * @returns The current state as a plain JavaScript object of type T.
   */
  get pojo(): T {
    return this.#binder.get();
  }

  /**
   * Applies a binary update to the CRDT, modifying its state based on the provided update data.
   *
   * @param update - The binary representation of the CRDT update to apply.
   */
  applyUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.#yDoc, update);
  }

  /**
   * Updates the CRDT state using the provided change function, which mutates a draft of the current state.
   * Returns a `VersionedUpdate` object containing the updated state and its associated version clock.
   *
   * @param changeFn - A function that receives the current state and applies the desired changes.
   * @returns A `VersionedUpdate` object containing the updated state and its clock, or undefined if no update occurred.
   */
  update(changeFn: (object: T) => void): VersionedUpdate | undefined {
    this.#binder.update((state) => {
      changeFn(state);
    });
    const newUpdate = Y.encodeStateAsUpdate(
      this.#yDoc,
      Y.encodeStateVector(this.#yDoc)
    );
    const newClock = calculateClockFromUpdate(newUpdate);

    if (!newClock) {
      return undefined;
    }

    return {
      clock: newClock,
      update: newUpdate,
    };
  }
}
