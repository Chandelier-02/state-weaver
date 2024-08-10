import { MappedSchema, Schema } from "@crdt-wrapper/schema";
import * as Y from "yjs";

export type SupportedYType = Y.Array<any> | Y.Map<any> | Y.Text;

export type InitialDataType<S extends Schema> = MappedSchema<S> | Uint8Array[];
