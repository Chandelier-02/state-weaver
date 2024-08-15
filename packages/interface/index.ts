import type { Schema, MappedSchema } from "../schema/dist";
export interface CRDTWrapper<
  S extends Schema,
  T extends MappedSchema<S>,
  D,
  U
> {
  yDoc: Readonly<D>;

  state: Readonly<T>;

  applyUpdates(updates: U[], validate: boolean): T;

  update(changeFn: (value: T) => void, validate?: boolean): T;

  update(changeFn: (value: T) => T, validate?: boolean): T;

  dispose(): void;
}
