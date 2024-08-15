import type { Schema, MappedSchema } from "../schema/dist";
import { Result } from "../shared/dist";

export interface CRDTWrapper<
  S extends Schema,
  T extends MappedSchema<S>,
  D,
  U
> {
  yDoc: Readonly<D>;

  state: Readonly<T>;

  applyUpdates(updates: U[], validate: boolean): Result<T>;

  update(changeFn: (value: T) => void, validate?: boolean): Result<T>;

  update(changeFn: (value: T) => T, validate?: boolean): Result<T>;

  dispose(): void;
}
