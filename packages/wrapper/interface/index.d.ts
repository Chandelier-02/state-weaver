import { CRDTCompatibleValue } from "@crdt-wrapper/shared-types";

/**
 * CRDTWrapper is an interface that binds a Conflict-free Replicated Data Type (CRDT) to a plain old JavaScript object (Pojo) representation.
 * It provides methods for managing the lifecycle of the binding, updating the Pojo state, and accessing the current snapshot of the state.
 *
 * @template T - The type of the CRDT-compatible value, which could be a JSON object, JSON array, or any other JSON-compatible type.
 */
export interface CRDTWrapper<T extends CRDTCompatibleValue> {
  /**
   * Gets the current snapshot of the CRDT state represented as a plain JavaScript object.
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
  update(changeFn: (snapshot: T) => T): void;

  /**
   * Subscribes to changes in the CRDT state. The provided listener function will be called
   * whenever the CRDT state is updated, providing the latest readonly snapshot of the state.
   * The listener function can be used to react to changes in the state in real-time.
   *
   * @param listener - A function that is called with the latest snapshot of the CRDT state
   * whenever the state is updated. The readonly snapshot provided to the listener is a direct reflection
   * of the current state of the CRDT.
   */
  subscribe(listener: (snapshot: Readonly<T>) => void): void;

  /**
   * Unsubscribes a previously subscribed listener from changes in the CRDT state.
   * This method removes the listener function from the set of subscribed listeners,
   * so it will no longer be called when the CRDT state updates.
   *
   * @param listener - The function that was previously subscribed and should now be removed.
   *                   The provided function reference must match exactly with one that was
   *                   previously passed to the `subscribe` method.
   */
  unsubscribe(listener: (snapshot: Readonly<T>) => void): void;
}
