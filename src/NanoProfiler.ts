export class NanoProfiler {

    private runner: < T > ( fn: () => T, label?: string, meta?: any ) => T;
    private runnerAsync: < T > ( fn: () => Promise< T >, label?: string, meta?: any ) => Promise< T >;

}
