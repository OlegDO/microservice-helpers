import type { TransformableInfo } from 'logform';
import { createLogger, format, transports } from 'winston';
import LokiTransport from 'winston-loki';
import redact from '@helpers/redact-secrets';

declare module 'winston' {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface Logger {
    enableLokiTransport: (config: ILokiTransportOptions) => void;
  }
}

export type ILokiTransportOptions = ConstructorParameters<typeof LokiTransport>[0];

const secretsFormatter = format((info) => redact(info) as TransformableInfo);

const Log = createLogger({
  level: 'info',
  format: format.json(),
  defaultMeta: {},
  transports: [
    new transports.Console({
      format: format.combine(
        secretsFormatter(),
        format.colorize(),
        format.errors({ stack: true }),
        format.printf((info) => `${info.level} ${info.message}`),
      ),
    }),
  ],
});

/**
 * Add grafana loki transport
 */
Log.enableLokiTransport = (options: ILokiTransportOptions) => {
  const lokiFormat = format((info) => {
    const { message, trace_id: traceId, span_id: spanId, trace_flags: traceFlags } = info;
    const traceInfo = { traceId, spanId, traceFlags };

    // Detect microservice log
    if (message.includes('<--') || message.includes('-->')) {
      const reqType = message.includes('<--') ? 'response' : 'request';
      const [, reqMs, reqBody, , reqTime] =
        /\s([a-z-_]+):\s({.+})(\s\+([0-9.]+)\sms)?/.exec(message) || [];
      let body: Record<string, any> = {};
      let method;
      let id;
      let error;
      let internal;

      try {
        body = JSON.parse(reqBody);
        ({ method, id } = body);
        internal = body.params?.payload?.isInternal;
        error = reqType === 'response' ? Boolean(body.error) : undefined;
      } catch (e) {
        body = { unparsedMsg: message };
      }

      return {
        ...info,
        labels: { type: reqType, ms: reqMs, method, error, internal, ...traceInfo },
        message: JSON.stringify({
          id,
          body,
          method,
          internal,
          reqTime: Number(reqTime) || undefined,
          ...traceInfo,
        }),
      };
    }

    return info;
  });

  const { labels = {}, ...otherOptions } = options;

  Log.add(
    new LokiTransport({
      json: true,
      replaceTimestamp: true,
      labels: { microservice: Log.defaultMeta.service, ...labels },
      format: format.combine(
        secretsFormatter(),
        lokiFormat(),
        format.printf((info) => info.message),
      ),
      ...otherOptions,
    }),
  );
};

export default Log;
