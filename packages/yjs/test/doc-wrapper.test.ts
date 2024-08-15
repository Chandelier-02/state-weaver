import { YjsWrapper } from "../src/index";
import * as Y from "yjs";
import { describe, expect, test, beforeEach } from "vitest";

import { defineSchema, MappedSchema } from "@crdt-wrapper/schema";

describe("YjsWrapper", () => {
  const schema = defineSchema({
    key1: "string",
    key2: "string",
    level1: {
      level2: {
        key: "string",
      },
    },
    text: "string",
    array: ["number"],
  });
  const initialObject: MappedSchema<typeof schema> = {
    key1: "value1",
    key2: "value2",
    level1: {
      level2: {
        key: "value",
      },
    },
    text: "Hello, world!",
    array: [1, 2, 3],
  };
  let doc: Y.Doc;

  beforeEach(() => {
    doc = new Y.Doc();
  });

  test("wrap method with object replacement", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.key1 = "newValue";
      snapshot.key2 = "newValue2";
      snapshot.key1 = "newNewValue";
    });

    expect(wrapper.state).toEqual({
      ...initialObject,
      key1: "newNewValue",
      key2: "newValue2",
    });
  });

  test("deep object modifications", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.level1.level2.key = "newValue";
    });

    expect(wrapper.state.level1.level2.key).toBe("newValue");
  });

  test("replace entire object", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    const newObject = {
      key1: "newKey1",
      key2: "newKey2",
      level1: {
        level2: {
          key: "newKey",
        },
      },
      text: "New text",
      array: [4, 5, 6],
    };

    wrapper.update(() => newObject);

    expect(wrapper.state).toEqual(newObject);
  });

  describe("Local string modifications", () => {
    test("basic string replacement", () => {
      const wrapper = new YjsWrapper(schema, initialObject);

      wrapper.update((snapshot) => {
        snapshot.text = snapshot.text.replace("world", "user");
      });

      expect(wrapper.state.text).toBe("Hello, user!");
    });

    test("string appending", () => {
      const wrapper = new YjsWrapper(schema, initialObject);

      wrapper.update((snapshot) => {
        snapshot.text = snapshot.text + ", world!";
      });

      expect(wrapper.state.text).toBe("Hello, world!, world!");
    });

    test("string truncation", () => {
      const wrapper = new YjsWrapper(schema, initialObject);

      wrapper.update((snapshot) => {
        snapshot.text = snapshot.text.substring(0, 5);
      });

      expect(wrapper.state.text).toBe("Hello");
    });

    test("complex string manipulation", () => {
      const customSchema = defineSchema({ text: "string" });
      const starterObject = { text: "OpenAI GPT-4" };
      const wrapper = new YjsWrapper(customSchema, starterObject);

      wrapper.update((snapshot) => {
        snapshot.text =
          snapshot.text.replace("GPT-4", "Model") + " is amazing!";
      });

      expect(wrapper.state.text).toBe("OpenAI Model is amazing!");
    });

    test("string replacement with empty", () => {
      const wrapper = new YjsWrapper(schema, initialObject);

      wrapper.update((snapshot) => {
        snapshot.text = "";
      });

      expect(wrapper.state.text).toBe("");
    });
  });

  describe("Array modifications", () => {
    test("push item to array", () => {
      const wrapper = new YjsWrapper(schema, initialObject);

      wrapper.update((snapshot) => {
        snapshot.array.push(4);
      });

      expect(wrapper.state.array).toEqual([1, 2, 3, 4]);
    });

    test("splice item from array", () => {
      const wrapper = new YjsWrapper(schema, initialObject);

      wrapper.update((snapshot) => {
        snapshot.array.splice(1, 1);
      });

      expect(wrapper.state.array).toEqual([1, 3]);
    });

    test("replace array items", () => {
      const wrapper = new YjsWrapper(schema, initialObject);

      wrapper.update((snapshot) => {
        snapshot.array.splice(0, 2, 4, 5);
      });

      expect(wrapper.state.array).toEqual([4, 5, 3]);
    });

    test("clear array", () => {
      const wrapper = new YjsWrapper(schema, initialObject);

      wrapper.update((snapshot) => {
        snapshot.array.splice(0, snapshot.array.length);
      });

      expect(wrapper.state.array).toEqual([]);
    });

    test("push multiple items", () => {
      const wrapper = new YjsWrapper(schema, initialObject);

      wrapper.update((snapshot) => {
        snapshot.array.push(4, 5, 6);
      });

      expect(wrapper.state.array).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test("nested array modification", () => {
      const nestedArraySchema = defineSchema({ array: [["number"]] });
      const nestedArrayObject = { array: [[2, 3]] };
      const wrapper = new YjsWrapper(nestedArraySchema, nestedArrayObject);

      wrapper.update((snapshot) => {
        (snapshot.array[0] as number[]).push(5);
      });

      expect(wrapper.state.array).toEqual([[2, 3, 5]]);
    });

    test("replace entire array", () => {
      const wrapper = new YjsWrapper(schema, initialObject);

      wrapper.update((snapshot) => {
        snapshot.array = [7, 8, 9];
      });

      expect(wrapper.state.array).toEqual([7, 8, 9]);
    });

    test("nested array deep modification", () => {
      const nestedArraySchema = defineSchema({
        level1: {
          array: [["number"]],
        },
      });
      const nestedArrayObject = {
        level1: {
          array: [[2, 3]],
        },
      };
      const wrapper = new YjsWrapper(nestedArraySchema, nestedArrayObject);

      wrapper.update((snapshot) => {
        (snapshot.level1.array[0] as number[]).push(5);
      });

      expect(wrapper.state.level1.array).toEqual([[2, 3, 5]]);
    });

    test("deep nested array replacement", () => {
      const deepNestedArraySchema = defineSchema({
        level1: {
          level2: {
            array: ["number"],
          },
        },
      });
      const deepNestedArrayObject = {
        level1: {
          level2: {
            array: [1, 2, 3],
          },
        },
      };
      const wrapper = new YjsWrapper(
        deepNestedArraySchema,
        deepNestedArrayObject
      );

      wrapper.update((snapshot) => {
        snapshot.level1.level2.array = [4, 5, 6];
      });

      expect(wrapper.state.level1.level2.array).toEqual([4, 5, 6]);
    });
  });
});

