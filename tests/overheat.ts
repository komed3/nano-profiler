import { NanoProfiler } from '../src/NanoProfiler.ts';

const profiler = NanoProfiler.global();

for ( let i = 0; i < 1e6; i++ ) profiler.run( Function );

console.log( profiler.summary() );
console.log( profiler.histogram() );
