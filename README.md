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

## API highlights

- `new NanoProfiler( options?, hooks? )` — construct a profiler instance
- `NanoProfiler.global()` — obtain a shared singleton instance
- `run( fn, label?, meta? )` — run and profile sync code
- `runAsync( fn, label?, meta? )` — run and profile async code
- `start( label )` / `end( label )` — manual timing
- `report( label? )` — get raw profiling entries
- `summary( label? )` — get aggregated summary data
- `histogram( label?, bins? )` — get histogram data
- `percentiles( label?, ps? )` — get percentile data
- `hotspot( label? )` — get the slowest entry for a label
- `flush()` — clear all recorded data

## Build outputs

- CommonJS bundle: `dist/nano-profiler.cjs`
- ESM bundle: `dist/nano-profiler.mjs`
- Type declarations: `dist/nano-profiler.d.ts`

----

Copyright (c) 2026 Paul Köhler (komed3). All rights reserved.  
Released under the MIT license. See LICENSE file in the project root for details.
