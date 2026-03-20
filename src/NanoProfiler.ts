/**
 * NanoProfiler is a lightweight and efficient profiling library for JavaScript and TypeScript.
 * 
 * It provides functionality to measure execution time and memory usage of code blocks,
 * with support for both synchronous and asynchronous functions.
 * 
 * The profiler is designed to work in both Node.js and browser environments, automatically
 * detecting the environment and using appropriate timing and memory measurement functions.
 * 
 * @author Paul Köhler
 * @license MIT
 */

'use strict';


/** Environment types for the NanoProfiler. */
export type Env = 'node' | 'browser' | 'unknown';

/** Configuration options for the NanoProfiler. */
export interface ProfilerOptions {
    enabled?: boolean;
    trackMem?: boolean;
    storeResults?: boolean;
    maxEntries?: number;
}

/** Hooks for custom behavior on entry recording and flushing. */
export interface ProfilerHooks {
    onEntry?: ( entry: ProfilerEntry ) => void,
    onFlush?: ( entry: ProfilerEntry[] ) => void
}

/** Profiling entry representing single measurement of time and memory usage. */
export interface ProfilerEntry< T = any > {
    label?: string;
    time: number;
    mem?: number;
    res?: T;
    meta?: any;
}

/** Summary of profiling data, including total, max, min, and avg time and memory usage. */
export interface ProfilerSummary {
    calls: number;
    time: {
        total: number;
        max: number;
        min: number;
        avg: number;
    };
    mem?: {
        total: number;
        max: number;
        min: number;
        avg: number;
    };
}

/** Histogram entry representing range of times and number of calls whin that range. */
export interface HistogramEntry {
    bin: number;
    calls: number;
}

/** Function type for running profiled code. */
export type RunnerFn< T = any > = ( fn: () => T, label?: string, meta?: any ) => T;
export type AsyncRunnerFn< T = any > = ( fn: () => Promise< T >, label?: string, meta?: any ) => Promise< T >;

/** Function type for timer functions that return the current time or memory usage. */
export type TimerFn = () => number;


/** The main NanoProfiler class that provides profiling functionality. */
export class NanoProfiler {

    /** A singleton instance of NanoProfiler for global use. */
    private static globalInstance?: NanoProfiler;

    /**
     * Returns the global instance of NanoProfiler, creating it if it doesn't already exist.
     * 
     * @returns {NanoProfiler} The global NanoProfiler instance.
     */
    public static global () : NanoProfiler {
        return NanoProfiler.globalInstance ??= new NanoProfiler ();
    }

    /** Internal state and configuration */
    private readonly options: ProfilerOptions;
    private readonly maxEntries: number;
    private readonly hooks?: ProfilerHooks;
    private readonly env: Env;

    /** Timer functions for measuring time and memory usage, set up based on the detected environment. */
    private now: TimerFn;
    private mem: TimerFn;

    /** Runner functions for executing profiled code, set up to record profiling data. */
    private runner!: RunnerFn;
    private runnerAsync!: AsyncRunnerFn;

    /** Indicates whether the profiler is currently active (enabled) or not. */
    private active: boolean;

    /** An array to store profiling entries, and an index to keep track of the current position in the array. */
    private entries: ProfilerEntry[];
    private index = 0;

    /** A map to track active labels for manual start/end profiling. */
    private tl = new Map< string, { time: number, mem: number | undefined } > ();

    /**
     * Detects the current environment (Node.js, browser, or unknown).
     * 
     * @returns {Env} The detected environment.
     */
    private detectEnv () : Env {
        if ( typeof process !== 'undefined' && process.versions?.node ) return 'node';
        else if ( typeof performance !== 'undefined' ) return 'browser';
        return 'unknown';
    }

    /**
     * Sets up the appropriate timer function based on the detected environment.
     * 
     * @returns {TimerFn} A function that returns the current time in milliseconds.
     */
    private setupNow () : TimerFn {
        switch ( this.env ) {
            case 'node': return () => { const t = process.hrtime(); return t[ 0 ] * 1e3 + t[ 1 ] * 1e-6 }
            case 'browser': return () => performance.now();
            default: return () => Date.now();
        }
    }

    /**
     * Sets up the appropriate memory usage function based on the detected environment.
     * 
     * @returns {TimerFn} A function that returns the current memory usage in bytes.
     */
    private setupMem () : TimerFn {
        switch ( this.env ) {
            case 'node': return () => process.memoryUsage().heapUsed;
            case 'browser': return () => ( performance as any ).memory?.usedJSHeapSize ?? 0;
            default: return () => 0;
        }
    }

    /**
     * Records a profiling entry with the given time, memory usage, result, label, and metadata.
     * 
     * @param {number} time - The time taken for the profiled code to execute.
     * @param {number | undefined} mem - The memory used during the execution (if tracking is enabled).
     * @param {T} res - The result of the profiled code (if storing results is enabled).
     * @param {string} [label] - An optional label for the profiling entry.
     * @param {any} [meta] - Optional metadata to associate with the profiling entry.
     */
    private record< T > ( time: number, mem: number | undefined, res: T, label?: string, meta?: any ) : void {
        if ( this.index >= this.maxEntries ) return;

