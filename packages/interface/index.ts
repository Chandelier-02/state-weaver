import { JsonObject } from "type-fest";
export interface CRDTWrapper<T extends JsonObject, D, U> {
  yDoc: D;

  state: T | undefined;

  init(data: T | U[]): T;

  applyUpdates(updates: U[]): T;

  update(changeFn: (value: T) => void): T;

  [Symbol.dispose](): void;
}
