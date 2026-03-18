export type Env = 'node' | 'browser' | 'unknown';

export interface ProfilerOptions {}

export interface ProfilerHooks {}

export type RunnerFn< T > = ( fn: () => T, label?: string, meta?: any ) => T;
export type AsyncRunnerFn< T > = ( fn: () => Promise< T >, label?: string, meta?: any ) => Promise< T >;

export class NanoProfiler {

    private static env: Env;

    private static now: () => number;
    private static mem: () => number;

    private static globalInstance?: NanoProfiler;

    private static detectEnv () : void {
        if ( typeof process !== 'undefined' && process.versions?.node ) this.env = 'node';
        else if ( typeof performance !== 'undefined' ) this.env = 'browser';
        else this.env = 'unknown';

        NanoProfiler.setupTimers();
    }

    private static setupTimers(): void {

        switch (this.env) {

            case 'node':

                this.now = () => Number(process.hrtime.bigint()) * 1e-6

                this.mem = () => process.memoryUsage().heapUsed

                break

            case 'browser':

                this.now = () => performance.now()

                this.mem = () =>
                    (performance as any).memory?.usedJSHeapSize ?? 0

                break

            default:

                this.now = () => Date.now()

                this.mem = () => 0

        }

    }

    public static global () : NanoProfiler {
        return this.globalInstance ??= new NanoProfiler ();
    }

    private runner: RunnerFn< any >;
    private runnerAsync: AsyncRunnerFn< any >;

    private active!: boolean;

    constructor (
        private readonly options: ProfilerOptions = {},
        private readonly hooks?: ProfilerHooks
    ) {
        if ( ! NanoProfiler.env ) NanoProfiler.detectEnv();
        this.enable();
    }

    public enable () : void {
        if ( this.active ) return;
    }

    public disable () : void {
        if ( ! this.active ) return;
    }

    public run< T > ( fn: () => T, label?: string, meta?: any ) : T {
        return this.runner( fn, label, meta );
    }

    public async runAsync< T > ( fn: () => Promise< T >, label?: string, meta?: any ) : Promise< T > {
        return this.runnerAsync( fn, label, meta );
    }

}