        const entry = this.entries[ this.index ] ?? ( this.entries[ this.index ] = {} as ProfilerEntry );
        this.index++;

        entry.time = time;
        entry.label = label;
        entry.mem = mem;
        entry.res = this.options.storeResults ? res : undefined;
        entry.meta = meta;

        this.hooks?.onEntry?.( entry );
    }

    /**
     * Creates a new instance of NanoProfiler with the given options and hooks.
     * 
     * @param {ProfilerOptions} [options] - Configuration options for the profiler.
     * @param {ProfilerHooks} [hooks] - Hooks for custom behavior on entry recording and flushing.
     */
    constructor (
        options: ProfilerOptions = {
            enabled: true,
            trackMem: false,
            storeResults: false,
            maxEntries: 10_000
        },
        hooks?: ProfilerHooks
    ) {
        this.options = options;
        this.maxEntries = options.maxEntries ?? 10_000;
        this.hooks = hooks;

        // Detect the environment and set up the appropriate timer and memory functions
        this.env = this.detectEnv();
        this.now = this.setupNow();
        this.mem = this.setupMem();

        // Initialize the entries array
        this.entries = new Array ( this.maxEntries );

        // Enable the profiler if the 'enabled' option is set to true
        this.active = options.enabled ? this.enable() : this.disable();
    }

    /**
     * Enables the profiler.
     * 
     * Sets up the runner functions to record profiling data when executing code,
     * and returns true to indicate that the profiler is now active.
     * 
     * @returns {boolean} True if the profiler was successfully enabled, false otherwise.
     */
    public enable () : boolean {
        if ( this.active ) return true;

        const trackMem = this.options.trackMem;
        const self = this, now = this.now, mem = this.mem;

        // Set up the runner functions
        this.runner = ( fn, label, meta ) => {
            const t0 = now(), m0 = trackMem ? mem() : undefined;
            let res;

            try { return res = fn() } finally { self.record(
                now() - t0, trackMem ? mem() - m0! : undefined,
                res, label, meta
            ) }
        };

        // Set up the asynchronous runner function
        this.runnerAsync = async ( fn, label, meta ) => {
            const t0 = now(), m0 = trackMem ? mem() : undefined;
            let res;

            try { return res = await fn() } finally { self.record(
                now() - t0, trackMem ? mem() - m0! : undefined,
                res, label, meta
            ) }
        };

        return this.active = true;
    }

    /**
     * Disables the profiler.
     * 
     * @returns {boolean} False, indicating that the profiler is now disabled.
     */
    public disable () : boolean {
        this.runner = ( fn ) => fn();
        this.runnerAsync = ( fn ) => fn();

        return this.active = false;
    }

    /**
     * Returns the detected environment in which the profiler is running.
     * 
     * @returns {Env} The detected environment ('node', 'browser', or 'unknown').
     */
    public getenv () : Env {
        return this.env;
    }

    /**
     * Checks if the profiler is currently active (enabled).
     * 
     * @returns {boolean} True if the profiler is active, false otherwise.
     */
    public isActive () : boolean {
        return this.active;
    }

    /**
     * Runs the provided function while recording profiling data, using the configured runner function.
     * 
     * @param {() => T} fn - The function to execute and profile.
     * @param {string} [label] - An optional label to associate with the profiling entry for this function execution.
     * @param {any} [meta] - Optional metadata to associate with the profiling entry for this function execution.
     * @returns {T} The result of the executed function.
     */
    public run< T > ( fn: () => T, label?: string, meta?: any ) : T {
        return this.runner( fn, label, meta );
    }

    /**
     * Runs the provided asynchronous function while recording profiling data,
     * using the configured asynchronous runner function.
     * 
     * @param {() => Promise<T>} fn - The asynchronous function to execute and profile.
     * @param {string} [label] - An optional label to associate with the profiling entry for this function execution.
     * @param {any} [meta] - Optional metadata to associate with the profiling entry for this function execution.
     * @returns {Promise<T>} A promise that resolves to the result of the executed asynchronous function.
     */
    public async runAsync< T > ( fn: () => Promise< T >, label?: string, meta?: any ) : Promise< T > {
        return this.runnerAsync( fn, label, meta );
    }

    /**
     * Starts a manual profiling session with the given label.
     * 
     * @param {string} label - The label to associate with this profiling session.
     * @throws {Error} If the provided label is already active.
     */
    public start ( label: string ) : void {
        if ( this.tl.has( label ) ) throw new Error( `Label "${ label }" is already active` );
        this.tl.set( label, { time: this.now(), mem: this.options.trackMem ? this.mem() : undefined } );
    }