describe("YjsWrapper - Deeply Nested Structures", () => {
  const schema = defineSchema({
    level1: {
      level2: {
        key: "string",
        nestedArray: [
          {
            level3: {
              key: "string",
              level4: ["string"],
            },
          },
        ],
      },
    },
    array: [
      {
        key: "string",
        nestedArray: [
          {
            key: "string",
            deeperArray: ["number"],
          },
        ],
      },
    ],
  });

  const initialObject: MappedSchema<typeof schema> = {
    level1: {
      level2: {
        key: "value",
        nestedArray: [
          {
            level3: {
              key: "nestedValue",
              level4: ["deep", "deeper", "deepest"],
            },
          },
        ],
      },
    },
    array: [
      {
        key: "arrayValue",
        nestedArray: [
          {
            key: "nestedArrayValue",
            deeperArray: [1, 2, 3],
          },
        ],
      },
    ],
  };

  test("deeply nested object modifications", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.level1.level2.nestedArray[0].level3.level4[2] =
        "newDeepestValue";
    });

    expect(wrapper.state.level1.level2.nestedArray[0].level3.level4[2]).toBe(
      "newDeepestValue"
    );
  });

  test("deeply nested array modifications", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.array[0].nestedArray[0].deeperArray.push(4, 5, 6);
    });

    expect(wrapper.state.array[0].nestedArray[0].deeperArray).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  test("nested object within array modification", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.array[0].nestedArray[0].key = "newNestedArrayValue";
    });

    expect(wrapper.state.array[0].nestedArray[0].key).toBe(
      "newNestedArrayValue"
    );
  });

  test("nested array within object modification", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.level1.level2.nestedArray[0].level3.key = "newNestedValue";
    });

    expect(wrapper.state.level1.level2.nestedArray[0].level3.key).toBe(
      "newNestedValue"
    );
  });

  test("replace deeply nested object", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.level1.level2 = {
        key: "newLevel2Value",
        nestedArray: [
          {
            level3: {
              key: "newLevel3Value",
              level4: ["new", "deep", "array"],
            },
          },
        ],
      };
    });

    expect(wrapper.state.level1.level2.key).toBe("newLevel2Value");
    expect(wrapper.state.level1.level2.nestedArray[0].level3.key).toBe(
      "newLevel3Value"
    );
    expect(wrapper.state.level1.level2.nestedArray[0].level3.level4).toEqual([
      "new",
      "deep",
      "array",
    ]);
  });

  test("deep nested structure updates", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.level1.level2.nestedArray[0].level3.level4[1] = "changed";
      snapshot.array[0].nestedArray[0].deeperArray[1] = 99;
    });

    expect(wrapper.state.level1.level2.nestedArray[0].level3.level4[1]).toBe(
      "changed"
    );
    expect(wrapper.state.array[0].nestedArray[0].deeperArray[1]).toBe(99);
  });

  test("replace entire object", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    const newObject = {
      level1: {
        level2: {
          key: "newValue",
          nestedArray: [
            {
              level3: {
                key: "newNestedValue",
                level4: ["new", "values"],
              },
            },
          ],
        },
      },
      array: [
        {
          key: "newArrayValue",
          nestedArray: [
            {
              key: "newNestedArrayValue",
              deeperArray: [7, 8, 9],
            },
          ],
        },
      ],
    };

    wrapper.update(() => newObject);

    expect(wrapper.state).toEqual(newObject);
  });
});

