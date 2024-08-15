import type { Schema, MappedSchema } from "../schema/dist";
export interface CRDTWrapper<
  S extends Schema,
  T extends MappedSchema<S>,
  D,
  U
> {
  yDoc: Readonly<D>;

  state: Readonly<T>;

  applyUpdates(updates: U[], validate: boolean): boolean;

  update(changeFn: (value: T) => void, validate?: boolean): boolean;

  update(changeFn: (value: T) => T, validate?: boolean): boolean;

  dispose(): void;
}
