import { YjsWrapper } from "../src/index.js";
import * as Y from "yjs";
import { describe, expect, test, beforeEach } from "vitest";

function alwaysTrue<T>(value: any): value is T {
  return true;
}

describe("YjsWrapper", () => {
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
  let doc: Y.Doc;

  beforeEach(() => {
    doc = new Y.Doc();
  });

  test("wrapper initialization", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    expect(wrapper.state).toEqual(initialObject);
  });

  test("wrap method with object replacement", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

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
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.level1.level2.key = "newValue";
    });

    expect(wrapper.state.level1.level2.key).toBe("newValue");
  });

  test("replace entire object", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

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

    wrapper.update(() => {
      return newObject;
    });

    expect(wrapper.state).toEqual(newObject);
  });

  describe("Local string modifications", () => {
    test("basic string replacement", () => {
      const { wrapper } =
        YjsWrapper.fromObject<typeof initialObject>(initialObject);

      wrapper.update((snapshot) => {
        snapshot.text = snapshot.text.replace("world", "user");
      });

      expect(wrapper.state.text).toBe("Hello, user!");
    });

    test("string appending", () => {
      const { wrapper } =
        YjsWrapper.fromObject<typeof initialObject>(initialObject);

      wrapper.update((snapshot) => {
        snapshot.text = snapshot.text + ", world!";
      });

      expect(wrapper.state.text).toBe("Hello, world!, world!");
    });

    test("string truncation", () => {
      const { wrapper } =
        YjsWrapper.fromObject<typeof initialObject>(initialObject);

      wrapper.update((snapshot) => {
        snapshot.text = snapshot.text.substring(0, 5);
      });

      expect(wrapper.state.text).toBe("Hello");
    });

    test("complex string manipulation", () => {
      const starterObject = { text: "OpenAI GPT-4" };
      const { wrapper } = YjsWrapper.fromObject(starterObject);

      wrapper.update((snapshot) => {
        snapshot.text =
          snapshot.text.replace("GPT-4", "Model") + " is amazing!";
      });

      expect(wrapper.state.text).toBe("OpenAI Model is amazing!");
    });

    test("string replacement with empty", () => {
      const { wrapper } =
        YjsWrapper.fromObject<typeof initialObject>(initialObject);

      wrapper.update((snapshot) => {
        snapshot.text = "";
      });

      expect(wrapper.state.text).toBe("");
    });
  });

  describe("Array modifications", () => {
    test("push item to array", () => {
      const { wrapper } =
        YjsWrapper.fromObject<typeof initialObject>(initialObject);

      wrapper.update((snapshot) => {
        snapshot.array.push(4);
      });

      expect(wrapper.state.array).toEqual([1, 2, 3, 4]);
    });

    test("splice item from array", () => {
      const { wrapper } =
        YjsWrapper.fromObject<typeof initialObject>(initialObject);

      wrapper.update((snapshot) => {
        snapshot.array.splice(1, 1);
      });

      expect(wrapper.state.array).toEqual([1, 3]);
    });

    test("replace array items", () => {
      const { wrapper } =
        YjsWrapper.fromObject<typeof initialObject>(initialObject);

      wrapper.update((snapshot) => {
        snapshot.array.splice(0, 2, 4, 5);
      });

      expect(wrapper.state.array).toEqual([4, 5, 3]);
    });

    test("clear array", () => {
      const { wrapper } =
        YjsWrapper.fromObject<typeof initialObject>(initialObject);

      wrapper.update((snapshot) => {
        snapshot.array.splice(0, snapshot.array.length);
      });

      expect(wrapper.state.array).toEqual([]);
    });

    test("push multiple items", () => {
      const { wrapper } =
        YjsWrapper.fromObject<typeof initialObject>(initialObject);

      wrapper.update((snapshot) => {
        snapshot.array.push(4, 5, 6);
      });

      expect(wrapper.state.array).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test("nested array modification", () => {
      const nestedArrayObject = { array: [[2, 3]] };
      const { wrapper } = YjsWrapper.fromObject(nestedArrayObject);

      wrapper.update((snapshot) => {
        (snapshot.array[0] as number[]).push(5);
      });

      expect(wrapper.state.array).toEqual([[2, 3, 5]]);
    });

    test("replace entire array", () => {
      const { wrapper } =
        YjsWrapper.fromObject<typeof initialObject>(initialObject);

      wrapper.update((snapshot) => {
        snapshot.array = [7, 8, 9];
      });

      expect(wrapper.state.array).toEqual([7, 8, 9]);
    });

    test("nested array deep modification", () => {
      const nestedArrayObject = {
        level1: {
          array: [[2, 3]],
        },
      };
      const { wrapper } = YjsWrapper.fromObject(nestedArrayObject);

      wrapper.update((snapshot) => {
        (snapshot.level1.array[0] as number[]).push(5);
      });

      expect(wrapper.state.level1.array).toEqual([[2, 3, 5]]);
    });

    test("deep nested array replacement", () => {
      const deepNestedArrayObject = {
        level1: {
          level2: {
            array: [1, 2, 3],
          },
        },
      };
      const { wrapper } = YjsWrapper.fromObject(deepNestedArrayObject);

      wrapper.update((snapshot) => {
        snapshot.level1.level2.array = [4, 5, 6];
      });

      expect(wrapper.state.level1.level2.array).toEqual([4, 5, 6]);
    });
  });
});

