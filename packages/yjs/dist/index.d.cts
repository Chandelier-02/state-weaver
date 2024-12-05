import { Patches } from 'mutative';
import * as Y from 'yjs';
import { CRDTWrapper } from '@state-weaver/interface';
import { JsonObject } from 'type-fest';

declare class InvalidStateError<T> extends Error {
    message: string;
    oldState: T | undefined;
    newState: unknown;
    patches?: Patches | undefined;
    constructor(message: string, oldState: T | undefined, newState: unknown, patches?: Patches | undefined);
}
declare const ROOT_MAP_NAME: "__root";
declare class YjsWrapper<T extends JsonObject, D extends Y.Doc = Y.Doc> implements CRDTWrapper<T, D, Uint8Array> {
    #private;
    constructor(validate: (value: unknown) => value is T, clientId?: number);
    get yDoc(): D;
    get state(): T | undefined;
    init(data: T | Uint8Array[]): Promise<T>;
    applyUpdates(updates: Uint8Array[]): Promise<{
        newState: T;
        patches: Patches;
    }>;
    update(changeFn: (value: T) => void): Promise<{
        newState: T;
        patches: Patches;
    }>;
    [Symbol.dispose](): void;
}

export { InvalidStateError, ROOT_MAP_NAME, YjsWrapper };
