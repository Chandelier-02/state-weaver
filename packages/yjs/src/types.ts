import { JsonObject, JsonValue } from "type-fest";
import * as Y from "yjs";

export type SupportedYType = Y.Array<any> | Y.Map<any> | Y.Text;

type MaxDepth = 25;

export type StringPropertyPath<
  T extends JsonObject,
  P extends string = "",
  D extends number[] = []
> = D["length"] extends MaxDepth
  ? never
  : T extends string
  ? P
  : {
      [K in keyof T & string]: T[K] extends JsonObject
        ? StringPropertyPath<
            T[K],
            P extends "" ? `${K}` : `${P}.${K}`,
            [0, ...D]
          >
        : T[K] extends (infer U)[]
        ? U extends JsonObject
          ? StringPropertyPath<
              U,
              P extends "" ? `${K}[]` : `${P}.${K}[]`,
              [0, ...D]
            >
          : U extends string
          ? P extends ""
            ? `${K}[]`
            : `${P}.${K}[]`
          : never
        : T[K] extends string
        ? P extends ""
          ? `${K}`
          : `${P}.${K}`
        : never;
    }[keyof T & string];
