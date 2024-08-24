import { JsonObject } from "type-fest";
export interface CRDTWrapper<T extends JsonObject, D, U> {
  yDoc: Readonly<D>;

  state: T;

  applyUpdates(updates: U[]): T;

  update(changeFn: (value: T) => void): T;

  update(changeFn: (value: T) => T): T;

  [Symbol.dispose](): void;
}