describe("YjsWrapper - Text Editing Tests", () => {
  const schema = defineSchema({
    text: "string",
  });
  const initialObject = {
    text: "Hello, world!",
  };

  test("basic text replacement", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text.replace("world", "user");
    });

    expect(wrapper.state.text).toBe("Hello, user!");
  });

  test("inserting text at the beginning", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = "Hi, " + snapshot.text;
    });

    expect(wrapper.state.text).toBe("Hi, Hello, world!");
  });

  test("inserting text at the end", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text + " How are you?";
    });

    expect(wrapper.state.text).toBe("Hello, world! How are you?");
  });

  test("inserting text in the middle", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      const position = snapshot.text.indexOf("world");
      snapshot.text =
        snapshot.text.slice(0, position) +
        "beautiful " +
        snapshot.text.slice(position);
    });

    expect(wrapper.state.text).toBe("Hello, beautiful world!");
  });

  test("removing text from the beginning", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text.substring(7);
    });

    expect(wrapper.state.text).toBe("world!");
  });

  test("removing text from the end", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text.slice(0, -7);
    });

    expect(wrapper.state.text).toBe("Hello,");
  });

  test("removing text from the middle", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text.replace(", world", "");
    });

    expect(wrapper.state.text).toBe("Hello!");
  });

  test("replacing all text", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = "Goodbye, world!";
    });

    expect(wrapper.state.text).toBe("Goodbye, world!");
  });

  test("replacing text with empty string", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = "";
    });

    expect(wrapper.state.text).toBe("");
  });

  test("complex text manipulation", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text.toUpperCase();
    });

    expect(wrapper.state.text).toBe("HELLO, WORLD!");

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text.split("").reverse().join("");
    });

    expect(wrapper.state.text).toBe("!DLROW ,OLLEH");
  });

  test("replacing a single character", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      const position = snapshot.text.indexOf("H");
      snapshot.text =
        snapshot.text.slice(0, position) +
        "J" +
        snapshot.text.slice(position + 1);
    });

    expect(wrapper.state.text).toBe("Jello, world!");
  });

  test("removing a single character", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      const position = snapshot.text.indexOf(",");
      snapshot.text =
        snapshot.text.slice(0, position) + snapshot.text.slice(position + 1);
    });

    expect(wrapper.state.text).toBe("Hello world!");
  });

  test("adding multiple lines of text", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.text += "\nHow are you?\nI am fine.";
    });

    expect(wrapper.state.text).toBe("Hello, world!\nHow are you?\nI am fine.");
  });

  test("replacing text with multiple lines", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = "First line\nSecond line\nThird line";
    });

    expect(wrapper.state.text).toBe("First line\nSecond line\nThird line");
  });

  test("appending text with special characters", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.text += " $%^&*()!";
    });

    expect(wrapper.state.text).toBe("Hello, world! $%^&*()!");
  });

  test("removing text with special characters", () => {
    const wrapper = new YjsWrapper(schema, {
      text: "Special characters $%^&*()!",
    });

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text.replace(" $%^&*()!", "");
    });

    expect(wrapper.state.text).toBe("Special characters");
  });

  test("replacing part of a string with another string", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text.replace("world", "everyone");
    });

    expect(wrapper.state.text).toBe("Hello, everyone!");
  });

  test("handling empty initial text", () => {
    const wrapper = new YjsWrapper(schema, { text: "" });

    wrapper.update((snapshot) => {
      snapshot.text = "New text added!";
    });

    expect(wrapper.state.text).toBe("New text added!");
  });

  test("handling large text insertions", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.text += " ".repeat(1000) + "End";
    });

    expect(wrapper.state.text.endsWith("End")).toBe(true);
  });

  test("handling repeated text modifications", () => {
    const wrapper = new YjsWrapper(schema, initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text + " again";
    });

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text.replace("again", "yet again");
    });

    expect(wrapper.state.text).toBe("Hello, world! yet again");
  });
});

