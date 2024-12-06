import * as Y from "yjs";

export type SupportedYType = Y.Array<any> | Y.Map<any> | Y.Text;

type MaxDepth = 25;

export type StringPropertyPath<
  T,
  P extends string = "",
  D extends number[] = []
> = D["length"] extends MaxDepth
  ? never
  : T extends string
  ? P
  : T extends (infer U)[]
  ? StringPropertyPath<U, `${P}[]`, [0, ...D]>
  : T extends object
  ? {
      [K in keyof T & (string | number)]: StringPropertyPath<
        T[K],
        P extends "" ? `${K}` : `${P}.${K}`,
        [0, ...D]
      >;
    }[keyof T & (string | number)]
  : never;
