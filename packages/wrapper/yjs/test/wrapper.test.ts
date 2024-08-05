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
    const wrapper = YjsWrapper.wrap(initialObject, map);

    wrapper.update((snapshot) => {
      snapshot.key1 = "newValue";
      snapshot.key2 = "newValue2";
    });

    expect(wrapper.snapshot).toEqual({ key1: "newValue", key2: "newValue2" });
    expect(map.toJSON()).toEqual({ key1: "newValue", key2: "newValue2" });
  });

  test("deep object modifications", () => {
    const initialObject = { level1: { level2: { key: "value" } } };
    const wrapper = YjsWrapper.wrap(initialObject, map);

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
      const wrapper = YjsWrapper.wrap<{ text: string }>(starterObject, map);

      wrapper.update((snapshot) => {
        const text = snapshot.text;
        return { ...snapshot, text: text.replace("world", "user") };
      });

      expect(wrapper.snapshot.text.toString()).toEqual("Hello, user!");
    });

    test("string appending", () => {
      const starterObject = { text: "Hello" };
      const wrapper = YjsWrapper.wrap<{ text: string }>(starterObject, map);

      wrapper.update((snapshot) => {
        return { ...snapshot, text: snapshot.text + ", world!" };
      });

      expect(wrapper.snapshot.text.toString()).toEqual("Hello, world!");
    });

    test("string truncation", () => {
      const starterObject = { text: "Hello, world!" };
      const wrapper = YjsWrapper.wrap<{ text: string }>(starterObject, map);

      wrapper.update((snapshot) => {
        return { ...snapshot, text: snapshot.text.substring(0, 5) };
      });

      expect(wrapper.snapshot.text.toString()).toEqual("Hello");
    });

    test("complex string manipulation", () => {
      const starterObject = { text: "OpenAI GPT-4" };
      const wrapper = YjsWrapper.wrap<{ text: string }>(starterObject, map);

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
      const wrapper = YjsWrapper.wrap<{ text: string }>(starterObject, map);

      wrapper.update((snapshot) => {
        return { ...snapshot, text: "" };
      });

      expect(wrapper.snapshot.text.toString()).toEqual("");
    });
  });

  describe("Array modifications", () => {
    test("push item to array", () => {
      const initialArray = [1, 2, 3];
      const wrapper = YjsWrapper.wrap(initialArray, array);

      wrapper.update((snapshot) => {
        snapshot.push(4);
      });

      expect(wrapper.snapshot).toEqual([1, 2, 3, 4]);
      expect(array.toArray()).toEqual([1, 2, 3, 4]);
    });

    test("splice item from array", () => {
      const initialArray = [1, 2, 3];
      const wrapper = YjsWrapper.wrap(initialArray, array);

      wrapper.update((snapshot) => {
        snapshot.splice(1, 1);
      });

      expect(wrapper.snapshot).toEqual([1, 3]);
      expect(array.toArray()).toEqual([1, 3]);
    });

    test("replace array items", () => {
      const initialArray = [1, 2, 3];
      const wrapper = YjsWrapper.wrap(initialArray, array);

      wrapper.update((snapshot) => {
        snapshot.splice(0, 2, 4, 5);
      });

      expect(wrapper.snapshot).toEqual([4, 5, 3]);
      expect(array.toArray()).toEqual([4, 5, 3]);
    });

    test("clear array", () => {
      const initialArray = [1, 2, 3];
      const wrapper = YjsWrapper.wrap(initialArray, array);

      wrapper.update((snapshot) => {
        snapshot.splice(0, snapshot.length);
      });

      expect(wrapper.snapshot).toEqual([]);
      expect(array.toArray()).toEqual([]);
    });

    test("push multiple items", () => {
      const initialArray = [1, 2, 3];
      const wrapper = YjsWrapper.wrap(initialArray, array);

      wrapper.update((snapshot) => {
        snapshot.push(4, 5, 6);
      });

      expect(wrapper.snapshot).toEqual([1, 2, 3, 4, 5, 6]);
      expect(array.toArray()).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test("nested array modification", () => {
      const initialArray = [1, [2, 3], 4];
      const wrapper = YjsWrapper.wrap(initialArray, array);

      wrapper.update((snapshot) => {
        (snapshot[1] as number[]).push(5);
      });

      expect(wrapper.snapshot).toEqual([1, [2, 3, 5], 4]);
      const yjsArrayJSON = array.toJSON();
      expect(yjsArrayJSON).toEqual([1, [2, 3, 5], 4]);
    });
  });

  test("unbind method", () => {
    const initialObject = { key1: "value1" };
    const wrapper = YjsWrapper.wrap(initialObject, map);

    wrapper.unbind();

    map.set("key2", "value2");

    expect(wrapper.snapshot).toEqual({ key1: "value1" });
  });

  describe("Subscription handling", () => {
    test("subscribe method calls listener on state change", () => {
      const initialObject = { key1: "value1" };
      const wrapper = YjsWrapper.wrap(initialObject, map);

      let latestSnapshot: any;
      const listener = (snapshot: Readonly<typeof initialObject>) => {
        latestSnapshot = snapshot;
      };

      wrapper.subscribe(listener);

      wrapper.update((snapshot) => {
        snapshot.key1 = "newValue";
      });

      expect(latestSnapshot).toEqual({ key1: "newValue" });
      expect(wrapper.snapshot).toEqual(latestSnapshot);
    });

    test("unsubscribe method prevents listener from being called", () => {
      const initialObject = { key1: "value1" };
      const wrapper = YjsWrapper.wrap(initialObject, map);

      let callCount = 0;
      const listener = (snapshot: Readonly<typeof initialObject>) => {
        callCount++;
      };

      wrapper.subscribe(listener);

      wrapper.update((snapshot) => {
        snapshot.key1 = "newValue";
      });

      expect(callCount).toBe(1);

      wrapper.unsubscribe(listener);

      wrapper.update((snapshot) => {
        snapshot.key1 = "anotherValue";
      });

      expect(callCount).toBe(1);
    });

    test("multiple listeners receive updates", () => {
      const initialObject = { key1: "value1" };
      const wrapper = YjsWrapper.wrap(initialObject, map);

      let listener1CallCount = 0;
      const listener1 = (snapshot: Readonly<typeof initialObject>) => {
        listener1CallCount++;
      };

      let listener2CallCount = 0;
      const listener2 = (snapshot: Readonly<typeof initialObject>) => {
        listener2CallCount++;
      };

      wrapper.subscribe(listener1);
      wrapper.subscribe(listener2);

      wrapper.update((snapshot) => {
        snapshot.key1 = "newValue";
      });

      expect(listener1CallCount).toBe(1);
      expect(listener2CallCount).toBe(1);

      wrapper.unsubscribe(listener1);

      wrapper.update((snapshot) => {
        snapshot.key1 = "anotherValue";
      });

      expect(listener1CallCount).toBe(1);
      expect(listener2CallCount).toBe(2);
    });
  });

  describe("Read-only snapshot enforcement", () => {
    test("attempting to modify the snapshot object directly has no effect", () => {
      const initialObject = { key1: "value1", key2: "value2" };
      const wrapper = YjsWrapper.wrap(initialObject, map);

      let latestSnapshot: any;
      const listener = (snapshot: Readonly<typeof initialObject>) => {
        latestSnapshot = snapshot;
      };

      wrapper.subscribe(listener);

      expect(() => {
        (latestSnapshot as any).key1 = "should not change";
      }).toThrow(TypeError);

      expect(wrapper.snapshot).toEqual(initialObject);
      expect(map.toJSON()).toEqual(initialObject);
    });

    test("attempting to add properties to the snapshot object throws an error", () => {
      const initialObject = { key1: "value1", key2: "value2" };
      const wrapper = YjsWrapper.wrap(initialObject, map);

      let latestSnapshot: any;
      const listener = (snapshot: Readonly<typeof initialObject>) => {
        latestSnapshot = snapshot;
      };

      wrapper.subscribe(listener);

      expect(() => {
        (latestSnapshot as any).newKey = "should not add";
      }).toThrow(TypeError);

      expect(wrapper.snapshot).toEqual(initialObject);
      expect(map.toJSON()).toEqual(initialObject);
    });

    test("attempting to delete properties from the snapshot object throws an error", () => {
      const initialObject = { key1: "value1", key2: "value2" };
      const wrapper = YjsWrapper.wrap(initialObject, map);

      let latestSnapshot: any;
      const listener = (snapshot: Readonly<typeof initialObject>) => {
        latestSnapshot = snapshot;
      };

      wrapper.subscribe(listener);

      expect(() => {
        delete (latestSnapshot as any).key1;
      }).toThrow(TypeError);

      expect(wrapper.snapshot).toEqual(initialObject);
      expect(map.toJSON()).toEqual(initialObject);
    });

    test("modifications through update function reflect in the snapshot but not directly modifying the snapshot", () => {
      const initialObject = { key1: "value1", key2: "value2" };
      const wrapper = YjsWrapper.wrap(initialObject, map);

      let latestSnapshot: any;
      const listener = (snapshot: Readonly<typeof initialObject>) => {
        latestSnapshot = snapshot;
      };

      wrapper.subscribe(listener);

      wrapper.update((snapshot) => {
        snapshot.key1 = "newValue";
        return snapshot;
      });

      expect(latestSnapshot).toEqual({ key1: "newValue", key2: "value2" });

      expect(() => {
        (latestSnapshot as any).key2 = "should not change";
      }).toThrow(TypeError);

      expect(wrapper.snapshot).toEqual({ key1: "newValue", key2: "value2" });
    });
  });
});
