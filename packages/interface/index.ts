import type { Schema, MappedSchema } from "../schema/dist";
export interface CRDTWrapper<
  S extends Schema,
  T extends MappedSchema<S>,
  D,
  U
> {
  yDoc: Readonly<D>;

  state: Readonly<T>;

  applyUpdates(updates: U[]): Readonly<T>;

  update(changeFn: (value: T) => void): Readonly<T>;

  update(changeFn: (value: T) => T): Readonly<T>;

  dispose(): void;
}
