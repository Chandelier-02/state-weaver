/**
 * JSONPrimitive represents the primitive JSON data types.
 * These include strings, numbers, booleans, and null, which are the basic types allowed in JSON.
 */
export type JSONPrimitive = string | number | boolean | null;

/**
 * CRDTCompatibleArray represents an array where each element is a CRDT-compatible value.
 * This interface extends the native Array type, specifically for arrays that can contain
 * JSON primitives, objects, or other arrays that conform to the CRDT-compatible types.
 *
 * @interface CRDTCompatibleArray
 * @extends {Array<CRDTCompatibleValue>}
 */
export interface CRDTCompatibleArray extends Array<CRDTCompatibleValue> {}

/**
 * CRDTCompatiblePojo represents a plain old JavaScript object (Pojo) where each value
 * is a CRDT-compatible value. This type is used to define objects that can be synchronized
 * using CRDTs.
 */
export type CRDTCompatiblePojo = { [key: string]: CRDTCompatibleValue };

/**
 * CRDTCompatibleValue represents any value that is compatible with CRDTs.
 * It can be a JSON primitive, a CRDT-compatible object, or a CRDT-compatible array.
 * This type encompasses all values that can be part of a CRDT state.
 */
export type CRDTCompatibleValue =
  | JSONPrimitive
  | CRDTCompatiblePojo
  | CRDTCompatibleArray;
