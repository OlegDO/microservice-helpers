/* eslint-disable @typescript-eslint/unbound-method,@typescript-eslint/no-this-alias,unicorn/no-this-assignment,@typescript-eslint/no-unused-vars */
/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as http from 'http';
import {
  trace,
  context,
  Span,
  SpanKind,
  ROOT_CONTEXT,
  propagation,
  SpanOptions,
  Context,
  SpanStatusCode,
  HrTime,
} from '@opentelemetry/api';
import { Histogram, MetricAttributes, ValueType } from '@opentelemetry/api-metrics';
import {
  hrTime,
  setRPCMetadata,
  RPCType,
  hrTimeToMilliseconds,
  hrTimeDuration,
} from '@opentelemetry/core';
import {
  InstrumentationBase,
  InstrumentationNodeModuleDefinition,
  isWrapped,
  safeExecuteInTheMiddle,
} from '@opentelemetry/instrumentation';
import * as types from '@opentelemetry/instrumentation/build/src/types';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import type * as express from 'express';

type ResponseEndArgs =
  | [((() => void) | undefined)?]
  | [unknown, ((() => void) | undefined)?]
  | [unknown, string, ((() => void) | undefined)?];

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

/**
 * Get ip address from request
 */
const parseIp = (req: http.IncomingMessage) =>
  (req.headers['x-forwarded-for'] as string)?.split(',').shift() || req.socket?.remoteAddress;

class GatewayInstrumentation extends InstrumentationBase<typeof express> {
  /** keep track on spans not ended */
  private readonly _spanNotEnded: WeakSet<Span> = new WeakSet<Span>();

  private _httpServerDurationHistogram!: Histogram;
  private _httpClientDurationHistogram!: Histogram;

  constructor(config: types.InstrumentationConfig = {}) {
    super('@lomray/opentelemetry-microservice-gateway', '1.0.0', config);
  }

  /**
   * Call when SDK start and metric provider exist
   */
  public initMetrics() {
    this._httpServerDurationHistogram = this.meter.createHistogram('http.gateway.duration', {
      description: 'measures the duration of the inbound HTTP requests',
      unit: 'ms',
      valueType: ValueType.DOUBLE,
    });
    this._httpClientDurationHistogram = this.meter.createHistogram('http.gateway.duration', {
      description: 'measures the duration of the outbound HTTP requests',
      unit: 'ms',
      valueType: ValueType.DOUBLE,
    });
  }

  init() {
    return [
      new InstrumentationNodeModuleDefinition<typeof http>(
        'http',
        ['*'],
        (moduleExports, moduleVersion) => {
          this._diag.debug(`applying patch (lib version is ${moduleVersion || 'unknown'})`);

          if (isWrapped(moduleExports.Server.prototype.emit)) {
            this._unwrap(moduleExports.Server.prototype, 'emit');
          }

          this._wrap(
            moduleExports.Server.prototype,
            'emit',
            this._getPatchIncomingRequestFunction('http'),
          );

          return moduleExports;
        },
        (moduleExports) => {
          if (moduleExports === undefined) {
            return;
          }

          this._diag.debug(`removing patch`);
          this._unwrap(moduleExports.Server.prototype, 'emit');
        },
      ),
    ];
  }

  /**
   * Creates spans for incoming requests, restoring spans' context if applied.
   */
  protected _getPatchIncomingRequestFunction(component: 'http' | 'https') {
    return (
      original: (event: string, ...args: unknown[]) => boolean,
    ): ((this: unknown, event: string, ...args: unknown[]) => boolean) =>
      this._incomingRequestFunction(component, original);
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
      this._httpServerDurationHistogram?.record(duration, metricAttributes);
    }
  }

  private _incomingRequestFunction(
    component: 'http' | 'https',
    original: (event: string, ...args: unknown[]) => boolean,
  ) {
    const instrumentation = this;

    return function incomingRequest(this: unknown, event: string, ...args: unknown[]): boolean {
      // Only traces request events
      if (event !== 'request') {
        return Reflect.apply(original, this, [event, ...args]);
      }

      const request = args[0] as http.IncomingMessage;
      const response = args[1] as http.ServerResponse;
      const method = request.method || 'GET';

      instrumentation._diag.debug(`${component} instrumentation incomingRequest`);

      const { headers, url } = request;
      const ipAddress = parseIp(request);

      const spanAttributes = {
        component,
        serverName: 'gateway-server',
        headers: typeof headers === 'object' ? JSON.stringify(headers) : '',
        ipAddress,
        method,
      };

      const spanOptions = {
        kind: SpanKind.SERVER,
        attributes: spanAttributes,
      };
      let metricAttributes = {
        ipAddress,
        method,
      };
      const startTime = hrTime();

      const ctx = propagation.extract(ROOT_CONTEXT, headers);
      const span = instrumentation._startHttpSpan(
        `${component.toLocaleUpperCase()} ${method}`,
        spanOptions,
        ctx,
      );
      const rpcMetadata = {
        type: RPCType.HTTP,
        span,
      };

      return context.with(setRPCMetadata(trace.setSpan(ctx, span), rpcMetadata), () => {
        context.bind(context.active(), request);
        context.bind(context.active(), response);

        // instrumentation._headerCapture.server.captureRequestHeaders(span, header => request.headers[header]);

        // Wraps end (inspired by:
        // https://github.com/GoogleCloudPlatform/cloud-trace-nodejs/blob/master/src/instrumentations/instrumentation-connect.ts#L75)
        const originalEnd = response.end;

        response.end = function (this: http.ServerResponse, ..._args: ResponseEndArgs) {
          response.end = originalEnd;
          // Cannot pass args of type ResponseEndArgs,
          const returned: http.ServerResponse = safeExecuteInTheMiddle(
            // eslint-disable-next-line prefer-rest-params
            () => response.end.apply(this, arguments as never),
            (error) => {
              if (error) {
                setSpanWithError(span, error);
                instrumentation._closeHttpSpan(span, SpanKind.SERVER, startTime, metricAttributes);
                throw error;
              }
            },
          );
          const targetMethod: string = returned?.req?.['body']?.method ?? url;
          const responseBody: string = returned?.req?.['body'] ?? '';

          if (targetMethod) {
            span.updateName(targetMethod);
          }

          const attributes = {
            [SemanticAttributes.HTTP_STATUS_CODE]: returned.statusCode,
            body: typeof responseBody === 'object' ? JSON.stringify(responseBody) : responseBody,
          };

          metricAttributes = Object.assign(metricAttributes, {
            [SemanticAttributes.HTTP_URL]: targetMethod,
          });

          span.setAttributes(attributes).setStatus({ code: SpanStatusCode.OK });

          instrumentation._closeHttpSpan(span, SpanKind.SERVER, startTime, metricAttributes);

          return returned;
        };

        return safeExecuteInTheMiddle(
          () => Reflect.apply(original, this, [event, ...args]),
          // eslint-disable-next-line sonarjs/no-identical-functions
          (error) => {
            if (error) {
              setSpanWithError(span, error);
              instrumentation._closeHttpSpan(span, SpanKind.SERVER, startTime, metricAttributes);
              throw error;
            }
          },
        );
      });
    };
  }
}

export default GatewayInstrumentation;
