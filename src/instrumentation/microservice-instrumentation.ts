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
} from '@opentelemetry/api';
import type { SpanOptions } from '@opentelemetry/api';
import { Histogram, MetricAttributes, ValueType } from '@opentelemetry/api-metrics';
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
type THandleTask = TMicroservices['AbstractMicroservice']['prototype']['getTask'];
type THandleResponse = TMicroservices['AbstractMicroservice']['prototype']['sendResponse'];
type TExecuteRequest = TMicroservices['AbstractMicroservice']['prototype']['executeRequest'];

type ITracerContext = {
  tracer: {
    context: Context;
    onEnd: () => void;
  };
};

type TMs = TMicroservices & {
  AbstractMicroservice: {
    prototype: {
      getTask: THandleTask;
      sendResponse: THandleResponse;
      executeRequest: TExecuteRequest;
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
  constructor(config: types.InstrumentationConfig = {}) {
    super('@lomray/opentelemetry-microservice', '1.0.0', config);
    this._updateMetricInstruments();
  }

  /** keep track on spans not ended */
  private readonly _spanNotEnded: WeakSet<Span> = new WeakSet<Span>();

  private _httpServerDurationHistogram!: Histogram;
  private _httpClientDurationHistogram!: Histogram;

  private _updateMetricInstruments() {
    this._httpServerDurationHistogram = this.meter.createHistogram('http.server.duration', {
      description: 'measures the duration of the inbound HTTP requests',
      unit: 'ms',
      valueType: ValueType.DOUBLE,
    });
    this._httpClientDurationHistogram = this.meter.createHistogram('http.client.duration', {
      description: 'measures the duration of the outbound HTTP requests',
      unit: 'ms',
      valueType: ValueType.DOUBLE,
    });
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

          if (isWrapped(lib.AbstractMicroservice.prototype['getTask'])) {
            this._unwrap(lib.AbstractMicroservice.prototype, 'getTask');
          }

          this._wrap(lib.AbstractMicroservice.prototype, 'getTask', this._getIncomingRequest());

          if (isWrapped(lib.AbstractMicroservice.prototype['sendResponse'])) {
            this._unwrap(lib.AbstractMicroservice.prototype, 'sendResponse');
          }

          this._wrap(
            lib.AbstractMicroservice.prototype,
            'sendResponse',
            this._getIncomingResponse(),
          );

          if (isWrapped(lib.AbstractMicroservice.prototype['executeRequest'])) {
            this._unwrap(lib.AbstractMicroservice.prototype, 'executeRequest');
          }

          this._wrap(
            lib.AbstractMicroservice.prototype,
            'executeRequest',
            this._getExecuteRequest(),
          );

          return lib;
        },
        (lib) => {
          if (lib === undefined) {
            return;
          }

          this._unwrap(lib.AbstractMicroservice.prototype, 'sendRequest');
          this._unwrap(lib.AbstractMicroservice.prototype, 'sendResponse');
          this._unwrap(lib.AbstractMicroservice.prototype, 'executeRequest');
          this._unwrap(lib.AbstractMicroservice.prototype, 'getTask');
        },
      ),
    ];
  }

  private _getIncomingResponse() {
    return (original: THandleResponse) =>
      function incomingResponse(this: never, ...args: Parameters<typeof original>) {
        const task = args[2] as Parameters<typeof original>[2] & ITracerContext;

        // done request
        task?.tracer.onEnd();

        return original.apply(this, args);
      };
  }

  private _getExecuteRequest() {
    return (original: TExecuteRequest) =>
      function executeRequest(this: never, ...args: Parameters<typeof original>) {
        const task = args[0] as Parameters<typeof original>[0] & ITracerContext;

        return context.with(task?.tracer.context, () =>
          safeExecuteInTheMiddleAsync(() => original.apply(this, args), handleOriginalError),
        );
      };
  }

  private _getIncomingRequest() {
    return (original: THandleTask) => {
      const instrumentation = this;

      return async function incomingRequest(this: never, ...args: Parameters<typeof original>) {
        const request = await safeExecuteInTheMiddleAsync(
          () => original.apply(this, args),
          handleOriginalError,
        );

        instrumentation._diag.debug('instrumentation incoming - request');

        const startTime = hrTime();
        const {
          // @ts-ignore
          task: { params, method },
        } = request as MsLib.ITask;
        const headers = params?.payload?.headers;
        const hostname = params?.payload?.headers?.host;
        const clientIp = params?.payload?.headers?.['x-forwarded-for'];
        const userAgent = params?.payload?.headers?.['user-agent'];

        const ctx = propagation.extract(ROOT_CONTEXT, headers);
        const attributes = {
          body: JSON.stringify(params || {}),
          [SemanticAttributes.HTTP_URL]: method,
          [SemanticAttributes.HTTP_METHOD]: 'POST',
          [SemanticAttributes.HTTP_TARGET]: '/',
          [SemanticAttributes.NET_PEER_NAME]: hostname,
          [SemanticAttributes.HTTP_CLIENT_IP]: clientIp,
          [SemanticAttributes.HTTP_USER_AGENT]: userAgent,
        };
        let metricAttributes: MetricAttributes = {
          [SemanticAttributes.HTTP_METHOD]: attributes[SemanticAttributes.HTTP_METHOD],
          [SemanticAttributes.NET_PEER_NAME]: attributes[SemanticAttributes.NET_PEER_NAME],
        };
        const spanOptions: SpanOptions = {
          kind: SpanKind.SERVER,
          attributes,
        };
        const span = instrumentation._startHttpSpan(
          `MS INCOME REQUEST - ${(method as string) ?? 'unknown'}`,
          spanOptions,
          ctx,
        );
        const requestContext = trace.setSpan(ctx, span);

        // request create span
        return context.with(requestContext, () => {
          request.task.tracer = {
            context: requestContext,
            onEnd: () => {
              instrumentation._diag.debug('instrumentation incoming - response');

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
            },
          };

          return request;
        });
      };
    };
  }

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
        const startTime = hrTime();
        const attributes = {
          body: JSON.stringify(data || {}),
          [SemanticAttributes.HTTP_URL]: method,
          [SemanticAttributes.HTTP_METHOD]: 'POST',
          [SemanticAttributes.HTTP_TARGET]: '/',
          [SemanticAttributes.NET_PEER_NAME]: hostname,
          [SemanticAttributes.HTTP_HOST]: `${hostname}:${port}`,
          [SemanticAttributes.HTTP_SCHEME]: scheme,
          [SemanticAttributes.HTTP_CLIENT_IP]: clientIp,
          [SemanticAttributes.HTTP_USER_AGENT]: userAgent,
          [SemanticAttributes.HTTP_REQUEST_CONTENT_LENGTH]: contentLength,
        };
        let metricAttributes: MetricAttributes = {
          [SemanticAttributes.HTTP_METHOD]: attributes[SemanticAttributes.HTTP_METHOD],
          [SemanticAttributes.NET_PEER_NAME]: attributes[SemanticAttributes.NET_PEER_NAME],
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

          const responseAttributes = {
            [SemanticAttributes.HTTP_STATUS_CODE]: 200,
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
  ) {
    if (!this._spanNotEnded.has(span)) {
      return;
    }

    span.end();
    this._spanNotEnded.delete(span);

    // Record metrics
    const duration = hrTimeToMilliseconds(hrTimeDuration(startTime, hrTime()));

    if (spanKind === SpanKind.SERVER) {
      this._httpServerDurationHistogram.record(duration, metricAttributes);
    } else if (spanKind === SpanKind.CLIENT) {
      this._httpClientDurationHistogram.record(duration, metricAttributes);
    }
  }
}

export default MicroserviceInstrumentation;
