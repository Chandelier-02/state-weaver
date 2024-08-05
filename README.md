# CRDTWrapper

`CRDTWrapper` is an interface designed to bind a Conflict-free Replicated Data Type (CRDT) to a plain old JavaScript object (Pojo) representation. It provides methods to manage the lifecycle of the binding, update the Pojo state, and access the current snapshot of the state.

**Note:** 
So far, only a yjs wrapper has been created. Others for JSON-JOY, Loro, are being worked on.

## Installation

To install the package, you can use npm:

```bash
npm install @crdt-wrapper/interface
```

## Usage

### Importing

To use the CRDTWrapper interface, import it along with CRDTCompatibleValue:

```typescript
import { CRDTCompatibleValue } from "@crdt-wrapper/shared-types";
import { CRDTWrapper } from "@crdt-wrapper/interface;
```

### Interface Overview

The CRDTWrapper interface provides a way to interact with CRDTs using JavaScript objects. Here's a brief overview of its methods and properties:

`snapshot: Readonly<T>`
This property holds the current snapshot of the CRDT state, represented as a plain JavaScript object. The snapshot is a direct reflection of the CRDT's state and is kept in sync with the underlying CRDT.

`unbind(): void`
This method unbinds the Pojo from the CRDT, releasing any associated resources and stopping synchronization. After calling this method, the snapshot will no longer update with changes from the CRDT, and further updates will not be applied.

`update(changeFn: (snapshot: T) => T): void`
This method updates the CRDT state using a provided change function. The changeFn function receives the current snapshot and can modify it to reflect the desired changes. These changes are then propagated to the underlying CRDT.

`subscribe(listener: (snapshot: T) => void): void`
This method subscribes to changes in the CRDT state. The provided listener function will be called whenever the CRDT state is updated, providing the latest snapshot of the state.

`unsubscribe(listener: (snapshot: Readonly<T>) => void): void`
This method unsubscribes a previously subscribed listener from changes in the CRDT state.

### Example

Here's an example of how you might use the CRDTWrapper interface:

```typescript
const initialData: MyData = {
  title: "Initial Title",
  content: "Initial Content",
};
const myWrapper = new MyCRDTWrapper(initialData);

// Access the current state
console.log(myWrapper.snapshot);

// Update the state
myWrapper.update((snapshot) => ({
  ...snapshot,
  title: "Updated Title",
}));

const changeListener = (snapshot: Readonly<Snapshot>) =>
  console.log("Snapshot updated:", newSnapshot);

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
