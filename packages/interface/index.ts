import type { Schema, MappedSchema } from "../schema";

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

  subscribe(listener: (state: Readonly<T>) => void): void;

  unsubscribe(listener: (state: Readonly<T>) => void): void;

  dispose(): void;
}
