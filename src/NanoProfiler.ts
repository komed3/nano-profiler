export type RunnerFn< T > = ( fn: () => T, label?: string, meta?: any ) => T;
export type AsyncRunnerFn< T > = ( fn: () => Promise< T >, label?: string, meta?: any ) => Promise< T >;

export class NanoProfiler {

    private runner: RunnerFn< any >;
    private runnerAsync: AsyncRunnerFn< any >;

}