describe("YjsWrapper - Re-creation from Yjs Updates", () => {
  const schema = defineSchema({
    key1: "string",
    key2: "string",
    level1: {
      level2: {
        key: "string",
      },
    },
    text: "string",
    array: ["number"],
  });
  const initialObject = {
    key1: "value1",
    key2: "value2",
    level1: {
      level2: {
        key: "value",
      },
    },
    text: "Hello, world!",
    array: [1, 2, 3],
  };

  test("create wrapper from state update", () => {
    // Create the initial wrapper
    const originalWrapper = new YjsWrapper(schema, initialObject);

    // Get the state update from the original wrapper's Y.Doc
    const stateUpdate = Y.encodeStateAsUpdate(originalWrapper.yDoc);

    // Create a new wrapper using the state update
    const newWrapper = new YjsWrapper(schema, [stateUpdate]);

    // Both wrappers should have the same state
    expect(newWrapper.state).toEqual(originalWrapper.state);
  });

  test("create wrapper from state update and apply additional changes", () => {
    // Create the initial wrapper
    const originalWrapper = new YjsWrapper(schema, initialObject);

    // Make some updates to the original wrapper
    originalWrapper.update((snapshot) => {
      snapshot.key1 = "newValue";
      snapshot.array.push(4);
    });

    // Get the state update from the original wrapper's Y.Doc
    const stateUpdate = Y.encodeStateAsUpdate(originalWrapper.yDoc);

    // Create a new wrapper using the state update
    const newWrapper = new YjsWrapper(schema, [stateUpdate]);

    // The new wrapper should reflect the changes made to the original wrapper
    expect(newWrapper.state).toEqual({
      key1: "newValue",
      key2: "value2",
      level1: {
        level2: {
          key: "value",
        },
      },
      text: "Hello, world!",
      array: [1, 2, 3, 4],
    });
  });

  test("create wrapper from state update with nested object modifications", () => {
    // Create the initial wrapper
    const originalWrapper = new YjsWrapper(schema, initialObject);

    // Modify nested objects
    originalWrapper.update((snapshot) => {
      snapshot.level1.level2.key = "deepValue";
    });

    // Get the state update from the original wrapper's Y.Doc
    const stateUpdate = Y.encodeStateAsUpdate(originalWrapper.yDoc);

    // Create a new wrapper using the state update
    const newWrapper = new YjsWrapper(schema, [stateUpdate]);

    // Both wrappers should have the same state, including nested modifications
    expect(newWrapper.state).toEqual({
      key1: "value1",
      key2: "value2",
      level1: {
        level2: {
          key: "deepValue",
        },
      },
      text: "Hello, world!",
      array: [1, 2, 3],
    });
  });

  test("apply update to new wrapper and make further modifications", () => {
    // Create the initial wrapper
    const originalWrapper = new YjsWrapper(schema, initialObject);

    // Get the state update from the original wrapper's Y.Doc
    const stateUpdate = Y.encodeStateAsUpdate(originalWrapper.yDoc);

    // Create a new wrapper using the state update
    const newWrapper = new YjsWrapper(schema, [stateUpdate]);

    // Further modify the new wrapper
    newWrapper.update((snapshot) => {
      snapshot.key1 = "furtherUpdatedValue";
      snapshot.array.splice(1, 1, 100);
    });

    expect(newWrapper.state).toEqual({
      key1: "furtherUpdatedValue",
      key2: "value2",
      level1: {
        level2: {
          key: "value",
        },
      },
      text: "Hello, world!",
      array: [1, 100, 3],
    });
  });
});

