import { JsonObject } from "type-fest";
import { Patches } from "mutative";

export interface CRDTWrapper<T extends JsonObject, D, U> {
  yDoc: D;

  state: T | undefined;

  init(data: T | U[]): Promise<T>;

  applyUpdates(updates: U[]): Promise<{ newState: T; patches: Patches }>;

  update(
    changeFn: (value: T) => void
  ): Promise<{ newState: T; patches: Patches }>;

  [Symbol.dispose](): void;
}
