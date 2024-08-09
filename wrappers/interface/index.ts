import type { Schema, MappedSchema } from "@crdt-wrapper/schema";
import * as Y from "yjs";

export interface CRDTWrapper<S extends Schema, U, T = MappedSchema<S>> {
  yDoc: Readonly<Y.Doc>;

  state: Readonly<T>;

  applyUpdates(updates: U[], validate: boolean): void;

  update(changeFn: (value: T) => void, validate?: boolean): void;

  update(changeFn: (value: T) => T, validate?: boolean): void;

  subscribe(listener: (state: Readonly<T>) => void): void;

  unsubscribe(listener: (state: Readonly<T>) => void): void;

  dispose(): void;
}
