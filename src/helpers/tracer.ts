import { ResolveSrv } from '@lomray/microservice-nodejs-lib';
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
  MS_URL_SRV_GRAFANA_AGENT_TRACERS?: number;
  MS_GRAFANA_TRACERS_DEBUG?: number;
}

/**
 * Initialization opentelemetry
 */
export default async (constants: IConfig): Promise<opentelemetry.NodeSDK | undefined> => {
  const {
    MS_NAME,
    MS_ENABLE_GRAFANA_TRACERS,
    MS_URL_GRAFANA_AGENT_TRACERS,
    MS_URL_SRV_GRAFANA_AGENT_TRACERS,
    MS_GRAFANA_TRACERS_DEBUG,
  } = constants;

  let OTLP_URL = undefined;

  if (MS_URL_GRAFANA_AGENT_TRACERS) {
    OTLP_URL = MS_URL_SRV_GRAFANA_AGENT_TRACERS
      ? await ResolveSrv(MS_URL_GRAFANA_AGENT_TRACERS)
      : MS_URL_GRAFANA_AGENT_TRACERS;
  }

  if (!MS_ENABLE_GRAFANA_TRACERS) {
    return;
  }

  if (MS_GRAFANA_TRACERS_DEBUG) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const sdk = new opentelemetry.NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: OTLP_URL }),
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
