import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import { terser } from "rollup-plugin-terser";
import esmImportToUrl from "rollup-plugin-esm-import-to-url";
import nodePolyfills from "rollup-plugin-polyfill-node";

export default [
  {
    input: "src/index.ts",
    output: [
      {
        file: "browser/index.js",
        format: "es",
        sourcemap: true,
        plugins: [terser()],
      },
    ],
    plugins: [
      nodePolyfills(),
      esmImportToUrl({
        imports: {
          tslib: "https://unpkg.com/tslib@2/tslib.es6.js",
          "@aicacia/rand":
            "https://unpkg.com/browse/@aicacia/rand@0/browser/index.js",
          "socket.io-client":
            "https://unpkg.com/socket.io-client@4/dist/socket.io.esm.min.js",
        },
      }),
      resolve({ browser: true }),
      commonjs({
        transformMixedEsModules: true,
      }),
      typescript({
        tsconfig: "./tsconfig.esm.json",
      }),
    ],
  },
];
