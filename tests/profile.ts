import { NanoProfiler } from '../src/NanoProfiler.ts';

const profiler = new NanoProfiler ( {
    onEntry ( entry ) { console.log( `Entry: ${ entry.label }, Time: ${ entry.time }ms, Mem: ${ entry.mem }MB` ) }
} );

const workload_1 = () => { for ( let i = 0; i < 1e3; i++ ) Math.sqrt( i ) };
const workload_2 = () => { for ( let i = 0; i < 1e3; i++ ) Math.log( i + 1 ) };
const workload_3 = () => { for ( let i = 0; i < 1e3; i++ ) Math.sin( i ) };

for ( let i = 0; i < 10; i++ ) {
    profiler.run( workload_1, 'sqrt' );
    profiler.run( workload_2, 'log' );
    profiler.run( workload_3, 'sin' );
    profiler.run( workload_1, 'sqrt' );
    profiler.run( workload_2, 'log' );
    profiler.run( workload_3, 'sin' );
    profiler.run( workload_3, 'sin' );
    profiler.run( workload_1, 'sqrt' );
    profiler.run( workload_3, 'sin' );
    profiler.run( workload_2, 'log' );
    profiler.run( workload_1, 'sqrt' );
    profiler.run( workload_2, 'log' );
}

console.log( 'Summary for sqrt:', profiler.summary( 'sqrt' ) );
console.log( 'Hotspot for log:', profiler.hotspot( 'log' ) );
console.log( 'Histogram:', profiler.histogram( undefined, 5 ) );
