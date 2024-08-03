export type VersionedUpdate = { clock: number; update: Uint8Array };

export type StateVector = [actorId: number, clock: number][];

/**
 * The CRDTWrapper serves as an abstraction over any operation-based CRDT.
 * It provides methods to interact with the CRDT, allowing for updates, state synchronization,
 * and conversion between CRDT-specific data structures and plain JavaScript objects.
 *
 * @template T - The type of the CRDT-compatible plain old JavaScript object (Pojo),
 *               constrained to be either a `CRDTCompatiblePojo` or `CRDTCompatibleArray` or `CRDTCompatibleString`.
 */
export interface CRDTWrapper<T> {
  /**
   * The state vector representing the versioned state of the CRDT,
   * used for tracking the state and resolving conflicts.
   * It maps actor IDs to their respective clock values.
   */
  stateVector: StateVector | undefined;

  /**
   * The clock from the last update to the CRDT.
   */
  clockFromLastUpdate: number | undefined;

  /**
   * The plain old JavaScript object representation of the CRDT state.
   */
  pojo: T;

  /**
   * Applies an update to the CRDT, modifying its state based on the provided update data.
   * The update data is typically a binary representation of the changes made to the CRDT.
   *
   * @param update - The binary representation of the CRDT update to apply.
   */
  applyUpdate(update: Uint8Array): void;

  /**
   * Updates the CRDT state using the provided change function, which mutates a draft of the current state.
   * Returns a `VersionedUpdate` object containing the updated state and its associated version clock.
   *
   * @param changeFn - A function that receives the current state and applies the desired changes.
   * @returns A `VersionedUpdate` object containing the updated state and its clock, or undefined if no update occurred.
   */
  update(changeFn: (object: T) => void): VersionedUpdate | undefined;
}