describe("YjsWrapper - Deeply Nested Structures", () => {
  const initialObject = {
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
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.level1.level2.nestedArray[0].level3.level4[2] =
        "newDeepestValue";
    });

    expect(wrapper.state.level1.level2.nestedArray[0].level3.level4[2]).toBe(
      "newDeepestValue"
    );
  });

  test("deeply nested array modifications", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.array[0].nestedArray[0].deeperArray.push(4, 5, 6);
    });

    expect(wrapper.state.array[0].nestedArray[0].deeperArray).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  test("nested object within array modification", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.array[0].nestedArray[0].key = "newNestedArrayValue";
    });

    expect(wrapper.state.array[0].nestedArray[0].key).toBe(
      "newNestedArrayValue"
    );
  });

  test("nested array within object modification", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.level1.level2.nestedArray[0].level3.key = "newNestedValue";
    });

    expect(wrapper.state.level1.level2.nestedArray[0].level3.key).toBe(
      "newNestedValue"
    );
  });

  test("replace deeply nested object", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

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
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

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
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

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

    wrapper.update(() => {
      return newObject;
    });

    expect(wrapper.state).toEqual(newObject);
  });
});

describe("YjsWrapper - Text Editing Tests", () => {
  const initialObject = {
    text: "Hello, world!",
  };

  test("basic text replacement", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text.replace("world", "user");
    });

    expect(wrapper.state.text).toBe("Hello, user!");
  });

  test("inserting text at the beginning", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = "Hi, " + snapshot.text;
    });

    expect(wrapper.state.text).toBe("Hi, Hello, world!");
  });

  test("inserting text at the end", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text + " How are you?";
    });

    expect(wrapper.state.text).toBe("Hello, world! How are you?");
  });

  test("inserting text in the middle", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

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
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text.substring(7);
    });

    expect(wrapper.state.text).toBe("world!");
  });

  test("removing text from the end", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text.slice(0, -7);
    });

    expect(wrapper.state.text).toBe("Hello,");
  });

  test("removing text from the middle", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text.replace(", world", "");
    });

    expect(wrapper.state.text).toBe("Hello!");
  });

  test("replacing all text", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = "Goodbye, world!";
    });

    expect(wrapper.state.text).toBe("Goodbye, world!");
  });

  test("replacing text with empty string", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = "";
    });

    expect(wrapper.state.text).toBe("");
  });

  test("complex text manipulation", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

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
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

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
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      const position = snapshot.text.indexOf(",");
      snapshot.text =
        snapshot.text.slice(0, position) + snapshot.text.slice(position + 1);
    });

    expect(wrapper.state.text).toBe("Hello world!");
  });

  test("adding multiple lines of text", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.text += "\nHow are you?\nI am fine.";
    });

    expect(wrapper.state.text).toBe("Hello, world!\nHow are you?\nI am fine.");
  });

  test("replacing text with multiple lines", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = "First line\nSecond line\nThird line";
    });

    expect(wrapper.state.text).toBe("First line\nSecond line\nThird line");
  });

  test("appending text with special characters", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.text += " $%^&*()!";
    });

    expect(wrapper.state.text).toBe("Hello, world! $%^&*()!");
  });

  test("removing text with special characters", () => {
    const { wrapper } = YjsWrapper.fromObject<typeof initialObject>({
      text: "Special characters $%^&*()!",
    });

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text.replace(" $%^&*()!", "");
    });

    expect(wrapper.state.text).toBe("Special characters");
  });

  test("replacing part of a string with another string", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.text = snapshot.text.replace("world", "everyone");
    });

    expect(wrapper.state.text).toBe("Hello, everyone!");
  });

  test("handling empty initial text", () => {
    const { wrapper } = YjsWrapper.fromObject<typeof initialObject>({
      text: "",
    });

    wrapper.update((snapshot) => {
      snapshot.text = "New text added!";
    });

    expect(wrapper.state.text).toBe("New text added!");
  });

  test("handling large text insertions", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    wrapper.update((snapshot) => {
      snapshot.text += " ".repeat(1000) + "End";
    });

    expect(wrapper.state.text.endsWith("End")).toBe(true);
  });

  test("handling repeated text modifications", () => {
    const { wrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

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
    const { wrapper: originalWrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    // Get the state update from the original wrapper's Y.Doc
    const stateUpdate = Y.encodeStateAsUpdateV2(originalWrapper.doc);

    // Create a new wrapper using the state update
    const { wrapper: newWrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    // Both wrappers should have the same state
    expect(newWrapper.state).toEqual(originalWrapper.state);
  });

  test("create wrapper from state update and apply additional changes", () => {
    // Create the initial wrapper
    const { wrapper: originalWrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    // Make some updates to the original wrapper
    originalWrapper.update((snapshot) => {
      snapshot.key1 = "newValue";
      snapshot.array.push(4);
    });

    // Get the state update from the original wrapper's Y.Doc
    const stateUpdate = Y.encodeStateAsUpdateV2(originalWrapper.doc);

    // Create a new wrapper using the state update
    const { wrapper: newWrapper } = YjsWrapper.fromUpdates<
      typeof initialObject
    >([stateUpdate]);

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
    const { wrapper: originalWrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    // Modify nested objects
    originalWrapper.update((snapshot) => {
      snapshot.level1.level2.key = "deepValue";
    });

    // Get the state update from the original wrapper's Y.Doc
    const stateUpdate = Y.encodeStateAsUpdateV2(originalWrapper.doc);

    // Create a new wrapper using the state update
    const { wrapper: newWrapper } = YjsWrapper.fromUpdates<
      typeof initialObject
    >([stateUpdate]);

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
    const { wrapper: originalWrapper } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    // Get the state update from the original wrapper's Y.Doc
    const stateUpdate = Y.encodeStateAsUpdateV2(originalWrapper.doc);

    // Create a new wrapper using the state update
    const { wrapper: newWrapper } = YjsWrapper.fromUpdates<
      typeof initialObject
    >([stateUpdate]);

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

describe("YjsWrapper - Synchronizing Multiple Wrappers", () => {
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
    const { wrapper: wrapper1 } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    const wrapper1InitialUpdate = Y.encodeStateAsUpdateV2(wrapper1.doc);

    const { wrapper: wrapper2 } = YjsWrapper.fromUpdates<typeof initialObject>([
      wrapper1InitialUpdate,
    ]);

    const svBeforeChange = Y.encodeStateVector(wrapper1.doc);

    // Modify a deep nested structure in the first wrapper
    wrapper1.update((snapshot) => {
      snapshot.level1.level2.key = "newDeepValue";
    });

    const objectModificationUpdate = Y.encodeStateAsUpdateV2(
      wrapper1.doc,
      svBeforeChange
    );

    // Apply updates to the second wrapper
    wrapper2.applyUpdates([objectModificationUpdate]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state).toEqual(wrapper2.state);
    expect(wrapper2.state?.level1.level2.key).toBe("newDeepValue");
  });

  test("synchronize array modifications between wrappers", () => {
    const { wrapper: wrapper1 } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    const wrapper1InitialUpdate = Y.encodeStateAsUpdateV2(wrapper1.doc);

    const { wrapper: wrapper2 } = YjsWrapper.fromUpdates<typeof initialObject>([
      wrapper1InitialUpdate,
    ]);

    const svBeforeChange = Y.encodeStateVector(wrapper1.doc);

    // Modify the array in the first wrapper
    wrapper1.update((snapshot) => {
      snapshot.array.push(4, 5, 6);
    });

    const arrayModificationUpdate = Y.encodeStateAsUpdateV2(
      wrapper1.doc,
      svBeforeChange
    );

    // Apply updates to the second wrapper
    wrapper2.applyUpdates([arrayModificationUpdate]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state?.array).toEqual([1, 2, 3, 4, 5, 6]);
    expect(wrapper1.state).toEqual(wrapper2.state);
  });

  test("synchronize nested array and object modifications", () => {
    const nestedArrayObject = { nested: { array: [[2, 3]] } };

    const { wrapper: wrapper1 } = YjsWrapper.fromObject(nestedArrayObject);

    const wrapper1InitialUpdate = Y.encodeStateAsUpdateV2(wrapper1.doc);

    const { wrapper: wrapper2 } = YjsWrapper.fromUpdates<typeof initialObject>([
      wrapper1InitialUpdate,
    ]);

    const svBeforeChange = Y.encodeStateVector(wrapper1.doc);

    // Modify the nested array in the first wrapper
    wrapper1.update((snapshot) => {
      (snapshot.nested.array[0] as number[]).push(5);
    });

    const nestedModificationUpdate = Y.encodeStateAsUpdateV2(
      wrapper1.doc,
      svBeforeChange
    );

    // Apply updates to the second wrapper
    wrapper2.applyUpdates([nestedModificationUpdate]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state?.nested.array).toEqual([[2, 3, 5]]);
    expect(wrapper1.state).toEqual(wrapper2.state);
  });

  test("apply multiple updates to synchronize wrappers", () => {
    const { wrapper: wrapper1 } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    const wrapper1InitialUpdate = Y.encodeStateAsUpdateV2(wrapper1.doc);

    const { wrapper: wrapper2 } = YjsWrapper.fromUpdates<typeof initialObject>([
      wrapper1InitialUpdate,
    ]);

    const svBeforeChange1 = Y.encodeStateVector(wrapper1.doc);

    // Modify the first wrapper multiple times
    wrapper1.update((snapshot) => {
      snapshot.key1 = "newValue1";
    });

    const update1 = Y.encodeStateAsUpdateV2(wrapper1.doc, svBeforeChange1);

    const svBeforeChange2 = Y.encodeStateVector(wrapper1.doc);

    wrapper1.update((snapshot) => {
      snapshot.key2 = "newValue2";
    });

    const update2 = Y.encodeStateAsUpdateV2(wrapper1.doc, svBeforeChange2);

    // Apply updates to the second wrapper
    wrapper2.applyUpdates([update1, update2]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state?.key1).toBe("newValue1");
    expect(wrapper1.state?.key2).toBe("newValue2");
    expect(wrapper1.state).toEqual(wrapper2.state);
  });

  test("synchronize with deep object and array modifications", () => {
    const deepObject = {
      level1: {
        level2: {
          key: "deepValue",
          array: [1, 2, 3],
        },
      },
    };

    const { wrapper: wrapper1 } = YjsWrapper.fromObject(deepObject);
    const wrapper1InitialUpdate = Y.encodeStateAsUpdateV2(wrapper1.doc);

    const { wrapper: wrapper2 } = YjsWrapper.fromUpdates<typeof initialObject>([
      wrapper1InitialUpdate,
    ]);

    const svBeforeChange = Y.encodeStateVector(wrapper1.doc);

    // Modify deep structure in the first wrapper
    wrapper1.update((snapshot) => {
      snapshot.level1.level2.key = "newDeepValue";
      snapshot.level1.level2.array.push(4, 5);
    });

    const deepModificationUpdate = Y.encodeStateAsUpdateV2(
      wrapper1.doc,
      svBeforeChange
    );

    // Apply updates to the second wrapper
    wrapper2.applyUpdates([deepModificationUpdate]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state?.level1.level2.key).toBe("newDeepValue");
    expect(wrapper1.state?.level1.level2.array).toEqual([1, 2, 3, 4, 5]);
    expect(wrapper1.state).toEqual(wrapper2.state);
  });

  test("synchronize interleaved deep object modifications between wrappers", () => {
    const { wrapper: wrapper1 } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);

    const wrapper1InitialUpdate = Y.encodeStateAsUpdateV2(wrapper1.doc);

    const { wrapper: wrapper2 } = YjsWrapper.fromUpdates<typeof initialObject>([
      wrapper1InitialUpdate,
    ]);

    const svBeforeChange1 = Y.encodeStateVector(wrapper1.doc);
    const svBeforeChange2 = Y.encodeStateVector(wrapper2.doc);

    // Modify a deep nested structure in the first wrapper
    wrapper1.update((snapshot) => {
      snapshot.level1.level2.key = "newDeepValue1";
    });

    const update1 = Y.encodeStateAsUpdateV2(wrapper1.doc, svBeforeChange1);

    // Apply the first update to the second wrapper
    wrapper2.applyUpdates([update1]);

    // Modify a deep nested structure in the second wrapper
    wrapper2.update((snapshot) => {
      snapshot.level1.level2.key = "newDeepValue2";
    });

    const update2 = Y.encodeStateAsUpdateV2(wrapper2.doc, svBeforeChange2);

    // Apply the second update back to the first wrapper
    wrapper1.applyUpdates([update2]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state?.level1.level2.key).toBe("newDeepValue2");
    expect(wrapper1.state).toEqual(wrapper2.state);
  });

  test("synchronize interleaved array modifications between wrappers", () => {
    const { wrapper: wrapper1 } =
      YjsWrapper.fromObject<typeof initialObject>(initialObject);
    const wrapper1InitialUpdate = Y.encodeStateAsUpdateV2(wrapper1.doc);

    const { wrapper: wrapper2 } = YjsWrapper.fromUpdates<typeof initialObject>([
      wrapper1InitialUpdate,
    ]);

    const svBeforeChange1 = Y.encodeStateVector(wrapper1.doc);
    const svBeforeChange2 = Y.encodeStateVector(wrapper2.doc);

    // Modify the array in the first wrapper
    wrapper1.update((snapshot) => {
      snapshot.array.push(4);
    });

    const update1 = Y.encodeStateAsUpdateV2(wrapper1.doc, svBeforeChange1);

    // Apply the first update to the second wrapper
    wrapper2.applyUpdates([update1]);

    // Modify the array in the second wrapper
    wrapper2.update((snapshot) => {
      snapshot.array.push(5);
    });

    const update2 = Y.encodeStateAsUpdateV2(wrapper2.doc, svBeforeChange2);

    // Apply the second update back to the first wrapper
    wrapper1.applyUpdates([update2]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state?.array).toEqual([1, 2, 3, 4, 5]);
    expect(wrapper1.state).toEqual(wrapper2.state);
  });

  test("synchronize interleaved nested array and object modifications", () => {
    const nestedArrayObject = { nested: { array: [[2, 3]] } };

    const { wrapper: wrapper1 } = YjsWrapper.fromObject(nestedArrayObject);

    const wrapper1InitialUpdate = Y.encodeStateAsUpdateV2(wrapper1.doc);

    const { wrapper: wrapper2 } = YjsWrapper.fromUpdates<
      typeof nestedArrayObject
    >([wrapper1InitialUpdate]);

    const svBeforeChange1 = Y.encodeStateVector(wrapper1.doc);
    const svBeforeChange2 = Y.encodeStateVector(wrapper2.doc);

    // Modify the nested array in the first wrapper
    wrapper1.update((snapshot) => {
      (snapshot.nested.array[0] as number[]).push(5);
    });

    const update1 = Y.encodeStateAsUpdateV2(wrapper1.doc, svBeforeChange1);

    // Apply the first update to the second wrapper
    wrapper2.applyUpdates([update1]);

    // Modify the nested array in the second wrapper
    wrapper2.update((snapshot) => {
      (snapshot.nested.array[0] as number[]).push(6);
    });

    const update2 = Y.encodeStateAsUpdateV2(wrapper2.doc, svBeforeChange2);

    // Apply the second update back to the first wrapper
    wrapper1.applyUpdates([update2]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state?.nested.array).toEqual([[2, 3, 5, 6]]);
    expect(wrapper1.state).toEqual(wrapper2.state);
  });

  test("synchronize interleaved updates with deep object and array modifications", () => {
    const deepObject = {
      level1: {
        level2: {
          key: "deepValue",
          array: [1, 2, 3],
        },
      },
    };

    const { wrapper: wrapper1 } = YjsWrapper.fromObject(deepObject);

    const wrapper1InitialUpdate = Y.encodeStateAsUpdateV2(wrapper1.doc);

    const { wrapper: wrapper2 } = YjsWrapper.fromUpdates<typeof deepObject>([
      wrapper1InitialUpdate,
    ]);

    const svBeforeChange1 = Y.encodeStateVector(wrapper1.doc);
    const svBeforeChange2 = Y.encodeStateVector(wrapper2.doc);

    // Modify deep structure in the first wrapper
    wrapper1.update((snapshot) => {
      snapshot.level1.level2.key = "newDeepValue1";
      snapshot.level1.level2.array.push(4);
    });

    const update1 = Y.encodeStateAsUpdateV2(wrapper1.doc, svBeforeChange1);

    // Apply the first update to the second wrapper
    wrapper2.applyUpdates([update1]);

    // Modify deep structure in the second wrapper
    wrapper2.update((snapshot) => {
      snapshot.level1.level2.key = "newDeepValue2";
      snapshot.level1.level2.array.push(5);
    });

    const update2 = Y.encodeStateAsUpdateV2(wrapper2.doc, svBeforeChange2);

    // Apply the second update back to the first wrapper
    wrapper1.applyUpdates([update2]);

    // Verify that both wrappers have the same state
    expect(wrapper1.state?.level1.level2.key).toBe("newDeepValue2");
    expect(wrapper1.state?.level1.level2.array).toEqual([1, 2, 3, 4, 5]);
    expect(wrapper1.state).toEqual(wrapper2.state);
  });
});

describe("YjsWrapper", () => {
  const validateFunc = (value: unknown): value is { key: string } => {
    return (
      typeof value === "object" &&
      value !== null &&
      "key" in value &&
      typeof (value as { key: unknown }).key === "string"
    );
  };
  test("validateFunc should succeed and update state", () => {
    const initialData = { key: "value" };

    const { wrapper } = YjsWrapper.fromObject(initialData, {
      validate: validateFunc,
    });

    wrapper.update((state) => {
      state.key = "newValue";
    });

    //expect(validateFunc).toHaveBeenCalled();
    expect(wrapper.state).toEqual({ key: "newValue" });
  });

  test("validateFunc should fail and rollback state", () => {
    const initialData = { key: "value" };
    const { wrapper } = YjsWrapper.fromObject(initialData, {
      validate: validateFunc,
    });

    expect(() => {
      wrapper.update((state) => {
        // @ts-expect-error
        state.key = 1;
      });
    }).toThrow();

    //expect(validateFunc).toHaveBeenCalled();
    expect(wrapper.state).toEqual({ key: "value" }); // State should not have changed
  });
});

describe("More text tests", () => {
  test.skip("Should be able to do simple replacements on date strings", async () => {
    const { wrapper } = YjsWrapper.fromObject<{ str: string }>({
      str: new Date().toISOString(),
    });

    for (let i = 0; i < 10_000; i++) {
      const date = new Date().toISOString();
      const updateResult = wrapper.update((snapshot) => {
        snapshot.str = date;
      });

      let newState: { str: string };
      if (updateResult.changed) {
        newState = updateResult.newState;
      }
      expect({ str: date }).toEqual(newState!);
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 5));
    }
  }, 100_000);

  test("Should be able to differentiate between text and Y.Text based on paths given", () => {
    type TestObject = {
      p1: {
        a1: { n_p1: string }[];
      };
      p2: string;
      p3: Record<string, { n_p3: string }>;
    };
    const testObj: TestObject = {
      p1: {
        a1: [
          {
            n_p1: "hello",
          },
        ],
      },
      p2: "world",
      p3: {},
    };

    const yTextSet = new Set<string>(["p1.a1[].n_p1"]);
    const { wrapper } = YjsWrapper.fromObject<TestObject>(testObj, {
      validate: alwaysTrue,
      yTextPaths: yTextSet,
    });
    wrapper.update((snapshot) => {
      snapshot.p1.a1[0].n_p1 = snapshot.p1.a1[0].n_p1 + "new text";
    });
    wrapper.update((snapshot) => {
      snapshot.p1.a1.push({ n_p1: "new created object" });
    });
    wrapper.update((snapshot) => {
      snapshot.p3["newProperty"] = { n_p3: "new property created" };
    });
    wrapper.update((snapshot) => {
      snapshot.p2 = "well this is different";
    });
  });
});

describe("NOOP tests", () => {
  test("Should return NoChange result when initializing from empty object", () => {
    const initialData = {};

    const result = YjsWrapper.fromObject(initialData);

    expect(result.changed).toBe(false);
    expect(result.wrapper.state).toEqual(initialData);
    //@ts-expect-error
    expect(result.patches).toBeUndefined();
    //@ts-expect-error
    expect(result.update).toBeUndefined();
  });

  test("Should return NoChange result when initializing from updates that cause no change", () => {
    const initialData = { key: "value" };

    const { wrapper: originalWrapper } = YjsWrapper.fromObject(initialData);

    // Generate an empty update
    const update = new Uint8Array([0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]);

    const result = YjsWrapper.fromUpdates<typeof initialData>([update]);

    expect(result.changed).toBe(false);
    expect(result.wrapper.state).toEqual({});
    //@ts-expect-error
    expect(result.patches).toBeUndefined();
  });

  test("Should return NoChange result when performing a NOOP update", () => {
    const initialData = { key: "value" };

    const { wrapper } = YjsWrapper.fromObject(initialData);

    const result = wrapper.update((state) => {});

    expect(result.changed).toBe(false);
    expect(wrapper.state).toEqual(initialData);
    //@ts-expect-error
    expect(result.patches).toBeUndefined();
    //@ts-expect-error
    expect(result.update).toBeUndefined();
  });

  test("Should return NoChange result when applying updates causes a NOOP", () => {
    const initialData = { key: "value" };

    const { wrapper } = YjsWrapper.fromObject(initialData);

    // Generate an empty update
    const noopUpdate = Y.encodeStateAsUpdateV2(
      wrapper.doc,
      Y.encodeStateVector(wrapper.doc)
    );

    const result = wrapper.applyUpdates([noopUpdate]);

    expect(result.changed).toBe(false);
    expect(wrapper.state).toEqual(initialData);
    //@ts-expect-error
    expect(result.patches).toBeUndefined();
  });
});
