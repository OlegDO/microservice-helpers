import { diag, DiagConsoleLogger, DiagLogLevel, metrics } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HostMetrics } from '@opentelemetry/host-metrics';
import { InstrumentationOption } from '@opentelemetry/instrumentation/build/src/types_internal';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { Resource } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import opentelemetry from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { v4 as uuidv4 } from 'uuid';
import type { ICommonConstants } from '@helpers/get-constants';
import ResolveSrv from '@helpers/resolve-srv';
import GatewayInstrumentation from '@instrumentation/gateway-instrumentation';
import MicroserviceInstrumentation from '@instrumentation/microservice-instrumentation';

type TConstants = Pick<
  ICommonConstants,
  | 'MS_NAME'
  | 'ENVIRONMENT'
  | 'VERSION'
  | 'IS_OPENTELEMETRY_ENABLE'
  | 'MS_OPENTELEMETRY_OTLP_URL'
  | 'IS_OPENTELEMETRY_OTLP_URL_SRV'
  | 'IS_OPENTELEMETRY_DEBUG'
>;

export interface ITracerConfig extends TConstants {
  isGateway?: boolean;
}

/**
 * Initialization opentelemetry
 */
const tracer = (constants: ITracerConfig): Promise<void> | void => {
  const {
    MS_NAME,
    IS_OPENTELEMETRY_ENABLE,
    MS_OPENTELEMETRY_OTLP_URL,
    IS_OPENTELEMETRY_OTLP_URL_SRV,
    IS_OPENTELEMETRY_DEBUG,
    ENVIRONMENT = 'staging',
    VERSION = '1.0.0',
    isGateway = false,
  } = constants;

  if (!IS_OPENTELEMETRY_ENABLE) {
    return;
  }

  if (IS_OPENTELEMETRY_DEBUG) {
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

  const getTraceUrl = (host?: string): string | undefined =>
    host ? `${host}/v1/traces` : undefined;
  const getMetricUrl = (host?: string): string | undefined =>
    host ? `${host}/v1/metrics` : undefined;

  return (async () => {
    let OTLP_URL = undefined;

    if (MS_OPENTELEMETRY_OTLP_URL) {
      OTLP_URL = IS_OPENTELEMETRY_OTLP_URL_SRV
        ? await ResolveSrv(MS_OPENTELEMETRY_OTLP_URL)
        : MS_OPENTELEMETRY_OTLP_URL;
    }

    const otlpInstanceId = uuidv4();
    const exporter = new OTLPMetricExporter({
      url: getMetricUrl(OTLP_URL),
    });
    const traceExporter = new OTLPTraceExporter({
      url: getTraceUrl(OTLP_URL),
    });
    const sdk = new opentelemetry.NodeSDK({
      instrumentations,
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: MS_NAME,
        [SemanticResourceAttributes.SERVICE_VERSION]: VERSION,
        environment: ENVIRONMENT,
        otlpInstanceId,
      }),
      metricReader: new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis: 1000,
      }),
      traceExporter,
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
      sdk.start();

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
      console.info('opentelemetry initialized: ', otlpInstanceId);

      // track srv records changes
      if (IS_OPENTELEMETRY_OTLP_URL_SRV && MS_OPENTELEMETRY_OTLP_URL) {
        setInterval(() => {
          ResolveSrv(MS_OPENTELEMETRY_OTLP_URL)
            .then((url) => {
              // @ts-ignore
              exporter['_otlpExporter']['url'] = getMetricUrl(url);
              // @ts-ignore
              traceExporter['url'] = getTraceUrl(url);
            })
            .catch((e) => {
              console.log('Failed resolve OTLP SRV URL: ', e);
            });
        }, 30000);
      }
    } catch (e) {
      console.info('Error start opentelemetry.', e);
    }
  })();
};

export default tracer;
