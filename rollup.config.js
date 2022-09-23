import typescript from 'rollup-plugin-ts';
import json from '@rollup/plugin-json';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';

export default {
  // build mocks for generate tslib with all helpers
  // separate mocks folder to prevent errors when use common import
  input: [
    'src/index.ts',
    'src/helpers/tracer.ts',
    'src/mocks/index.ts',
    'src/test-helpers/index.ts'
  ],
  output: {
    dir: 'lib',
    format: 'cjs',
    sourcemap: true,
    preserveModules: true,
    preserveModulesRoot: 'src',
    exports: 'auto',
  },
  external: [
    'rewiremock',
    'sinon',
    'winston',
    'firebase-admin',
    'fs',
    'dns',
    'typeorm',
    'class-validator',
    'class-transformer',
    'typeorm-extension',
    '@lomray/microservice-nodejs-lib',
    '@lomray/microservice-remote-middleware',
    '@lomray/microservices-types',
    'class-validator-jsonschema',
    '@lomray/typeorm-json-query',
    'typeorm/query-builder/SelectQueryBuilder',
    'winston-loki',
    'klona/full',
    'traverse',
    'crypto',
    '@opentelemetry/api',
    '@opentelemetry/exporter-trace-otlp-http',
    '@opentelemetry/instrumentation-express',
    '@opentelemetry/instrumentation-http',
    '@opentelemetry/instrumentation-pg',
    '@opentelemetry/instrumentation-winston',
    '@opentelemetry/resources',
    '@opentelemetry/sdk-node',
    '@opentelemetry/semantic-conventions',
  ],
  plugins: [
    peerDepsExternal(),
    json(),
    typescript({
      tsconfig: resolvedConfig => ({
        ...resolvedConfig,
        declaration: true,
        importHelpers: true,
        plugins: [
          {
            "transform": "@zerollup/ts-transform-paths",
            "exclude": ["*"]
          }
        ]
      }),
    }),
  ],
};
