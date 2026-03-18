export type Env = 'node' | 'browser' | 'unknown';

export interface ProfilerOptions {}

export interface ProfilerHooks {
    onEntry?: ( entry: ProfilerEntry ) => void
}

export interface ProfilerEntry< T = any > {
    label?: string;
    time: number;
    mem?: number;
    res?: T;
    meta?: any;
}

export type RunnerFn< T = any > = ( fn: () => T, label?: string, meta?: any ) => T;
export type AsyncRunnerFn< T = any > = ( fn: () => Promise< T >, label?: string, meta?: any ) => Promise< T >;

export class NanoProfiler {

    private static globalInstance?: NanoProfiler;

    public static global () : NanoProfiler {
        return NanoProfiler.globalInstance ??= new NanoProfiler ();
    }

    private readonly env: Env;

    private now!: () => number;
    private mem!: () => number;

    private runner!: RunnerFn;
    private runnerAsync!: AsyncRunnerFn;

    private active!: boolean;
    private entries: ProfilerEntry[] = [];

    private detectEnv () : Env {
        if ( typeof process !== 'undefined' && process.versions?.node ) return 'node';
        else if ( typeof performance !== 'undefined' ) return 'browser';
        return 'unknown';
    }

    private setupTimers () : void {
        switch ( this.env ) {
            case 'node':
                this.now = () => Number( process.hrtime.bigint() ) * 1e-6;
                this.mem = () => process.memoryUsage().heapUsed;
                break;

            case 'browser':
                this.now = () => performance.now();
                this.mem = () => ( performance as any ).memory?.usedJSHeapSize ?? 0;
                break;

            default:
                this.now = () => Date.now();
                this.mem = () => 0;
                break;
        }
    }

    private runProfiled< T > ( fn: () => T, label?: string, meta?: any ) : T {
        const startTime = this.now();
        const startMem = this.mem();
        const res = fn();

        this.record(
            this.now() - startTime,
            this.mem() - startMem,
            res, label, meta
        );

        return res;
    }

    private async runAsyncProfiled< T > ( fn: () => Promise< T >, label?: string, meta?: any ) : Promise< T > {
        const startTime = this.now();
        const startMem = this.mem();
        const res = await fn();

        this.record(
            this.now() - startTime,
            this.mem() - startMem,
            res, label, meta
        );

        return res;
    }

    private record< T > ( time: number, mem: number | undefined, res: T, label?: string, meta?: any ) : void {
        const entry: ProfilerEntry = { label, time, mem, res, meta };

        this.entries.push( entry );
        this.hooks?.onEntry?.( entry );
    }

    constructor (
        private readonly options: ProfilerOptions = {},
        private readonly hooks?: ProfilerHooks
    ) {
        this.env = this.detectEnv();
        this.setupTimers();

        this.enable();
    }

    public enable () : void {
        if ( this.active ) return;

        this.runner = this.runProfiled;
        this.runnerAsync = this.runAsyncProfiled
        this.active = true;
    }

    public disable () : void {
        if ( ! this.active ) return;

        this.runner = ( fn ) => fn();
        this.runnerAsync = ( fn ) => fn();
        this.active = false;
    }

    public run< T > ( fn: () => T, label?: string, meta?: any ) : T {
        return this.runner( fn, label, meta );
    }

    public async runAsync< T > ( fn: () => Promise< T >, label?: string, meta?: any ) : Promise< T > {
        return this.runnerAsync( fn, label, meta );
    }

}