    /**
     * Ends a manual profiling session with the given label and records the profiling data.
     * 
     * @param {string} label - The label associated with the profiling session to end.
     * @throws {Error} If the provided label is not currently active.
     */
    public end ( label: string ) : void {
        const start = this.tl.get( label );
        if ( ! start ) throw new Error( `Label "${ label }" is not active` );

        this.tl.delete( label );
        this.record(
            this.now() - start.time,
            this.options.trackMem ? this.mem() - start.mem! : undefined,
            undefined, label
        );
    }

    /**
     * Retrieves profiling entries, optionally filtered by a specific label.
     * 
     * @param {string} [label] - An optional label to filter the profiling entries.
     * @returns {ProfilerEntry[]} An array of profiling entries that match the specified label.
     */
    public report ( label?: string ) : ProfilerEntry[] {
        const { entries, index } = this;
        if ( ! label ) return entries.slice( 0, index );

        const result: ProfilerEntry[] = [];
        for ( let i = 0; i < index; i++ ) {
            const e = entries[ i ];
            if ( e.label === label ) result.push( e );
        }

        return result;
    }

    /**
     * Generates a summary of profiling data, optionally filtered by a specific label.
     * 
     * Calculates total, maximum, minimum, and average time (and memory usage if tracking
     * is enabled) for the profiling entries that match the specified label.
     * 
     * @param {string} [label] - An optional label to filter the profiling entries for the summary.
     * @returns {ProfilerSummary} A summary object containing aggregated profiling data.
     */
    public summary ( label?: string ) : ProfilerSummary {
        const entries = this.report( label );
        const calls = entries.length;

        let tTotal = 0, tMax = 0, tMin = Infinity,
            mTotal = 0, mMax = 0, mMin = Infinity;

        for ( const e of entries ) {
            const { time, mem } = e;

            tTotal += time;
            if ( time > tMax ) tMax = time;
            if ( time < tMin ) tMin = time;

            if ( mem ) {
                mTotal += mem;
                if ( mem > mMax ) mMax = mem;
                if ( mem < mMin ) mMin = mem;
            }
        }

        const summary: ProfilerSummary = { calls, time: {
            total: tTotal, max: tMax,
            min: tMin === Infinity ? 0 : tMin,
            avg: calls > 0 ? tTotal / calls : 0
        } };

        if ( mTotal > 0 ) summary.mem = {
            total: mTotal, max: mMax,
            min: mMin === Infinity ? 0 : mMin,
            avg: calls > 0 ? mTotal / calls : 0
        };

        return summary;
    }

    /**
     * Identifies the profiling entry with the longest execution time, optionally filtered by a specific label.
     * 
     * @param {string} [label] - An optional label to filter the profiling entries for hotspot analysis.
     * @returns {ProfilerEntry | undefined} The profiling entry with the longest execution time.
     */
    public hotspot ( label?: string ) : ProfilerEntry | undefined {
        const entries = this.report( label );
        if ( entries.length === 0 ) return undefined;

        let max: ProfilerEntry | undefined;
        for ( const e of entries ) if ( ! max || e.time > max.time ) max = e;

        return max;
    }

    /**
     * Generates a histogram of execution times for profiling entries, optionally filtered by a specific label.
     * 
     * Calculates the minimum and maximum execution times, divides the range into specified bins, and counts
     * the number of entries that fall into each bin to create a histogram representation of the execution times.
     * 
     * @param {string} [label] - An optional label to filter the profiling entries for histogram generation.
     * @param {number} [bins=10] - The number of bins to use for the histogram.
     * @returns {HistogramEntry[]} An array of histogram entries representing the distribution of execution times.
     */
    public histogram ( label?: string, bins: number = 10 ) : HistogramEntry[] {
        const entries = this.report( label );
        if ( entries.length === 0 ) return [];

        let min = Infinity;
        let max = -Infinity;

        for ( const e of entries ) {
            const t = e.time;
            if ( t < min ) min = t;
            if ( t > max ) max = t;
        }

        if ( min === Infinity ) return [];
        if ( max === min ) return [ { bin: min, calls: entries.length } ];

        const binSize = ( max - min ) / bins;
        const histogram: HistogramEntry[] = new Array( bins );
        for ( let i = 0; i < bins; i++ ) histogram[ i ] = { bin: min + i * binSize, calls: 0 };

        for ( const e of entries ) {
            const t = e.time;
            let i = ( ( t - min ) / binSize ) | 0;
            if ( i >= bins ) i = bins - 1;
            histogram[ i ].calls++;
        }

        return histogram;
    }

    /**
     * Flushes the recorded profiling entries, returning them and resetting the internal state.
     * 
     * @returns {ProfilerEntry[]} An array of profiling entries that were flushed.
     */
    public flush () : ProfilerEntry[] {
        const data = this.entries.slice( 0, this.index );
        this.hooks?.onFlush?.( data );
        this.index = 0;

        return data;
    }

}
