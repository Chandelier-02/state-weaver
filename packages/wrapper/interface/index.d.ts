import {
  DocTypeDescription,
  MappedTypeDescription,
} from "@crdt-wrapper/shared-types";

export interface CRDTWrapper<
  S extends DocTypeDescription,
  U,
  T = MappedTypeDescription<S>
> {
  yDoc: Readonly<Y.Doc>;

  state: Readonly<T>;

  applyUpdates(updates: U[], validate: boolean): void;

  update(changeFn: (value: T) => void, validate?: boolean): void;

  update(changeFn: (value: T) => T, validate?: boolean): void;

  subscribe(listener: (state: Readonly<T>) => void): void;

  unsubscribe(listener: (state: Readonly<T>) => void): void;

  dispose(): void;
}
