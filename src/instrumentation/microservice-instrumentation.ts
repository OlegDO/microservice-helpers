/* eslint-disable @typescript-eslint/unbound-method,@typescript-eslint/no-this-alias,unicorn/no-this-assignment */
import type * as MsLib from '@lomray/microservice-nodejs-lib';
import {
  context,
  trace,
  Span,
  SpanKind,
  propagation,
  SpanStatusCode,
  HrTime,
  Context,
  ROOT_CONTEXT,
  MetricAttributes,
  ValueType,
} from '@opentelemetry/api';
import type { Histogram, SpanOptions } from '@opentelemetry/api';
import { hrTime, hrTimeDuration, hrTimeToMilliseconds } from '@opentelemetry/core';
import {
  InstrumentationBase,
  InstrumentationNodeModuleDefinition,
  isWrapped,
  safeExecuteInTheMiddleAsync,
} from '@opentelemetry/instrumentation';
import * as types from '@opentelemetry/instrumentation/build/src/types';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';

type TMicroservices = typeof MsLib;
type TSendRequest = TMicroservices['AbstractMicroservice']['prototype']['sendRequest'];
type TExecuteRequest = TMicroservices['AbstractMicroservice']['prototype']['executeRequest'];
type TExecuteEvent = TMicroservices['AbstractMicroservice']['prototype']['executeEvent'];

type TMs = TMicroservices & {
  AbstractMicroservice: {
    prototype: {
      executeRequest: TExecuteRequest;
      executeEvent: TExecuteEvent;
    };
  };
};

/**
 * Handler request error
 * @private
 */
const setSpanWithError = (span: Span, error: Error): void => {
  const { message, name } = error;

  span.setAttributes({
    'http.error_name': name,
    'http.error_message': message,
  });

  span.setStatus({ code: SpanStatusCode.ERROR, message });
  span.recordException(error);
};

const handleOriginalError = (error: Error) => {
  if (error) {
    throw error;
  }
};

class MicroserviceInstrumentation extends InstrumentationBase {
  /** keep track on spans not ended */
  private readonly _spanNotEnded: WeakSet<Span> = new WeakSet<Span>();

  private _httpServerDurationHistogram!: Histogram;
  private _httpClientDurationHistogram!: Histogram;

  constructor(config: types.InstrumentationConfig = {}) {
    super('@lomray/opentelemetry-microservice', '1.0.0', config);
  }

  /**
   * Call when SDK start and metric provider exist
   */
  public initMetrics() {
    this._httpServerDurationHistogram = this.meter.createHistogram(
      'http.microservice.server.duration',
      {
        description: 'measures the duration of the inbound HTTP requests',
        unit: 'ms',
        valueType: ValueType.DOUBLE,
      },
    );
    this._httpClientDurationHistogram = this.meter.createHistogram(
      'http.microservice.client.duration',
      {
        description: 'measures the duration of the outbound HTTP requests',
        unit: 'ms',
        valueType: ValueType.DOUBLE,
      },
    );
  }

  protected init() {
    return [
      new InstrumentationNodeModuleDefinition<TMs>(
        '@lomray/microservice-nodejs-lib',
        ['>=2'],
        (lib, moduleVersion) => {
          this._diag.debug(`applying patch (lib version is ${moduleVersion || 'unknown'})`);

          if (isWrapped(lib.AbstractMicroservice.prototype.sendRequest)) {
            this._unwrap(lib.AbstractMicroservice.prototype, 'sendRequest');
          }

          this._wrap(lib.AbstractMicroservice.prototype, 'sendRequest', this._getOutgoingRequest());

          if (isWrapped(lib.AbstractMicroservice.prototype['executeRequest'])) {
            this._unwrap(lib.AbstractMicroservice.prototype, 'executeRequest');
          }

          this._wrap(
            lib.AbstractMicroservice.prototype,
            'executeRequest',
            this._getExecuteRequest(),
          );

          if (isWrapped(lib.AbstractMicroservice.eventPublish)) {
            this._unwrap(lib.AbstractMicroservice, 'eventPublish');
          }

          this._wrap(lib.AbstractMicroservice, 'eventPublish', this._getPublishEvent());

          if (isWrapped(lib.AbstractMicroservice.prototype['executeEvent'])) {
            this._unwrap(lib.AbstractMicroservice.prototype, 'executeEvent');
          }

          this._wrap(lib.AbstractMicroservice.prototype, 'executeEvent', this._getExecuteEvent());

          return lib;
        },
        (lib) => {
          if (lib === undefined) {
            return;
          }

          this._unwrap(lib.AbstractMicroservice.prototype, 'sendRequest');
          this._unwrap(lib.AbstractMicroservice.prototype, 'executeRequest');
          this._unwrap(lib.AbstractMicroservice, 'eventPublish');
          this._unwrap(lib.AbstractMicroservice.prototype, 'executeEvent');
        },
      ),
    ];
  }

