import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import cleanup from 'rollup-plugin-cleanup';

export default {
    input: 'src/NanoProfiler.ts',
    plugins: [
        resolve(), commonjs(),
        cleanup( { comments: 'istanbul', extensions: [ 'js', 'ts' ] } ),
        typescript( {
            tsconfig: 'tsconfig.json', clean: true,
            tsconfigOverride: { compilerOptions: { declaration: false } }
        } )
    ],
    output: [ {
        file: 'dist/nano-profiler.cjs',
        format: 'cjs',
        exports: 'named'
    }, {
        file: 'dist/nano-profiler.mjs',
        format: 'es'
    } ]
};
