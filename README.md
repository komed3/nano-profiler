# NanoProfiler

NanoProfiler is a small, dependency-free profiler implemented in TypeScript.
It provides a single `NanoProfiler` class with utilities to measure execution time (and optionally memory) for synchronous and asynchronous code blocks.
The library works in Node.js and browser environments.

## Installation

Install from npm:

```
npm install nano-profiler
```

## Quick usage

Import the class and create an instance (or use the singleton):

```ts
import { NanoProfiler } from 'nano-profiler';

const profiler = new NanoProfiler( { trackMem: true } );

// profile a synchronous function
profiler.run( () => {
	// work
}, 'syncTask' );

// profile an async function
await profiler.runAsync( async () => {
	await doSomething();
}, 'asyncTask' );

// manual start/end
profiler.start( 'manual' );
// work
profiler.end( 'manual' );

// get results
const entries = profiler.report();
const summary = profiler.summary();
```

## API reference

## Options

- `enabled` (boolean, default: `true`)  
  Whether the profiler is enabled by default.
- `trackMem` (boolean, default: `false`)  
  Whether to track memory usage in addition to execution time. Enabling this may have a performance impact.
- `storeResults` (boolean, default: `false`)  
  If set to `true`, the profiler stores results of profiled blocks/functions.
- `sampleRate` (number, default: `1`)  
  A value between `0` and `1` that determines the percentage of blocks/functions getting profiled. Useful for reducing overhead in high-frequency code.
- `maxEntries` (number, default: `10000`)  
  Maximum number of profiled time/memory entries. If the limit is reached, no more entries will be recorded until `flush()`.

### Hooks

- `onEntry ( entry: ProfileEntry ) : void`  
  A callback function that gets called whenever a new profile entry is recorded. Useful for real-time monitoring or custom logging.
- `onFlush ( entries: ProfileEntry[] ) : void`  
  A callback function that gets called when the profiler is flushed. Receives all stored entries as an argument.

----

Copyright (c) 2026 Paul Köhler (komed3). All rights reserved.  
Released under the MIT license. See LICENSE file in the project root for details.
