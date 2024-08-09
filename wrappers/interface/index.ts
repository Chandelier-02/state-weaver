import type { Schema, MappedSchema } from "@crdt-wrapper/schema";

export interface CRDTWrapper<S extends Schema, U, D, T = MappedSchema<S>> {
  yDoc: Readonly<D>;

  state: Readonly<T>;

  applyUpdates(updates: U[], validate: boolean): void;

  update(changeFn: (value: T) => void, validate?: boolean): void;

  update(changeFn: (value: T) => T, validate?: boolean): void;

  subscribe(listener: (state: Readonly<T>) => void): void;

  unsubscribe(listener: (state: Readonly<T>) => void): void;

  dispose(): void;
}
