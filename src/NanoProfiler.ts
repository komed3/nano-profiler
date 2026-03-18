type Env = 'node' | 'browser' | 'unknown';

export interface ProfilerOptions {}

export interface ProfilerHooks {}

export type RunnerFn< T > = ( fn: () => T, label?: string, meta?: any ) => T;
export type AsyncRunnerFn< T > = ( fn: () => Promise< T >, label?: string, meta?: any ) => Promise< T >;

export class NanoProfiler {

    private static env: Env;

    private static now: () => number;
    private static mem: () => number;

    private static globalInstance?: NanoProfiler;

    public static global () : NanoProfiler {
        return this.globalInstance ??= new NanoProfiler ();
    }

    private runner: RunnerFn< any >;
    private runnerAsync: AsyncRunnerFn< any >;

    private active: boolean = true;

    constructor (
        private readonly options: ProfilerOptions = {},
        private readonly hooks?: ProfilerHooks
    ) {}

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
