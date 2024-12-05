import { JsonObject } from 'type-fest';
import { Patches } from 'mutative';

interface CRDTWrapper<T extends JsonObject, D, U> {
    yDoc: D;
    state: T | undefined;
    init(data: T | U[]): T;
    applyUpdates(updates: U[]): {
        newState: T;
        patches: Patches;
    };
    update(changeFn: (value: T) => void): {
        newState: T;
        patches: Patches;
    };
    [Symbol.dispose](): void;
}

export type { CRDTWrapper };
