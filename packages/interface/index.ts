import { JsonObject, ReadonlyDeep } from "type-fest";
export interface CRDTWrapper<T extends JsonObject, D, U> {
  yDoc: Readonly<D>;

  state: ReadonlyDeep<T>;

  applyUpdates(updates: U[]): ReadonlyDeep<T>;

  update(changeFn: (value: T) => void): ReadonlyDeep<T>;

  update(changeFn: (value: T) => T): ReadonlyDeep<T>;

  [Symbol.dispose](): void;
}
