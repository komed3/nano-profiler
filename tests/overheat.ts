import { NanoProfiler } from '../src/NanoProfiler.ts';

const profiler = NanoProfiler.global();

for ( let i = 0; i < 10_000; i++ ) profiler.run( Function );

console.log( profiler.summary() );
console.log( profiler.histogram() );
