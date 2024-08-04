import * as Y from "yjs";

/**
 * SupportedSource is a type alias for supported Yjs shared types.
 * This type represents the Yjs data structures that can be used as sources in various operations.
 * Currently, it includes Y.Array and Y.Map, which are commonly used for representing arrays and objects, respectively.
 *
 * @typedef {Y.Array<any> | Y.Map<any>} SupportedSource
 */
export type SupportedSource = Y.Array<any> | Y.Map<any>;
