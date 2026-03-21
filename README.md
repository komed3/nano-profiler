# NanoProfiler

NanoProfiler is a small, dependency-free profiler implemented in TypeScript.
It provides a single `NanoProfiler` class with utilities to measure execution time (and optionally memory) for synchronous and asynchronous code blocks.
The library works in Node.js and browser environments.

The profiler is designed to produce as little overhead as possible, making it suitable for profiling high-frequency code paths.
It supports manual start/end profiling as well as automatic profiling of functions and code blocks.

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
const session = profiler.start( 'manual' );
// work
profiler.end( session );

// get results
const entries = profiler.report();
const summary = profiler.summary();
```

## API reference

### Instantiate

- `NanoProfiler.global()`  
  Returns the global singleton instance of `NanoProfiler`. This is useful for simple use cases where you don't need multiple profilers.
- `new NanoProfiler( options?, hooks? )`  
  Creates a new instance of `NanoProfiler` with optional configuration options and hooks.

### Control

- `enable() : boolean`  
  Enables the profiler. Returns `true` to indicate that profiling is now active.
- `disable() : boolean`  
  Disables the profiler. Returns `false` to indicate that profiling is now inactive.
- `flush () : ProfilerEntry[]`  
  Clears all stored profiling entries and returns them as an array. This is useful for resetting the profiler state or retrieving results before starting a new profiling session.
- `genEnv() : 'node' | 'browser' | 'unknown'`  
  Returns the detected runtime environment. This can be used for environment-specific profiling logic or optimizations.
- `isActive() : boolean`  
  Returns `true` if the profiler is currently enabled and active, or `false` if it is disabled.
- `getEntryCount() : number`  
  Returns the total number of profiling entries that have been recorded since the last flush.

### Profiling

- `run< T >( fn: () => T, label?: string, meta?: any ) : T`  
  Profiles the execution of a synchronous function `fn`. Optionally accepts a `label` for categorization and `meta` for additional data. Returns the result of the function.
- `async runAsync< T >( fn: () => Promise< T >, label?: string, meta?: any ) : Promise< T >`  
  Profiles the execution of an asynchronous function `fn`. Optionally accepts a `label` for categorization and `meta` for additional data. Returns a promise that resolves to the result of the function.
- `start( label?: string ) : string`  
  Starts profiling for a code block with an optional `label` and returns a unique identifier for the profiling session. This can be used for manual profiling of code blocks that don't fit well with the `run` or `runAsync` methods.
- `end( session: string ) : void`  
  Ends the profiling session identified by the `session` string returned from `start()`. This will record the profiling data for that session. If the provided session identifier does not correspond to an active profiling session, an error will be thrown.

### Reports

- `report( label?: string ) : ProfilerEntry[]`  
  Returns an array of profiling entries. If a `label` is provided, only entries with that label will be returned.
- `summary( label?: string ) : ProfilerSummary`  
  Returns a summary of profiling results, including total time, average time, count, and optionally memory usage. If a `label` is provided, the summary will be for entries with that label.
- `hotspot( label?: string ) : ProfilerEntry | undefined`  
  Returns the single profiling entry with the longest execution time. If a `label` is provided, only entries with that label will be considered.
- `histogram( label?: string, bins: number = 10 ) : HistogramEntry[]`  
  Returns a histogram of execution times for the profiled entries. The `bins` parameter determines how many bins the histogram will have. If a `label` is provided, only entries with that label will be included in the histogram.
- `percentiles( label?: string, ps: number[] = [ 50, 90, 95, 99 ] ) : PercentileEntry[]`  
  Returns the specified percentiles of execution times for the profiled entries. The `ps` parameter is an array of percentiles to calculate (e.g., 50 for median, 90 for 90th percentile). If a `label` is provided, only entries with that label will be included in the percentile calculations.

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

- `onEntry( entry: ProfileEntry ) : void`  
  A callback function that gets called whenever a new profile entry is recorded. Useful for real-time monitoring or custom logging.
- `onFlush( entries: ProfileEntry[] ) : void`  
  A callback function that gets called when the profiler is flushed. Receives all stored entries as an argument.

----

Copyright (c) 2026 Paul Köhler (komed3). All rights reserved.  
Released under the MIT license. See LICENSE file in the project root for details.
