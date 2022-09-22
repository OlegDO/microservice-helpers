import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { Resource } from '@opentelemetry/resources';
import opentelemetry from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import ResolveSrv from '@helpers/resolve-srv';

interface IConfig {
  MS_NAME: string;
  MS_OPENTELEMETRY_ENABLE?: number;
  MS_OPENTELEMETRY_OTLP_URL?: string;
  MS_OPENTELEMETRY_OTLP_URL_SRV?: number;
  MS_OPENTELEMETRY_DEBUG?: number;
}

/**
 * Initialization opentelemetry
 */
export default async (constants: IConfig): Promise<opentelemetry.NodeSDK | undefined> => {
  const {
    MS_NAME,
    MS_OPENTELEMETRY_ENABLE,
    MS_OPENTELEMETRY_OTLP_URL,
    MS_OPENTELEMETRY_OTLP_URL_SRV,
    MS_OPENTELEMETRY_DEBUG,
  } = constants;

  let OTLP_URL = undefined;

  if (MS_OPENTELEMETRY_OTLP_URL) {
    OTLP_URL = MS_OPENTELEMETRY_OTLP_URL_SRV
      ? await ResolveSrv(MS_OPENTELEMETRY_OTLP_URL)
      : MS_OPENTELEMETRY_OTLP_URL;
  }

  if (!MS_OPENTELEMETRY_ENABLE) {
    return;
  }

  if (MS_OPENTELEMETRY_DEBUG) {
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