  /**
   * Handle incoming microservice task
   * @private
   */
  private _getExecuteRequest() {
    return (original: TExecuteRequest) => {
      const instrumentation = this;

      return function executeRequest(this: never, ...args: Parameters<typeof original>) {
        instrumentation._diag.debug('instrumentation incoming - request');

        const [task] = args;
        // this can be request (task) or response (error)
        const params = (task as MsLib.MicroserviceRequest)?.getParams();
        const method = (task as MsLib.MicroserviceRequest)?.getMethod();
        const reqId = (task as MsLib.MicroserviceRequest)?.getId();

        const startTime = hrTime();
        const type = 'incoming-request';
        const isError = Boolean(task?.['error'] as MsLib.BaseException);
        const headers = params?.payload?.headers;
        const hostname = params?.payload?.headers?.host;
        const clientIp = params?.payload?.headers?.['x-forwarded-for'];
        const userAgent = params?.payload?.headers?.['user-agent'];
        const attributes = {
          reqId,
          [SemanticAttributes.HTTP_URL]: method,
          [SemanticAttributes.HTTP_METHOD]: 'POST',
          [SemanticAttributes.HTTP_TARGET]: '/',
          [SemanticAttributes.NET_PEER_NAME]: hostname,
          [SemanticAttributes.HTTP_CLIENT_IP]: clientIp,
          [SemanticAttributes.HTTP_USER_AGENT]: userAgent,
          body: JSON.stringify(params || {}),
          type,
        };
        let metricAttributes: MetricAttributes = {
          [SemanticAttributes.HTTP_URL]: method,
          [SemanticAttributes.HTTP_CLIENT_IP]: clientIp,
          [SemanticAttributes.HTTP_METHOD]: attributes[SemanticAttributes.HTTP_METHOD],
          [SemanticAttributes.NET_PEER_NAME]: attributes[SemanticAttributes.NET_PEER_NAME],
          type,
        };
        const ctx = propagation.extract(ROOT_CONTEXT, headers);
        const spanOptions: SpanOptions = {
          kind: SpanKind.SERVER,
          attributes,
        };
        const span = instrumentation._startHttpSpan(
          `MS INCOME REQUEST - ${method ?? 'unknown'}`,
          spanOptions,
          ctx,
        );
        const requestContext = trace.setSpan(ctx, span);

        return context.with(requestContext, async () => {
          const response = await safeExecuteInTheMiddleAsync(
            () => original.apply(this, args),
            handleOriginalError,
          );

          instrumentation._diag.debug('instrumentation incoming - response');

          // done request
          const responseAttributes = {
            [SemanticAttributes.HTTP_STATUS_CODE]: isError ? 500 : 200,
          };

          metricAttributes = Object.assign(metricAttributes, {
            [SemanticAttributes.HTTP_STATUS_CODE]:
              responseAttributes[SemanticAttributes.HTTP_STATUS_CODE],
          });
          span.setAttributes(responseAttributes);
          span.setStatus({ code: SpanStatusCode.OK });
          instrumentation._closeHttpSpan(span, SpanKind.SERVER, startTime, metricAttributes);

          return response;
        });
      };
    };
  }

