export type Env = 'node' | 'browser' | 'unknown';

export interface ProfilerOptions {}

export interface ProfilerHooks {}

export type RunnerFn< T > = ( fn: () => T, label?: string, meta?: any ) => T;
export type AsyncRunnerFn< T > = ( fn: () => Promise< T >, label?: string, meta?: any ) => Promise< T >;

export class NanoProfiler {

    private static globalInstance?: NanoProfiler;

    public static global () : NanoProfiler {
        return NanoProfiler.globalInstance ??= new NanoProfiler ();
    }

    private env!: Env;

    private now!: () => number;
    private mem!: () => number;

    private runner!: RunnerFn< any >;
    private runnerAsync!: AsyncRunnerFn< any >;

    private active!: boolean;

    private detectEnv () : void {
        if ( typeof process !== 'undefined' && process.versions?.node ) this.env = 'node';
        else if ( typeof performance !== 'undefined' ) this.env = 'browser';
        else this.env = 'unknown';
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

        const deltaTime = this.now() - startTime;
        const deltaMem = this.mem() - startMem;

        return res;
    }

    private async runAsyncProfiled< T > ( fn: () => Promise< T >, label?: string, meta?: any ) : Promise< T > {
        const startTime = this.now();
        const startMem = this.mem();

        const res = await fn();

        const deltaTime = this.now() - startTime;
        const deltaMem = this.mem() - startMem;

        return res;
    }

    constructor (
        private readonly options: ProfilerOptions = {},
        private readonly hooks?: ProfilerHooks
    ) {
        this.detectEnv();
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
