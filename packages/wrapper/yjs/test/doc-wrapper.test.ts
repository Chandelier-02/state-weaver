import * as Y from "yjs";
import { YjsDocWrapper } from "../src/doc-wrapper";
import { describe, expect, test, beforeEach, afterEach } from "vitest";

describe("YjsDocWrapper", () => {
  let doc: Y.Doc;

  beforeEach(() => {
    doc = new Y.Doc();
  });

  afterEach(() => {
    doc.destroy();
  });

  test("should initialize and update a top-level Y.Map", () => {
    const initialObject = { myMap: { key1: "value1", key2: "value2" } };
    const wrapper = new YjsDocWrapper<typeof initialObject, Uint8Array>(
      initialObject
    );

    wrapper.update("myMap", (snapshot) => {
      snapshot.key1 = "newValue";
      snapshot.key2 = "newValue2";
    });

    expect(wrapper.getDocState().get("myMap")).toEqual({
      key1: "newValue",
      key2: "newValue2",
    });
  });

  test("should handle deep object modifications", () => {
    const initialObject = { myMap: { level1: { level2: { key: "value" } } } };
    const wrapper = new YjsDocWrapper<typeof initialObject, Uint8Array>(
      initialObject
    );

    wrapper.update("myMap", (snapshot) => {
      snapshot.level1.level2.key = "newValue";
    });

    expect(wrapper.getDocState().get("myMap")).toEqual({
      level1: { level2: { key: "newValue" } },
    });
  });

  describe("Local string modifications", () => {
    test("basic string replacement", () => {
      const initialObject = { myText: "Hello, world!" };
      const wrapper = new YjsDocWrapper<typeof initialObject, Uint8Array>(
        initialObject
      );

      wrapper.update("myText", () => "Hello, user!");

      expect(wrapper.getDocState().get("myText")).toEqual("Hello, user!");
    });

    test("string appending", () => {
      const initialObject = { myText: "Hello" };
      const wrapper = new YjsDocWrapper<typeof initialObject, Uint8Array>(
        initialObject
      );

      wrapper.update("myText", (text) => text + ", world!");

      expect(wrapper.getDocState().get("myText")).toEqual("Hello, world!");
    });
  });

  describe("Local array modifications", () => {
    test("adding elements", () => {
      const initialObject = { myArray: ["item1"] };
      const wrapper = new YjsDocWrapper<typeof initialObject, Uint8Array>(
        initialObject
      );

      wrapper.update("myArray", (array) => {
        array.push("item2");
      });

      expect(wrapper.getDocState().get("myArray")).toEqual(["item1", "item2"]);
    });

    test("removing elements", () => {
      const initialObject = { myArray: ["item1", "item2"] };
      const wrapper = new YjsDocWrapper<typeof initialObject, Uint8Array>(
        initialObject
      );

      wrapper.update("myArray", (array) => {
        array.pop();
      });

      expect(wrapper.getDocState().get("myArray")).toEqual(["item1"]);
    });
  });

  describe("Subscription tests", () => {
    test("modifications reflect in the snapshot", () => {
      const initialObject = { myMap: { key1: "value1", key2: "value2" } };
      const wrapper = new YjsDocWrapper<typeof initialObject, Uint8Array>(
        initialObject
      );

      let latestSnapshot: any;
      const listener = (
        snapshot: Readonly<(typeof initialObject)["myMap"]>
      ) => {
        latestSnapshot = snapshot;
      };

      wrapper.subscribe("myMap", listener);

      wrapper.update("myMap", (snapshot) => {
        snapshot.key1 = "newValue";
      });

      expect(latestSnapshot).toEqual({ key1: "newValue", key2: "value2" });
    });

    test("attempting to directly modify the snapshot throws an error", () => {
      const initialObject = { myMap: { key1: "value1", key2: "value2" } };
      const wrapper = new YjsDocWrapper<typeof initialObject, Uint8Array>(
        initialObject
      );

      let latestSnapshot: any;
      const listener = (
        snapshot: Readonly<(typeof initialObject)["myMap"]>
      ) => {
        latestSnapshot = snapshot;
      };

      wrapper.subscribe("myMap", listener);

      expect(() => {
        (latestSnapshot as any).newKey = "should not add";
      }).toThrow(TypeError);

      expect(wrapper.getDocState().get("myMap")).toEqual(initialObject.myMap);
    });

    test("attempting to delete properties from the snapshot object throws an error", () => {
      const initialObject = { myMap: { key1: "value1", key2: "value2" } };
      const wrapper = new YjsDocWrapper<typeof initialObject, Uint8Array>(
        initialObject
      );

      let latestSnapshot: any;
      const listener = (
        snapshot: Readonly<(typeof initialObject)["myMap"]>
      ) => {
        latestSnapshot = snapshot;
      };

      wrapper.subscribe("myMap", listener);

      expect(() => {
        delete (latestSnapshot as any).key1;
      }).toThrow(TypeError);

      expect(wrapper.getDocState().get("myMap")).toEqual(initialObject.myMap);
    });

    test("modifications through update function reflect in the snapshot but not directly modifying the snapshot", () => {
      const initialObject = { myMap: { key1: "value1", key2: "value2" } };
      const wrapper = new YjsDocWrapper<typeof initialObject, Uint8Array>(
        initialObject
      );

      let latestSnapshot: any;
      const listener = (
        snapshot: Readonly<(typeof initialObject)["myMap"]>
      ) => {
        latestSnapshot = snapshot;
      };

      wrapper.subscribe("myMap", listener);

      wrapper.update("myMap", (snapshot) => {
        snapshot.key1 = "newValue";
        return snapshot;
      });

      expect(latestSnapshot).toEqual({ key1: "newValue", key2: "value2" });

      expect(() => {
        (latestSnapshot as any).key2 = "should not change";
      }).toThrow(TypeError);

      expect(wrapper.getDocState().get("myMap")).toEqual({
        key1: "newValue",
        key2: "value2",
      });
    });
  });
});
