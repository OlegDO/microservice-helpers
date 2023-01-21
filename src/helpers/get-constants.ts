export interface ICustomEnv {
  IS_BUILD?: string | boolean;
  MS_NAME_DEFAULT: string;
  VERSION: string;
}

/**
 * Get common microservices constants
 * @constructor
 */
const GetConstants = ({ MS_NAME_DEFAULT, VERSION, IS_BUILD = false }: ICustomEnv) => ({
  IS_BUILD,
  VERSION,
  ENV: process.env.NODE_ENV || 'development',
  IS_PROD: process.env.NODE_ENV === 'production',
  IS_DEV: process.env.NODE_ENV === 'development',
  IS_TEST: process.env.NODE_ENV === 'tests',
  ENVIRONMENT: process.env.ENVIRONMENT || 'prod',
  SRC_FOLDER: IS_BUILD ? 'lib' : 'src',
  MS_NAME: process.env.MS_NAME || MS_NAME_DEFAULT,
  MS_CONFIG_NAME: process.env.MS_CONFIG_NAME || 'configuration',
  MS_CONNECTION: process.env.MS_CONNECTION,
  MS_CONNECTION_SRV: Boolean(process.env.MS_CONNECTION_SRV ?? false),
  MS_WORKERS: Number(process.env.MS_WORKERS) || 5,
  MS_ENABLE_REMOTE_MIDDLEWARE: Number(process.env.MS_ENABLE_REMOTE_MIDDLEWARE ?? 1),
  MS_REMOTE_CONFIG: Number(process.env.MS_REMOTE_CONFIG || 1),
  MS_ENABLE_GRAFANA_LOG: Number(process.env.MS_ENABLE_GRAFANA_LOG || 0),
  MS_GRAFANA_LOKI_CONFIG: JSON.parse(process.env.MS_GRAFANA_LOKI_CONFIG || 'null'),
  MS_OPENTELEMETRY_ENABLE: Number(process.env.MS_OPENTELEMETRY_ENABLE || 0),
  MS_OPENTELEMETRY_OTLP_URL: process.env.MS_OPENTELEMETRY_OTLP_URL,
  MS_OPENTELEMETRY_OTLP_URL_SRV: Number(process.env.MS_OPENTELEMETRY_OTLP_URL_SRV || 0),
  MS_OPENTELEMETRY_DEBUG: Number(process.env.MS_OPENTELEMETRY_DEBUG || 0),
  MS_CONSOLE_LOG_LEVEL: process.env.MS_CONSOLE_LOG_LEVEL || 'info',
  DB_ENV: {
    URL: process.env.DB_URL,
    HOST: process.env.DB_HOST || '127.0.0.1',
    PORT: Number(process.env.DB_PORT) || 5432,
    USERNAME: process.env.DB_USERNAME || 'postgres',
    PASSWORD: process.env.DB_PASSWORD || 'example',
    DATABASE: process.env.DB_DATABASE || `ms-${process.env.MS_NAME || MS_NAME_DEFAULT}`,
  },
});

export type ICommonConstants = ReturnType<typeof GetConstants>;

export default GetConstants;
