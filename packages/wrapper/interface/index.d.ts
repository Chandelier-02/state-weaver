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
   * Applies a given update to the CRDT state. This update is typically an encoded representation
   * of changes that need to be merged into the current state. The method ensures that the local
   * snapshot is updated accordingly to reflect the changes made in the update.
   *
   * @param update - A Uint8Array containing the encoded changes to be applied to the CRDT.
   *                 This update is generally produced by a remote peer or another part of the system
   *                 and represents a set of changes that need to be integrated into the current state.
   */
  applyUpdate(update: Uint8Array): void;
}
