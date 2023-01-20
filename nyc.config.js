module.exports = {
  extends: "@istanbuljs/nyc-config-typescript",
  include: [
    'src/**/*.ts'
  ],
  exclude: [
    'src/interfaces',
    'src/instrumentation/**/*.ts',
    'src/test-helpers/**/*.ts',
    'src/helpers/tracer.ts'
  ],
  all: true,
  cache: false,
  reporter: [
    'text',
    'text-summary',
    'lcov'
  ]
}
