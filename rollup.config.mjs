import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import cleanup from 'rollup-plugin-cleanup';
import prettier from 'rollup-plugin-prettier';

export default {
    input: 'src/NanoProfiler.ts',
    plugins: [
        resolve( { extensions: [ '.js', '.ts' ] } ), commonjs(),
        typescript( { tsconfig: 'tsconfig.json', compilerOptions: { declaration: false } } ),
        cleanup( { comments: 'istanbul', extensions: [ 'js', 'ts' ] } ),
        prettier( {
            parser: 'babel', tabWidth: 2, bracketSpacing: true, bracketSameLine: true, singleQuote: true,
            jsxSingleQuote: true, trailingComma: 'none', objectWrap: 'collapse'
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
