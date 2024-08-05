# YjsWrapper

`YjsWrapper` is a class that wraps a Yjs shared type and provides an interface to interact with it using plain JavaScript objects. It supports synchronization, updates, and observing changes within the CRDT framework.

**Note:**
The current implementation does not support top level text edits. You cannot pass an empty string as the initial object.
However, it does support nested text edits if the string is within an object or array.

## Installation

To install the package, you can use npm:

```bash
npm install @crdt-wrapper/yjs
```

## Usage

### Importing

To use the YjsWrapper class, import it along with the required types:

```typescript
import { YjsWrapper } from "@crdt-wrapper/yjs";
import {
  CRDTCompatibleArray,
  CRDTCompatiblePojo,
} from "@crdt-wrapper/shared-types";
```

### Class Overview

The YjsWrapper class provides a way to interact with Yjs shared types using JavaScript objects. Here's a brief overview of its methods and properties:

`snapshot: Readonly<Snapshot>`
This property holds the current snapshot of the CRDT state, represented as a plain JavaScript object. The snapshot is kept in sync with the underlying Yjs shared type.

`unbind(): void`
This method unbinds the Pojo from the Yjs shared type, releasing any associated resources and stopping synchronization. After calling this method, the snapshot will no longer update with changes from the CRDT, and further updates will not be applied.

`update(changeFn: (snapshot: Snapshot) => void): void`
This method updates the CRDT state using a provided change function. The change function receives the current snapshot and can modify it to reflect the desired changes. These changes are then propagated to the underlying Yjs shared type.

`subscribe(listener: (snapshot: Readonly<Snapshot>) => void): void`
This method subscribes to changes in the CRDT state. The provided listener function will be called whenever the CRDT state is updated, providing the latest snapshot of the state.

`unsubscribe(listener: (snapshot: Readonly<Snapshot>) => void): void`
This method unsubscribes a previously subscribed listener from changes in the CRDT state.

### Example

Here's an example of how you might use the YjsWrapper class:

```typescript
const initialData: MyData = {
  title: "Initial Title",
  content: "Initial Content",
};
const yMap = new Y.Map();
const myWrapper = YjsWrapper.wrap(initialData, yMap);

// Access the current state
console.log(myWrapper.snapshot);

// Update the state
myWrapper.update((snapshot) => {
  snapshot.title = "Updated Title";
});

const changeListener = (snapshot: Readonly<Snapshot>) =>
  console.log("Snapshot updated:", snapshot);

// Subscribe to state changes
myWrapper.subscribe(changeListener);

// Unsubscribe from state changes
myWrapper.unsubscribe(changeListener);

// Unbind when done
myWrapper.unbind();
```

## Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue or submit a pull request on [GitHub](https://github.com/Chandelier-02/crdt-wrapper).

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/Chandelier-02/crdt-wrapper/blob/main/LICENSE.md) file for details.
