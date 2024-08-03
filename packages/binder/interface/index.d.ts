import { CRDTCompatibleValue } from "@crdt-wrapper/shared-types";

/**
 * CRDTToPojoBinder is an interface that binds a Conflict-free Replicated Data Type (CRDT) to a plain old JavaScript object (Pojo) representation.
 * It provides methods for managing the lifecycle of the binding, updating the Pojo state, and accessing the current snapshot of the state.
 *
 * @template T - The type of the CRDT-compatible value, which could be a JSONObject, JSONArray, or any other JSON-compatible type.
 */
export interface CRDTToPojoBinder<T extends CRDTCompatibleValue> {
  /**
   * The current snapshot of the CRDT state represented as a plain JavaScript object.
   * This snapshot is a direct reflection of the CRDT's current state and is kept in sync with the underlying CRDT.
   */
  snapshot: T;

  /**
   * Unbinds the Pojo from the CRDT, releasing any resources and stopping synchronization.
   * After calling this method, the snapshot will no longer reflect changes from the CRDT, and further updates will not be applied.
   */
  unbind(): void;

  /**
   * Updates the CRDT state using the provided change function, which modifies the snapshot.
   * The change function receives the current snapshot and can make changes that are then propagated to the underlying CRDT.
   *
   * @param changeFn - A function that accepts the current snapshot and modifies it to reflect the desired changes.
   */
  update(changeFn: (snapshot: T) => void): void;
}
