export type JSONPrimitive = string | number | boolean | null;

export interface CRDTCompatibleArray extends Array<CRDTCompatibleValue> {}

export type CRDTCompatiblePojo = { [key: string]: CRDTCompatibleValue };

export type CRDTCompatibleValue =
  | JSONPrimitive
  | CRDTCompatiblePojo
  | CRDTCompatibleArray;
