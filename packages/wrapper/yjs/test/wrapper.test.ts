import { YjsWrapper } from "../src/wrapper";
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
    expect(map.toJSON()).toEqual({ key1: "newValue", key2: "newValue2" });
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
    expect(map.toJSON()).toEqual({
      level1: { level2: { key: "newValue" } },
    });
  });

  describe("Local string modifications", () => {
    beforeEach(() => {
      map.set("text", text);
    });

    test("basic string replacement", () => {
      const starterObject = { text: "Hello, world!" };
      const { wrapper } = YjsWrapper.wrap<{ text: string }>(starterObject, map);

      wrapper.update((snapshot) => {
        const text = snapshot.text;
        return { ...snapshot, text: text.replace("world", "user") };
      });

      expect(wrapper.snapshot.text.toString()).toEqual("Hello, user!");
    });

    test("string appending", () => {
      const starterObject = { text: "Hello" };
      const { wrapper } = YjsWrapper.wrap<{ text: string }>(starterObject, map);

      wrapper.update((snapshot) => {
        return { ...snapshot, text: snapshot.text + ", world!" };
      });

      expect(wrapper.snapshot.text.toString()).toEqual("Hello, world!");
    });

    test("string truncation", () => {
      const starterObject = { text: "Hello, world!" };
      const { wrapper } = YjsWrapper.wrap<{ text: string }>(starterObject, map);

      wrapper.update((snapshot) => {
        return { ...snapshot, text: snapshot.text.substring(0, 5) };
      });

      expect(wrapper.snapshot.text.toString()).toEqual("Hello");
    });

    test("complex string manipulation", () => {
      const starterObject = { text: "OpenAI GPT-4" };
      const { wrapper } = YjsWrapper.wrap<{ text: string }>(starterObject, map);

      wrapper.update((snapshot) => {
        return {
          ...snapshot,
          text: snapshot.text.replace("GPT-4", "Model") + " is amazing!",
        };
      });

      expect(wrapper.snapshot.text.toString()).toEqual(
        "OpenAI Model is amazing!"
      );
    });

    test("string replacement with empty", () => {
      const starterObject = { text: "Hello, world!" };
      const { wrapper } = YjsWrapper.wrap<{ text: string }>(starterObject, map);

      wrapper.update((snapshot) => {
        return { ...snapshot, text: "" };
      });

      expect(wrapper.snapshot.text.toString()).toEqual("");
    });
  });

  describe("Array modifications", () => {
    test("push item to array", () => {
      const initialArray = [1, 2, 3];
      const { wrapper } = YjsWrapper.wrap(initialArray, array);

      wrapper.update((snapshot) => {
        snapshot.push(4);
      });

      expect(wrapper.snapshot).toEqual([1, 2, 3, 4]);
      expect(array.toArray()).toEqual([1, 2, 3, 4]);
    });

    test("splice item from array", () => {
      const initialArray = [1, 2, 3];
      const { wrapper } = YjsWrapper.wrap(initialArray, array);

      wrapper.update((snapshot) => {
        snapshot.splice(1, 1);
      });

      expect(wrapper.snapshot).toEqual([1, 3]);
      expect(array.toArray()).toEqual([1, 3]);
    });

    test("replace array items", () => {
      const initialArray = [1, 2, 3];
      const { wrapper } = YjsWrapper.wrap(initialArray, array);

      wrapper.update((snapshot) => {
        snapshot.splice(0, 2, 4, 5);
      });

      expect(wrapper.snapshot).toEqual([4, 5, 3]);
      expect(array.toArray()).toEqual([4, 5, 3]);
    });

    test("clear array", () => {
      const initialArray = [1, 2, 3];
      const { wrapper } = YjsWrapper.wrap(initialArray, array);

      wrapper.update((snapshot) => {
        snapshot.splice(0, snapshot.length);
      });

      expect(wrapper.snapshot).toEqual([]);
      expect(array.toArray()).toEqual([]);
    });

    test("push multiple items", () => {
      const initialArray = [1, 2, 3];
      const { wrapper } = YjsWrapper.wrap(initialArray, array);

      wrapper.update((snapshot) => {
        snapshot.push(4, 5, 6);
      });

      expect(wrapper.snapshot).toEqual([1, 2, 3, 4, 5, 6]);
      expect(array.toArray()).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test("nested array modification", () => {
      const initialArray = [1, [2, 3], 4];
      const { wrapper } = YjsWrapper.wrap(initialArray, array);

      wrapper.update((snapshot) => {
        (snapshot[1] as number[]).push(5);
      });

      expect(wrapper.snapshot).toEqual([1, [2, 3, 5], 4]);
      const yjsArrayJSON = array.toJSON();
      expect(yjsArrayJSON).toEqual([1, [2, 3, 5], 4]);
    });
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
    expect(map.toJSON()).toEqual({ key1: "value1", key2: "value2" });
  });

  test("unbind method", () => {
    const initialObject = { key1: "value1" };
    const { wrapper } = YjsWrapper.wrap(initialObject, map);

    wrapper.unbind();

    map.set("key2", "value2");

    expect(wrapper.snapshot).toEqual({ key1: "value1" });
  });
});