  /**
   * Handle outgoing microservice request
   * @private
   */
  private _getOutgoingRequest() {
    return (original: TSendRequest) => {
      const instrumentation = this;

      return function outgoingRequest(this: never, ...args: Parameters<typeof original>) {
        const [method, data, ...otherArgs] = args;
        const { payload } = data || {};
        const hostname = payload?.headers?.host as string;
        const port = payload?.headers?.['x-forwarded-port'] as string;
        const scheme = payload?.headers?.['x-forwarded-proto'];
        const clientIp = payload?.headers?.['x-forwarded-for'];
        const userAgent = payload?.headers?.['user-agent'];
        const contentLength = payload?.headers?.['content-length'];

        const operationName = `MS REQUEST - ${method}`;
        const type = 'outgoing-request';
        const startTime = hrTime();
        const attributes = {
          [SemanticAttributes.HTTP_URL]: method,
          [SemanticAttributes.HTTP_USER_AGENT]: userAgent,
          [SemanticAttributes.HTTP_METHOD]: 'POST',
          [SemanticAttributes.HTTP_TARGET]: '/',
          [SemanticAttributes.NET_PEER_NAME]: hostname,
          [SemanticAttributes.HTTP_HOST]: `${hostname}:${port}`,
          [SemanticAttributes.HTTP_SCHEME]: scheme,
          [SemanticAttributes.HTTP_CLIENT_IP]: clientIp,
          [SemanticAttributes.HTTP_REQUEST_CONTENT_LENGTH]: contentLength,
          body: JSON.stringify(data || {}),
          type,
        };
        let metricAttributes: MetricAttributes = {
          [SemanticAttributes.HTTP_URL]: method,
          [SemanticAttributes.HTTP_CLIENT_IP]: clientIp,
          [SemanticAttributes.HTTP_METHOD]: attributes[SemanticAttributes.HTTP_METHOD],
          [SemanticAttributes.NET_PEER_NAME]: attributes[SemanticAttributes.NET_PEER_NAME],
          type,
        };
        const spanOptions: SpanOptions = {
          kind: SpanKind.CLIENT,
          attributes,
        };
        const span = instrumentation._startHttpSpan(operationName, spanOptions);
        const parentContext = context.active();
        const requestContext = trace.setSpan(parentContext, span);

        propagation.inject(requestContext, payload?.headers);

        return context.with(requestContext, async () => {
          instrumentation._diag.debug('instrumentation outgoing - request');

          const response = await safeExecuteInTheMiddleAsync(
            () => Reflect.apply(original, this, [method, data, ...otherArgs]),
            (error) => {
              if (error) {
                setSpanWithError(span, error);
                instrumentation._closeHttpSpan(span, SpanKind.CLIENT, startTime, metricAttributes);
                throw error;
              }
            },
          );
          const isError = Boolean(response?.error);
          const responseAttributes = {
            [SemanticAttributes.HTTP_STATUS_CODE]: isError ? 500 : 200,
          };

          metricAttributes = Object.assign(metricAttributes, {
            [SemanticAttributes.HTTP_STATUS_CODE]:
              responseAttributes[SemanticAttributes.HTTP_STATUS_CODE],
          });
          span.setAttributes(responseAttributes);
          span.setStatus({ code: SpanStatusCode.OK });
          instrumentation._closeHttpSpan(span, SpanKind.CLIENT, startTime, metricAttributes);

          instrumentation._diag.debug('instrumentation outgoing - response');

          return response;
        });
      };
    };
  }

  /**
   * Handle microservice publish event
   * @private
   */
  private _getPublishEvent() {
    return (original: TMicroservices['AbstractMicroservice']['eventPublish']) => {
      const instrumentation = this;

      return function publishEvent(this: never, ...args: Parameters<typeof original>) {
        const [eventName, params, payload] = args;

        const operationName = `MS PUBLISH EVENT - ${eventName}`;
        const startTime = hrTime();
        const type = 'publish-event';
        const attributes = {
          [SemanticAttributes.HTTP_URL]: eventName,
          [SemanticAttributes.HTTP_METHOD]: 'POST',
          [SemanticAttributes.HTTP_TARGET]: eventName,
          body: JSON.stringify(params || {}),
          type,
        };
        let metricAttributes: MetricAttributes = {
          [SemanticAttributes.HTTP_URL]: eventName,
          [SemanticAttributes.HTTP_METHOD]: attributes[SemanticAttributes.HTTP_METHOD],
          type,
        };
        const spanOptions: SpanOptions = {
          kind: SpanKind.CLIENT,
          attributes,
        };
        const span = instrumentation._startHttpSpan(operationName, spanOptions);
        const parentContext = context.active();
        const requestContext = trace.setSpan(parentContext, span);
        const payloadWithContext = payload || {};

        propagation.inject(requestContext, payloadWithContext);

        return context.with(requestContext, async () => {
          instrumentation._diag.debug('instrumentation event - publish');

          const response = await safeExecuteInTheMiddleAsync(
            () => Reflect.apply(original, this, [eventName, params, payloadWithContext]),
            (error) => {
              if (error) {
                instrumentation._closeHttpSpan(
                  span,
                  SpanKind.CLIENT,
                  startTime,
                  metricAttributes,
                  error,
                );
                throw error;
              }
            },
          );
          const isError = Boolean(response?.message);
          const responseAttributes = {
            [SemanticAttributes.HTTP_STATUS_CODE]: isError ? 500 : 200,
            countListeners: isError ? 0 : response,
          };

          metricAttributes = Object.assign(metricAttributes, {
            [SemanticAttributes.HTTP_STATUS_CODE]:
              responseAttributes[SemanticAttributes.HTTP_STATUS_CODE],
          });
          span.setAttributes(responseAttributes);
          span.setStatus({ code: SpanStatusCode.OK });
          instrumentation._closeHttpSpan(span, SpanKind.CLIENT, startTime, metricAttributes);

          instrumentation._diag.debug('instrumentation event - publish done');

          return response;
        });
      };
    };
  }

