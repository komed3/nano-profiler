export type Env = 'node' | 'browser' | 'unknown';

export interface ProfilerHooks {
    onEntry?: ( entry: ProfilerEntry ) => void,
    onFlush?: ( entry: ProfilerEntry[] ) => void
}

export interface ProfilerEntry< T = any > {
    label?: string;
    time: number;
    mem?: number;
    res?: T;
    meta?: any;
}

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

export interface HistogramEntry {
    bin: number;
    count: number;
}

export type RunnerFn< T = any > = ( fn: () => T, label?: string, meta?: any ) => T;
export type AsyncRunnerFn< T = any > = ( fn: () => Promise< T >, label?: string, meta?: any ) => Promise< T >;
export type TimerFn = () => number;

export class NanoProfiler {

    private static globalInstance?: NanoProfiler;

    public static global () : NanoProfiler {
        return NanoProfiler.globalInstance ??= new NanoProfiler ();
    }

    private readonly hooks?: ProfilerHooks;
    private readonly env: Env;

    private now: TimerFn;
    private mem: TimerFn;

    private runner!: RunnerFn;
    private runnerAsync!: AsyncRunnerFn;

    private active: boolean;
    private entries: ProfilerEntry[] = [];
    private tl = new Map< string, { time: number, mem: number } > ();

    private detectEnv () : Env {
        if ( typeof process !== 'undefined' && process.versions?.node ) return 'node';
        else if ( typeof performance !== 'undefined' ) return 'browser';
        return 'unknown';
    }

    private setupNow () : TimerFn {
        switch ( this.env ) {
            case 'node': return () => Number( process.hrtime.bigint() ) * 1e-6;
            case 'browser': return () => performance.now();
            default: return () => Date.now();
        }
    }

    private setupMem () : TimerFn {
        switch ( this.env ) {
            case 'node': return () => process.memoryUsage().heapUsed;
            case 'browser': return () => ( performance as any ).memory?.usedJSHeapSize ?? 0;
            default: return () => 0;
        }
    }

    private runProfiled< T > ( fn: () => T, label?: string, meta?: any ) : T {
        const startTime = this.now();
        const startMem = this.mem();
        const res = fn();

        this.record( this.now() - startTime, this.mem() - startMem, res, label, meta );
        return res;
    }

    private async runAsyncProfiled< T > ( fn: () => Promise< T >, label?: string, meta?: any ) : Promise< T > {
        const startTime = this.now();
        const startMem = this.mem();
        const res = await fn();

        this.record( this.now() - startTime, this.mem() - startMem, res, label, meta );
        return res;
    }

    private record< T > ( time: number, mem: number, res: T, label?: string, meta?: any ) : void {
        const entry: ProfilerEntry = { label, time, mem, res, meta };

        this.entries.push( entry );
        this.hooks?.onEntry?.( entry );
    }

    constructor ( hooks?: ProfilerHooks ) {
        this.hooks = hooks;

        this.env = this.detectEnv();
        this.now = this.setupNow();
        this.mem = this.setupMem();

        this.active = this.enable();
    }

    public enable () : boolean {
        this.runner = this.runProfiled.bind( this );
        this.runnerAsync = this.runAsyncProfiled.bind( this );

        return this.active = true;
    }

    public disable () : boolean {
        this.runner = ( fn ) => fn();
        this.runnerAsync = ( fn ) => fn();

        return this.active = false;
    }

    public getenv () : Env {
        return this.env;
    }

    public isActive () : boolean {
        return this.active;
    }

    public run< T > ( fn: () => T, label?: string, meta?: any ) : T {
        return this.runner( fn, label, meta );
    }

    public async runAsync< T > ( fn: () => Promise< T >, label?: string, meta?: any ) : Promise< T > {
        return this.runnerAsync( fn, label, meta );
    }

    public start ( label: string ) : void {
        if ( this.tl.has( label ) ) throw new Error( `Label "${ label }" is already active` );
        this.tl.set( label, { time: this.now(), mem: this.mem() } );
    }

    public end ( label: string ) : void {
        const start = this.tl.get( label );
        if ( ! start ) throw new Error( `Label "${ label }" is not active` );
        this.tl.delete( label );

        this.record( this.now() - start.time, this.mem() - start.mem, undefined, label );
    }

    public report ( label?: string ) : ProfilerEntry[] {
        return label ? this.entries.filter( e => e.label === label ) : [ ...this.entries ];
    }

    public summary ( label?: string ) : ProfilerSummary {
        const entries = this.report( label );
        const calls = entries.length;

        let tTotal = 0, tMax = 0, tMin = Infinity,
            mTotal = 0, mMax = 0, mMin = Infinity;

        for ( const e of entries ) {
            tTotal += e.time;
            tMax = Math.max( tMax, e.time );
            tMin = Math.min( tMin, e.time );

            mTotal += e.mem ?? 0;
            mMax = Math.max( mMax, e.mem ?? 0 );
            mMin = Math.min( mMin, e.mem ?? Infinity );
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

    public hotspot ( label?: string ) : ProfilerEntry | undefined {
        const entries = this.report( label );
        if ( entries.length === 0 ) return undefined;

        return entries.reduce(
            ( max, entry ) => entry.time > max.time ? entry : max,
            entries[ 0 ]
        );
    }

    public histogram ( label?: string, bins: number = 10 ) : HistogramEntry[] {
        const entries = this.report( label );
        if ( entries.length === 0 ) return [];

        const times = entries.map( e => e.time );
        const min = Math.min( ...times );
        const max = Math.max( ...times );
        const binSize = ( max - min ) / bins;

        const histogram = Array.from( { length: bins }, ( _, i ) => ( { bin: min + i * binSize, count: 0 } ) );

        for ( const time of times ) {
            const binIndex = Math.min( Math.floor( ( time - min ) / binSize ), bins - 1 );
            histogram[ binIndex ].count++;
        }

        return histogram;
    }

    public flush () : ProfilerEntry[] {
        const data = this.entries;
        this.hooks?.onFlush?.( data );
        this.entries.length = 0;

        return data;
    }

}