// TODO: Fix top level logic...
describe("YjsWrapper - Synchronizing Multiple Wrappers", () => {
  const schema = defineSchema({
    key1: "string",
    key2: "string",
    level1: {
      level2: {
        key: "string",
      },
    },
    text: "string",
    array: ["number"],
  });
  const initialObject = {
    key1: "value1",
    key2: "value2",
    level1: {
      level2: {
        key: "value",
      },
    },
    text: "Hello, world!",
    array: [1, 2, 3],
  };

  test("synchronize deep object modifications between wrappers", () => {
    const wrapper1 = new YjsWrapper(schema, initialObject);
    const wrapper1InitialUpdate = Y.encodeStateAsUpdate(wrapper1.yDoc);

    const wrapper2 = new YjsWrapper(schema, [wrapper1InitialUpdate]);

    const svBeforeChange = Y.encodeStateVector(wrapper1.yDoc);

    // Modify a deep nested structure in the first wrapper
    wrapper1.update((snapshot) => {
      snapshot.level1.level2.key = "newDeepValue";
    });

    const objectModificationUpdate = Y.encodeStateAsUpdate(
      wrapper1.yDoc,
      svBeforeChange
    );

    // Apply updates to the second wrapper
    wrapper2.applyUpdates([objectModificationUpdate]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state).toEqual(wrapper2.state);
    expect(wrapper2.state.level1.level2.key).toBe("newDeepValue");
  });

  test("synchronize array modifications between wrappers", () => {
    const wrapper1 = new YjsWrapper(schema, initialObject);
    const wrapper1InitialUpdate = Y.encodeStateAsUpdate(wrapper1.yDoc);

    const wrapper2 = new YjsWrapper(schema, [wrapper1InitialUpdate]);

    const svBeforeChange = Y.encodeStateVector(wrapper1.yDoc);

    // Modify the array in the first wrapper
    wrapper1.update((snapshot) => {
      snapshot.array.push(4, 5, 6);
    });

    const arrayModificationUpdate = Y.encodeStateAsUpdate(
      wrapper1.yDoc,
      svBeforeChange
    );

    // Apply updates to the second wrapper
    wrapper2.applyUpdates([arrayModificationUpdate]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state.array).toEqual([1, 2, 3, 4, 5, 6]);
    expect(wrapper1.state).toEqual(wrapper2.state);
  });

  test("synchronize nested array and object modifications", () => {
    const nestedArraySchema = defineSchema({ nested: { array: [["number"]] } });
    const nestedArrayObject = { nested: { array: [[2, 3]] } };

    const wrapper1 = new YjsWrapper(nestedArraySchema, nestedArrayObject);
    const wrapper1InitialUpdate = Y.encodeStateAsUpdate(wrapper1.yDoc);

    const wrapper2 = new YjsWrapper(nestedArraySchema, [wrapper1InitialUpdate]);

    const svBeforeChange = Y.encodeStateVector(wrapper1.yDoc);

    // Modify the nested array in the first wrapper
    wrapper1.update((snapshot) => {
      (snapshot.nested.array[0] as number[]).push(5);
    });

    const nestedModificationUpdate = Y.encodeStateAsUpdate(
      wrapper1.yDoc,
      svBeforeChange
    );

    // Apply updates to the second wrapper
    wrapper2.applyUpdates([nestedModificationUpdate]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state.nested.array).toEqual([[2, 3, 5]]);
    expect(wrapper1.state).toEqual(wrapper2.state);
  });

  test("apply multiple updates to synchronize wrappers", () => {
    const wrapper1 = new YjsWrapper(schema, initialObject);
    const wrapper1InitialUpdate = Y.encodeStateAsUpdate(wrapper1.yDoc);

    const wrapper2 = new YjsWrapper(schema, [wrapper1InitialUpdate]);

    const svBeforeChange1 = Y.encodeStateVector(wrapper1.yDoc);

    // Modify the first wrapper multiple times
    wrapper1.update((snapshot) => {
      snapshot.key1 = "newValue1";
    });

    const update1 = Y.encodeStateAsUpdate(wrapper1.yDoc, svBeforeChange1);

    const svBeforeChange2 = Y.encodeStateVector(wrapper1.yDoc);

    wrapper1.update((snapshot) => {
      snapshot.key2 = "newValue2";
    });

    const update2 = Y.encodeStateAsUpdate(wrapper1.yDoc, svBeforeChange2);

    // Apply updates to the second wrapper
    wrapper2.applyUpdates([update1, update2]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state.key1).toBe("newValue1");
    expect(wrapper1.state.key2).toBe("newValue2");
    expect(wrapper1.state).toEqual(wrapper2.state);
  });

  test("synchronize with deep object and array modifications", () => {
    const deepSchema = defineSchema({
      level1: {
        level2: {
          key: "string",
          array: ["number"],
        },
      },
    });

    const deepObject = {
      level1: {
        level2: {
          key: "deepValue",
          array: [1, 2, 3],
        },
      },
    };

    const wrapper1 = new YjsWrapper(deepSchema, deepObject);
    const wrapper1InitialUpdate = Y.encodeStateAsUpdate(wrapper1.yDoc);

    const wrapper2 = new YjsWrapper(deepSchema, [wrapper1InitialUpdate]);

    const svBeforeChange = Y.encodeStateVector(wrapper1.yDoc);

    // Modify deep structure in the first wrapper
    wrapper1.update((snapshot) => {
      snapshot.level1.level2.key = "newDeepValue";
      snapshot.level1.level2.array.push(4, 5);
    });

    const deepModificationUpdate = Y.encodeStateAsUpdate(
      wrapper1.yDoc,
      svBeforeChange
    );

    // Apply updates to the second wrapper
    wrapper2.applyUpdates([deepModificationUpdate]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state.level1.level2.key).toBe("newDeepValue");
    expect(wrapper1.state.level1.level2.array).toEqual([1, 2, 3, 4, 5]);
    expect(wrapper1.state).toEqual(wrapper2.state);
  });

  test("synchronize interleaved deep object modifications between wrappers", () => {
    const wrapper1 = new YjsWrapper(schema, initialObject);
    const wrapper1InitialUpdate = Y.encodeStateAsUpdate(wrapper1.yDoc);

    const wrapper2 = new YjsWrapper(schema, [wrapper1InitialUpdate]);

    const svBeforeChange1 = Y.encodeStateVector(wrapper1.yDoc);
    const svBeforeChange2 = Y.encodeStateVector(wrapper2.yDoc);

    // Modify a deep nested structure in the first wrapper
    wrapper1.update((snapshot) => {
      snapshot.level1.level2.key = "newDeepValue1";
    });

    const update1 = Y.encodeStateAsUpdate(wrapper1.yDoc, svBeforeChange1);

    // Apply the first update to the second wrapper
    wrapper2.applyUpdates([update1]);

    // Modify a deep nested structure in the second wrapper
    wrapper2.update((snapshot) => {
      snapshot.level1.level2.key = "newDeepValue2";
    });

    const update2 = Y.encodeStateAsUpdate(wrapper2.yDoc, svBeforeChange2);

    // Apply the second update back to the first wrapper
    wrapper1.applyUpdates([update2]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state.level1.level2.key).toBe("newDeepValue2");
    expect(wrapper1.state).toEqual(wrapper2.state);
  });

  test("synchronize interleaved array modifications between wrappers", () => {
    const wrapper1 = new YjsWrapper(schema, initialObject);
    const wrapper1InitialUpdate = Y.encodeStateAsUpdate(wrapper1.yDoc);

    const wrapper2 = new YjsWrapper(schema, [wrapper1InitialUpdate]);

    const svBeforeChange1 = Y.encodeStateVector(wrapper1.yDoc);
    const svBeforeChange2 = Y.encodeStateVector(wrapper2.yDoc);

    // Modify the array in the first wrapper
    wrapper1.update((snapshot) => {
      snapshot.array.push(4);
    });

    const update1 = Y.encodeStateAsUpdate(wrapper1.yDoc, svBeforeChange1);

    // Apply the first update to the second wrapper
    wrapper2.applyUpdates([update1]);

    // Modify the array in the second wrapper
    wrapper2.update((snapshot) => {
      snapshot.array.push(5);
    });

    const update2 = Y.encodeStateAsUpdate(wrapper2.yDoc, svBeforeChange2);

    // Apply the second update back to the first wrapper
    wrapper1.applyUpdates([update2]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state.array).toEqual([1, 2, 3, 4, 5]);
    expect(wrapper1.state).toEqual(wrapper2.state);
  });

  test("synchronize interleaved nested array and object modifications", () => {
    const nestedArraySchema = defineSchema({ nested: { array: [["number"]] } });
    const nestedArrayObject = { nested: { array: [[2, 3]] } };

    const wrapper1 = new YjsWrapper(nestedArraySchema, nestedArrayObject);
    const wrapper1InitialUpdate = Y.encodeStateAsUpdate(wrapper1.yDoc);

    const wrapper2 = new YjsWrapper(nestedArraySchema, [wrapper1InitialUpdate]);

    const svBeforeChange1 = Y.encodeStateVector(wrapper1.yDoc);
    const svBeforeChange2 = Y.encodeStateVector(wrapper2.yDoc);

    // Modify the nested array in the first wrapper
    wrapper1.update((snapshot) => {
      (snapshot.nested.array[0] as number[]).push(5);
    });

    const update1 = Y.encodeStateAsUpdate(wrapper1.yDoc, svBeforeChange1);

    // Apply the first update to the second wrapper
    wrapper2.applyUpdates([update1]);

    // Modify the nested array in the second wrapper
    wrapper2.update((snapshot) => {
      (snapshot.nested.array[0] as number[]).push(6);
    });

    const update2 = Y.encodeStateAsUpdate(wrapper2.yDoc, svBeforeChange2);

    // Apply the second update back to the first wrapper
    wrapper1.applyUpdates([update2]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state.nested.array).toEqual([[2, 3, 5, 6]]);
    expect(wrapper1.state).toEqual(wrapper2.state);
  });

  test("synchronize interleaved updates with deep object and array modifications", () => {
    const deepSchema = defineSchema({
      level1: {
        level2: {
          key: "string",
          array: ["number"],
        },
      },
    });

    const deepObject = {
      level1: {
        level2: {
          key: "deepValue",
          array: [1, 2, 3],
        },
      },
    };

    const wrapper1 = new YjsWrapper(deepSchema, deepObject);
    const wrapper1InitialUpdate = Y.encodeStateAsUpdate(wrapper1.yDoc);

    const wrapper2 = new YjsWrapper(deepSchema, [wrapper1InitialUpdate]);

    const svBeforeChange1 = Y.encodeStateVector(wrapper1.yDoc);
    const svBeforeChange2 = Y.encodeStateVector(wrapper2.yDoc);

    // Modify deep structure in the first wrapper
    wrapper1.update((snapshot) => {
      snapshot.level1.level2.key = "newDeepValue1";
      snapshot.level1.level2.array.push(4);
    });

    const update1 = Y.encodeStateAsUpdate(wrapper1.yDoc, svBeforeChange1);

    // Apply the first update to the second wrapper
    wrapper2.applyUpdates([update1]);

    // Modify deep structure in the second wrapper
    wrapper2.update((snapshot) => {
      snapshot.level1.level2.key = "newDeepValue2";
      snapshot.level1.level2.array.push(5);
    });

    const update2 = Y.encodeStateAsUpdate(wrapper2.yDoc, svBeforeChange2);

    // Apply the second update back to the first wrapper
    wrapper1.applyUpdates([update2]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state.level1.level2.key).toBe("newDeepValue2");
    expect(wrapper1.state.level1.level2.array).toEqual([1, 2, 3, 4, 5]);
    expect(wrapper1.state).toEqual(wrapper2.state);
  });
});

describe("Test specific yjs use case", async () => {
  test("Won't duplicate information", async () => {
    const deepSchema = defineSchema({
      level1: {
        level2: {
          key: "string",
          array: ["number"],
        },
      },
    });

    const deepObject = {
      level1: {
        level2: {
          key: "deepValue",
          array: [1, 2, 3],
        },
      },
    };

    const wrapper1 = new YjsWrapper(deepSchema, deepObject);
    const wrapper2 = new YjsWrapper(deepSchema, deepObject);

    wrapper1.update((snapshot) => {
      snapshot.level1.level2.key = "test";
    });

    const wrapper1UpdateState = Y.encodeStateAsUpdate(wrapper1.yDoc);

    wrapper2.applyUpdates([wrapper1UpdateState]);

    console.log(Y.decodeStateVector(Y.encodeStateVector(wrapper1.yDoc)));
    console.log(Y.decodeStateVector(Y.encodeStateVector(wrapper2.yDoc)));

    // TODO: Look into StructStore.addStruct references. That function determines what is added to the store and in what order.
    expect(wrapper1.state).toEqual(wrapper2.state);
  });
});
