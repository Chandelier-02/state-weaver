import * as Y from "yjs";

export type SupportedYType = Y.Array<any> | Y.Map<any> | Y.Text;

export type Result<T> = {
  value: T;
  error?: Error;
};
