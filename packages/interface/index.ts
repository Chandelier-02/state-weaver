import { JsonObject } from "type-fest";
import { Patches } from "mutative";

export type NoChangeUpdateResult = {
  changed: false;
};
export type ChangeUpdateResult<T, U> = {
  changed: true;
  oldState: T;
  newState: T;
  patches: Patches;
  update: U;
};
export type UpdateResult<T, U> =
  | ChangeUpdateResult<T, U>
  | NoChangeUpdateResult;

export type NoChangeApplyUpdateResult = {
  changed: false;
};
export type ChangeApplyUpdateResult<T> = {
  changed: true;
  oldState: T;
  newState: T;
  patches: Patches;
};
export type ApplyUpdateResult<T> =
  | ChangeApplyUpdateResult<T>
  | NoChangeApplyUpdateResult;

export type NoChangeFromObjectResult<
  T extends JsonObject,
  U,
  D,
  Wrapper extends CRDTWrapper<T, U, D> = CRDTWrapper<T, U, D>
> = {
  changed: false;
  wrapper: Wrapper;
  state: T;
};
export type ChangeFromObjectResult<
  T extends JsonObject,
  U,
  D,
  Wrapper extends CRDTWrapper<T, U, D> = CRDTWrapper<T, U, D>
> = {
  changed: true;
  wrapper: Wrapper;
  state: T;
  update: U;
};
export type FromObjectResult<
  T extends JsonObject,
  U,
  D,
  Wrapper extends CRDTWrapper<T, U, D> = CRDTWrapper<T, U, D>
> =
  | ChangeFromObjectResult<T, U, D, Wrapper>
  | NoChangeFromObjectResult<T, U, D, Wrapper>;

export type NoChangeFromUpdatesResult<
  T extends JsonObject,
  U,
  D,
  Wrapper extends CRDTWrapper<T, U, D> = CRDTWrapper<T, U, D>
> = NoChangeFromObjectResult<T, U, D, Wrapper>;
export type ChangeFromUpdatesResult<
  T extends JsonObject,
  U,
  D,
  Wrapper extends CRDTWrapper<T, U, D> = CRDTWrapper<T, U, D>
> = Omit<ChangeFromObjectResult<T, U, D, Wrapper>, "update">;
export type FromUpdatesResult<
  T extends JsonObject,
  U,
  D,
  Wrapper extends CRDTWrapper<T, U, D> = CRDTWrapper<T, U, D>
> =
  | NoChangeFromUpdatesResult<T, U, D, Wrapper>
  | ChangeFromUpdatesResult<T, U, D, Wrapper>;

export interface CRDTWrapper<T extends JsonObject, U, D = unknown> {
  doc: D;
  state: T;

  update(changeFn: (value: T) => void): UpdateResult<T, U>;

  applyUpdates(updates: U[]): ApplyUpdateResult<T>;

  [Symbol.dispose](): void;
}
