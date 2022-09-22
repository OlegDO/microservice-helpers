import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { Resource } from '@opentelemetry/resources';
import opentelemetry from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

interface IConfig {
  MS_NAME: string;
  MS_ENABLE_GRAFANA_TRACERS?: number;
  MS_URL_GRAFANA_AGENT_TRACERS?: string;
  MS_GRAFANA_TRACERS_DEBUG?: number;
}

/**
 * Initialization opentelemetry
 */
export default (constants: IConfig) => {
  const {
    MS_NAME,
    MS_ENABLE_GRAFANA_TRACERS,
    MS_URL_GRAFANA_AGENT_TRACERS,
    MS_GRAFANA_TRACERS_DEBUG,
  } = constants;

  if (!MS_ENABLE_GRAFANA_TRACERS) {
    return;
  }

  if (MS_GRAFANA_TRACERS_DEBUG) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const sdk = new opentelemetry.NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: MS_URL_GRAFANA_AGENT_TRACERS }),
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new WinstonInstrumentation(),
      new PgInstrumentation(),
    ],
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: MS_NAME,
    }),
  });

  // You can also use the shutdown method to gracefully shut down the SDK before process shutdown
  // or on some operating system signal.
  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(
        () => console.log('opentelemetry shut down successfully.'),
        (err) => console.log('Error shutting down opentelemetry.', err),
      )
      .finally(() => process.exit(0));
  });

  void sdk.start().then(() => console.log('opentelemetry initialized.'));

  return sdk;
};
