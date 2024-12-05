import { JsonValue, JsonObject, JsonArray, JsonPrimitive } from 'type-fest';

declare function isJsonCompatible(value: unknown): value is JsonValue;
declare function isJsonObject(value: unknown): value is JsonObject;
declare function isJsonArray(value: unknown): value is JsonArray;
declare function isJsonPrimitive(value: unknown): value is JsonPrimitive;
declare class IllegalValueError extends Error {
    readonly illegalValue: unknown;
    constructor(illegalValue: unknown);
}

export { IllegalValueError, isJsonArray, isJsonCompatible, isJsonObject, isJsonPrimitive };
