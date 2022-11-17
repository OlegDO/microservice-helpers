import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
// @TODO import from 'api' after instrumentations upgrade
import { metrics } from '@opentelemetry/api-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HostMetrics } from '@opentelemetry/host-metrics';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { Resource } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader, MeterProvider } from '@opentelemetry/sdk-metrics';
import opentelemetry from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import ResolveSrv from '@helpers/resolve-srv';
import GatewayInstrumentation from '@instrumentation/gateway-instrumentation';
import MicroserviceInstrumentation from '@instrumentation/microservice-instrumentation';

export interface ITracerConfig {
  MS_NAME: string;
  MS_OPENTELEMETRY_ENABLE?: number;
  MS_OPENTELEMETRY_OTLP_URL?: string;
  MS_OPENTELEMETRY_OTLP_URL_SRV?: number;
  MS_OPENTELEMETRY_DEBUG?: number;
  IS_PROD?: boolean;
  version?: string;
  isGateway?: boolean;
}

/**
 * Initialization opentelemetry
 */
const tracer = (constants: ITracerConfig): Promise<void> | void => {
  const {
    MS_NAME,
    MS_OPENTELEMETRY_ENABLE,
    MS_OPENTELEMETRY_OTLP_URL,
    MS_OPENTELEMETRY_OTLP_URL_SRV,
    MS_OPENTELEMETRY_DEBUG,
    IS_PROD = false,
    version = '1.0.0',
    isGateway = false,
  } = constants;

  if (!MS_OPENTELEMETRY_ENABLE) {
    return;
  }

  if (MS_OPENTELEMETRY_DEBUG) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: MS_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: version,
    deployment: IS_PROD ? 'prod' : 'string',
  });
  const meterProvider = new MeterProvider({
    resource,
  });
  // @ts-ignore @TODO need update (waiting new version)
  const hostMetrics = new HostMetrics({ meterProvider, name: 'host-metrics' });

  metrics.setGlobalMeterProvider(meterProvider);

  registerInstrumentations({
    instrumentations: [
      ...[isGateway ? [new GatewayInstrumentation()] : []],
      new MicroserviceInstrumentation(),
      new ExpressInstrumentation(),
      new WinstonInstrumentation(),
      new PgInstrumentation(),
    ],
  });

  return (async () => {
    let OTLP_URL = undefined;

    if (MS_OPENTELEMETRY_OTLP_URL) {
      OTLP_URL = MS_OPENTELEMETRY_OTLP_URL_SRV
        ? await ResolveSrv(MS_OPENTELEMETRY_OTLP_URL)
        : MS_OPENTELEMETRY_OTLP_URL;
    }

    meterProvider.addMetricReader(
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: OTLP_URL ? `${OTLP_URL}/v1/metrics` : undefined }),
        exportIntervalMillis: 5000,
      }),
    );

    const sdk = new opentelemetry.NodeSDK({
      traceExporter: new OTLPTraceExporter({ url: OTLP_URL ? `${OTLP_URL}/v1/traces` : undefined }),
      resource,
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

    sdk
      .start()
      .then(() => {
        hostMetrics.start();
        console.log('opentelemetry initialized.');
      })
      .catch((err) => console.log('Error start opentelemetry.', err));
  })();
};

export default tracer;
