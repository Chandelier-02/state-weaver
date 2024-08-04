import { CRDTWrapper } from "@crdt-wrapper/binder-interface";
import {
  CRDTCompatibleArray,
  CRDTCompatiblePojo,
} from "@crdt-wrapper/shared-types";
import { isJSONArray, isJSONObject, isString } from "@crdt-wrapper/util";
import * as Y from "yjs";
import { Patch, create } from "mutative";
import createStringPatch, { Change } from "textdiff-create";
import { assertSupportedEvent, toPojo, toYDataType } from "./util";
import { SupportedSource } from "./types";

export class YjsWrapper<
  Snapshot extends CRDTCompatibleArray | CRDTCompatiblePojo
> implements CRDTWrapper<Snapshot>
{
  readonly #source: SupportedSource;
  readonly #doc: Y.Doc;
  #snapshot: Snapshot;
  #observeDeepFunc = (events: Y.YEvent<any>[]) => {
    this.#snapshot = this.#applyYEvents(events);
  };

  constructor(initialObject: Snapshot, sourceName: string, doc: Y.Doc) {
    this.#doc = doc;
    if (typeof initialObject === "object" && !Array.isArray(initialObject)) {
      this.#source = doc.getMap(sourceName);
    } else {
      this.#source = doc.getArray(sourceName);
    }
    this.#source.observeDeep(this.#observeDeepFunc);
    this.update(() => initialObject);
    this.#snapshot = this.#source.toJSON() as Snapshot;
  }

  get snapshot(): Snapshot {
    return this.#snapshot;
  }

  public unbind(): void {
    this.#source.unobserveDeep(this.#observeDeepFunc);
  }

  public update(changeFn: (snapshot: Snapshot) => void): Uint8Array {
    return this.#doc.transact((): Uint8Array => {
      return this.#applyLocalUpdate(this.#source, this.#snapshot, changeFn);
    });
  }

  public applyUpdate(update: Uint8Array): void {
    this.#doc.transact(() => {
      Y.applyUpdate(this.#doc, update);
    });
  }

  #applyYEvents(events: Y.YEvent<any>[]): Snapshot {
    return create(this.#snapshot, (target) => {
      for (const event of events) {
        assertSupportedEvent(event);
        let base: any = target;
        for (const step of event.path) {
          if (
            typeof step === "string" &&
            typeof base === "object" &&
            base !== null &&
            this.#source
          ) {
            base = base[step];
          } else if (typeof step === "number" && Array.isArray(base)) {
            base = base[step];
          } else {
            throw new Error(`Invalid path: ${event.path}`);
          }
        }
        this.#applyYEvent(base, event);
      }
    });
  }

  #applyYEvent(base: Snapshot, event: Y.YEvent<any>): Snapshot | string {
    if (event instanceof Y.YMapEvent && isJSONObject(base)) {
      const source = event.target as Y.Map<any>;

      event.changes.keys.forEach((change, key) => {
        switch (change.action) {
          case "add":
          case "update":
            base[key] = toPojo(source.get(key));
            break;
          case "delete":
            delete base[key];
            break;
        }
      });
    } else if (event instanceof Y.YArrayEvent && isJSONArray(base)) {
      const arr = base as any[];

      let retain = 0;
      event.changes.delta.forEach((change) => {
        if (change.retain) {
          retain += change.retain;
        }
        if (change.delete) {
          arr.splice(retain, change.delete);
        }
        if (change.insert) {
          if (Array.isArray(change.insert)) {
            arr.splice(retain, 0, ...change.insert.map(toPojo));
          } else {
            arr.splice(retain, 0, toPojo(change.insert));
          }
          retain += change.insert.length;
        }
      });
    } else if (event instanceof Y.YTextEvent && isString(base)) {
      return this.#applyYTextEvent(base, event);
    }

    return base as Snapshot;
  }

  #applyYTextEvent(base: string, event: Y.YTextEvent): string {
    let text = base;

    let retain = 0;
    event.changes.delta.forEach((change) => {
      if (change.retain) {
        retain += change.retain;
      }
      if (change.delete) {
        const deleteLength = change.delete;
        text = text.slice(0, retain) + text.slice(retain + deleteLength);
      }
      if (change.insert) {
        const insertText = Array.isArray(change.insert)
          ? change.insert.join("")
          : change.insert;
        text = text.slice(0, retain) + insertText + text.slice(retain);
        retain += insertText.length;
      }
    });
    return text;
  }

  #applyLocalUpdate(
    source: SupportedSource,
    snapshot: Snapshot,
    changeFn: (snapshot: Snapshot) => void
  ): Uint8Array {
    const [, patches] = create(snapshot, changeFn, { enablePatches: true });
    const updates: Uint8Array[] = [];
    for (const patch of patches) {
      updates.push(this.#applyPatch(source, patch));
    }
    return Y.mergeUpdates(updates);
  }

  #applyPatch(target: SupportedSource, patch: Patch): Uint8Array {
    const oldStateVector = Y.encodeStateVector(this.#doc);
    const { path, op, value } = patch;
    if (!Array.isArray(path)) {
      if (op !== "replace") {
        throw new Error("Cannot add or remove top level properties of object.");
      }
      if (target instanceof Y.Map && isJSONObject(value)) {
        target.clear();
        for (const k in value) {
          target.set(k, toPojo(value[k]));
        }
      } else if (target instanceof Y.Array && isJSONArray(value)) {
        target.delete(0, target.length);
        target.push(value.map(toYDataType));
      } else if (target instanceof Y.Text && isString(value)) {
        const string = (target as Y.Text).toJSON();
        const patches = createStringPatch(string, value);
        this.#applyStringPatches(target, patches);
      }
    }
    const newStateVector = Y.encodeStateVector(this.#doc);
    return Y.encodeStateAsUpdate(this.#doc, newStateVector);
  }

  #applyStringPatches(target: Y.Text, patches: Change[]): void {
    let cursor = 0;
    for (const change of patches) {
      if (change[0] === -1) {
        target.delete(cursor, change[1]);
      } else if (change[0] === 0) {
        cursor += change[1];
      } else if (change[0] === 1) {
        target.insert(cursor, change[1]);
        cursor += change[1].length;
      }
    }
  }
}
