export type Env = 'node' | 'browser' | 'unknown';

export interface ProfilerOptions {
    profileMem?: boolean;
    storeResults?: boolean;
    sampleRate?: number;
}

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
    count: number;
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

export type RunnerFn< T = any > = ( fn: () => T, label?: string, meta?: any ) => T;
export type AsyncRunnerFn< T = any > = ( fn: () => Promise< T >, label?: string, meta?: any ) => Promise< T >;
export type TimerFn = () => number;

export class NanoProfiler {

    private static globalInstance?: NanoProfiler;

    public static global () : NanoProfiler {
        return NanoProfiler.globalInstance ??= new NanoProfiler ();
    }

    private readonly env: Env;

    private now: TimerFn;
    private mem: TimerFn;

    private runner!: RunnerFn;
    private runnerAsync!: AsyncRunnerFn;

    private readonly sampleRate: number;

    private active: boolean;
    private entries: ProfilerEntry[] = [];
    private tl = new Map< string, { time: number, mem: number } > ();
    private hc = new Map< string, number > ();

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

    private shouldProfiled ( label?: string ) : boolean {
        if ( ! label ) return true;

        const hc = this.hc.get( label ) ?? 0;
        this.hc.set( label, hc + 1 );

        return ( hc % this.sampleRate ) === 0;
    }

    private runProfiled< T > ( fn: () => T, label?: string, meta?: any ) : T {
        if ( ! this.shouldProfiled() ) return fn();

        const startTime = this.now();
        const startMem = this.mem();
        const res = fn();

        this.record( this.now() - startTime, this.mem() - startMem, res, label, meta );
        return res;
    }

    private async runAsyncProfiled< T > ( fn: () => Promise< T >, label?: string, meta?: any ) : Promise< T > {
        if ( ! this.shouldProfiled() ) return fn();

        const startTime = this.now();
        const startMem = this.mem();
        const res = await fn();

        this.record( this.now() - startTime, this.mem() - startMem, res, label, meta );
        return res;
    }

    private record< T > ( time: number, mem: number | undefined, res: T, label?: string, meta?: any ) : void {
        const entry: ProfilerEntry = {
            label, time, mem, meta,
            res: this.options.storeResults ? res : undefined
        };

        this.entries.push( entry );
        this.hooks?.onEntry?.( entry );
    }

    constructor (
        private readonly options: ProfilerOptions = {
            profileMem: false, storeResults: true, sampleRate: 1
        },
        private readonly hooks?: ProfilerHooks
    ) {
        this.env = this.detectEnv();
        this.now = this.setupNow();
        this.mem = this.setupMem();

        this.sampleRate = this.options.sampleRate
            ? this.options.sampleRate > 1
                ? this.options.sampleRate
                : 1 / this.options.sampleRate
            : 1;

        this.active = this.enable();
    }

    public enable () : boolean {
        this.runner = this.runProfiled;
        this.runnerAsync = this.runAsyncProfiled;

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
        const count = entries.length;

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

        const summary: ProfilerSummary = { count, time: {
            total: tTotal, max: tMax,
            min: tMin === Infinity ? 0 : tMin,
            avg: count > 0 ? tTotal / count : 0
        } };

        if ( mTotal > 0 ) summary.mem = {
            total: mTotal, max: mMax,
            min: mMin === Infinity ? 0 : mMin,
            avg: count > 0 ? mTotal / count : 0
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

    public flush () : ProfilerEntry[] {
        const data = this.entries;
        this.hooks?.onFlush?.( data );
        this.entries.length = 0;

        return data;
    }

}
