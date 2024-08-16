import * as Y from "yjs";

export function createYTypes(
  value: any,
  yDoc: Y.Doc
): Y.AbstractType<any> | any {
  if (typeof value === "string") {
    const yText = new Y.Text();
    yText.insert(0, value);
    return yText;
  } else if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "symbol" ||
    typeof value === "bigint" ||
    value === null ||
    value === undefined
  ) {
    return value;
  } else if (Array.isArray(value)) {
    const yArray = new Y.Array();
    for (const item of value) {
      yArray.push([createYTypes(item, yDoc)]);
    }
    return yArray;
  } else if (typeof value === "object") {
    const yMap = new Y.Map();
    for (const [key, val] of Object.entries(value)) {
      yMap.set(key, createYTypes(val, yDoc));
    }
    return yMap;
  }
}
