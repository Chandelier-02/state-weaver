export type Primitive =
  | bigint
  | boolean
  | null
  | number
  | string
  | symbol
  | undefined;

export type JSONValue = Primitive | JSONObject | JSONArray;

export type JSONObject = { [key: string]: JSONValue };

export type JSONArray = Array<JSONValue>;

export type Path = (string | number)[];

export type RecurseIntoObject<T, P extends Path> = P extends [
  infer Head,
  ...infer Tail extends Path
]
  ? Head extends keyof T
    ? RecurseIntoObject<T[Head], Tail>
    : never
  : T;

export type SubStructure<T> = RecurseIntoObject<T, (string | number)[]>;

export type Result<T> = { value: T; error?: Error };
