import type { Schema, MappedSchema } from "../schema/dist";
export interface CRDTWrapper<
  S extends Schema,
  T extends MappedSchema<S>,
  D,
  U
> {
  yDoc: Readonly<D>;

  state: Readonly<T>;

  applyUpdates(updates: U[]): void;

  update(changeFn: (value: T) => void): void;

  update(changeFn: (value: T) => T): void;

  dispose(): void;
}