  /**
   * Execute incoming microservice event
   * @private
   */
  private _getExecuteEvent() {
    return (original: TExecuteEvent) => {
      const instrumentation = this;

      return function executeEvent(this: never, ...args: Parameters<typeof original>) {
        const [data] = args;
        const eventName = data?.payload?.eventName ?? 'unknown';
        const payload = data?.payload ?? {};

        const operationName = `MS EXECUTE EVENT - ${eventName}`;
        const type = 'execute-event';
        const startTime = hrTime();
        const attributes = {
          [SemanticAttributes.HTTP_URL]: eventName,
          [SemanticAttributes.HTTP_METHOD]: 'POST',
          [SemanticAttributes.HTTP_TARGET]: eventName,
          body: JSON.stringify(data || {}),
          type,
        };
        let metricAttributes: MetricAttributes = {
          [SemanticAttributes.HTTP_URL]: eventName,
          [SemanticAttributes.HTTP_METHOD]: attributes[SemanticAttributes.HTTP_METHOD],
          type,
        };
        const spanOptions: SpanOptions = {
          kind: SpanKind.SERVER,
          attributes,
        };
        const ctx = propagation.extract(ROOT_CONTEXT, payload);
        const span = instrumentation._startHttpSpan(operationName, spanOptions, ctx);
        const requestContext = trace.setSpan(ctx, span);

        return context.with(requestContext, async () => {
          instrumentation._diag.debug('instrumentation event - execute');

          const response = await safeExecuteInTheMiddleAsync(
            () => Reflect.apply(original, this, [data]),
            (error) => {
              if (error) {
                instrumentation._closeHttpSpan(
                  span,
                  SpanKind.SERVER,
                  startTime,
                  metricAttributes,
                  error,
                );
                throw error;
              }
            },
          );

          const responseAttributes = {
            [SemanticAttributes.HTTP_STATUS_CODE]: 200,
          };

          metricAttributes = Object.assign(metricAttributes, {
            [SemanticAttributes.HTTP_STATUS_CODE]:
              responseAttributes[SemanticAttributes.HTTP_STATUS_CODE],
          });
          span.setAttributes(responseAttributes);
          span.setStatus({ code: SpanStatusCode.OK });
          instrumentation._closeHttpSpan(span, SpanKind.SERVER, startTime, metricAttributes);

          instrumentation._diag.debug('instrumentation event - execute done');

          return response;
        });
      };
    };
  }

  private _startHttpSpan(name: string, options: SpanOptions, ctx?: Context) {
    const span = this.tracer.startSpan(name, options, ctx || context.active());

    this._spanNotEnded.add(span);

    return span;
  }

  private _closeHttpSpan(
    span: Span,
    spanKind: SpanKind,
    startTime: HrTime,
    metricAttributes: MetricAttributes,
    error?: Error,
  ) {
    if (error) {
      setSpanWithError(span, error);
    }

    if (!this._spanNotEnded.has(span)) {
      return;
    }

    span.end();
    this._spanNotEnded.delete(span);

    // Record metrics
    const duration = hrTimeToMilliseconds(hrTimeDuration(startTime, hrTime()));

    if (spanKind === SpanKind.SERVER) {
      this._httpServerDurationHistogram?.record(duration, metricAttributes);
    } else if (spanKind === SpanKind.CLIENT) {
      this._httpClientDurationHistogram?.record(duration, metricAttributes);
    }
  }
}

export default MicroserviceInstrumentation;
