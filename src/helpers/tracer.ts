import { diag, DiagConsoleLogger, DiagLogLevel, metrics } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HostMetrics } from '@opentelemetry/host-metrics';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { InstrumentationOption } from '@opentelemetry/instrumentation/build/src/types_internal';
import { Resource } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
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
  BRANCH?: string;
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
    BRANCH = 'staging',
    version = '1.0.0',
    isGateway = false,
  } = constants;

  if (!MS_OPENTELEMETRY_ENABLE) {
    return;
  }

  if (MS_OPENTELEMETRY_DEBUG) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  // NOTE: Important think, we should create instrumentations not inside async functions
  const instrumentations: InstrumentationOption[] = [
    ...[isGateway ? new GatewayInstrumentation() : []],
    new MicroserviceInstrumentation(),
    new ExpressInstrumentation(),
    new WinstonInstrumentation(),
    new PgInstrumentation(),
  ];

  return (async () => {
    let OTLP_URL = undefined;

    if (MS_OPENTELEMETRY_OTLP_URL) {
      OTLP_URL = MS_OPENTELEMETRY_OTLP_URL_SRV
        ? await ResolveSrv(MS_OPENTELEMETRY_OTLP_URL)
        : MS_OPENTELEMETRY_OTLP_URL;
    }

    const sdk = new opentelemetry.NodeSDK({
      instrumentations,
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: MS_NAME,
        [SemanticResourceAttributes.SERVICE_VERSION]: version,
        deployment: BRANCH,
      }),
      metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: OTLP_URL ? `${OTLP_URL}/v1/metrics` : undefined }),
        exportIntervalMillis: 5000,
      }),
      traceExporter: new OTLPTraceExporter({ url: OTLP_URL ? `${OTLP_URL}/v1/traces` : undefined }),
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

    try {
      await sdk.start();

      // init instrumentation metrics
      for (const inst of instrumentations) {
        if ('initMetrics' in inst) {
          // @ts-ignore
          inst?.initMetrics();
        }
      }

      const hostMetrics = new HostMetrics({
        // @ts-ignore @TODO need update (waiting new version)
        meterProvider: metrics.getMeterProvider(),
        name: 'host-metrics',
      });

      hostMetrics.start();
      console.info('opentelemetry initialized.');
    } catch (e) {
      console.info('Error start opentelemetry.', e);
    }
  })();
};

export default tracer;
