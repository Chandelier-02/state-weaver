import { YjsWrapper } from "../src/wrapper"; // Adjust the path as needed
import * as Y from "yjs";
import { describe, expect, test, beforeEach } from "vitest";

describe("YjsWrapper", () => {
  let doc: Y.Doc;
  let map: Y.Map<any>;
  let array: Y.Array<any>;
  let text: Y.Text;

  beforeEach(() => {
    doc = new Y.Doc();
    map = doc.getMap("map");
    array = doc.getArray("array");
    text = doc.getText("text");
  });

  test("wrap method with object replacement", () => {
    const initialObject = { key1: "value1", key2: "value2" };
    const { wrapper } = YjsWrapper.wrap(initialObject, map);

    wrapper.update((snapshot) => {
      snapshot.key1 = "newValue";
      snapshot.key2 = "newValue2";
    });

    expect(wrapper.snapshot).toEqual({ key1: "newValue", key2: "newValue2" });
  });

  test("deep object modifications", () => {
    const initialObject = { level1: { level2: { key: "value" } } };
    const { wrapper } = YjsWrapper.wrap(initialObject, map);

    wrapper.update((snapshot) => {
      snapshot.level1.level2.key = "newValue";
    });

    expect(wrapper.snapshot).toEqual({
      level1: { level2: { key: "newValue" } },
    });
  });

  test("Local string modifications", () => {
    map.set("text", text);
    const starterObject = {
      text: "Hello, world!",
    };

    const { wrapper } = YjsWrapper.wrap<{ text: string }>(starterObject, map);

    wrapper.update((snapshot) => {
      const text = snapshot.text;
      return { ...snapshot, text: text.replace("world", "user") };
    });

    expect(wrapper.snapshot.text.toString()).toEqual("Hello, user!");
  });

  test("array modifications", () => {
    const initialArray = [1, 2, 3];
    const { wrapper } = YjsWrapper.wrap(initialArray, array);

    wrapper.update((snapshot) => {
      snapshot.push(4);
    });

    expect(wrapper.snapshot).toEqual([1, 2, 3, 4]);

    wrapper.update((snapshot) => {
      snapshot.splice(1, 1);
    });

    expect(wrapper.snapshot).toEqual([1, 3, 4]);
  });

  test("applyCRDTUpdate method", () => {
    const initialObject = { key1: "value1" };
    const { wrapper } = YjsWrapper.wrap(initialObject, map);
    const newDoc = new Y.Doc();
    const newMap = newDoc.getMap("map");

    newMap.set("key2", "value2");
    const update = Y.encodeStateAsUpdate(newDoc);

    wrapper.applyCRDTUpdate(update);

    expect(wrapper.snapshot).toEqual({ key1: "value1", key2: "value2" });
  });

  test("unbind method", () => {
    const initialObject = { key1: "value1" };
    const { wrapper } = YjsWrapper.wrap(initialObject, map);

    wrapper.unbind();

    map.set("key2", "value2");

    expect(wrapper.snapshot).toEqual({ key1: "value1" });
  });
});
