module.exports = {
  extends: "@istanbuljs/nyc-config-typescript",
  include: [
    'src/**/*.ts'
  ],
  exclude: [
    'src/interfaces',
    'src/instrumentation',
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
