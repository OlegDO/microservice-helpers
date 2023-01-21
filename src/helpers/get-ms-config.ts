import _ from 'lodash';
import type { ICommonConstants } from '@helpers/get-constants';
import type { IStartConfig, IStartConfigWithDb } from '@helpers/launchers';

export type TOverloadMsConfigParams<T extends ICommonConstants> = T['DB'] extends undefined
  ? IStartConfig
  : IStartConfigWithDb;

/**
 * Get default microservice config
 */
const getMsConfig = <T extends ICommonConstants>(
  {
    MS_GRAFANA_LOKI_CONFIG,
    IS_ENABLE_GRAFANA_LOG,
    MS_CONSOLE_LOG_LEVEL,
    IS_ENABLE_REMOTE_MIDDLEWARE,
    IS_ENABLE_EVENTS,
    ...OTHER
  }: T,
  params: TOverloadMsConfigParams<T>,
): TOverloadMsConfigParams<T> =>
  _.merge(
    {
      logGrafana: MS_GRAFANA_LOKI_CONFIG || IS_ENABLE_GRAFANA_LOG,
      logConsoleLevel: MS_CONSOLE_LOG_LEVEL,
      remoteMiddleware: {
        isEnable: IS_ENABLE_REMOTE_MIDDLEWARE,
        type: 'client',
      },
      ...(OTHER.DB
        ? {
            // for local run without configuration ms this should be set to false (or use RunConfiguration IDE)
            shouldUseDbRemoteOptions: OTHER.DB.IS_FROM_CONFIG_MS,
          }
        : {}),
    },
    {
      ...params,
      registerEvents: IS_ENABLE_EVENTS ? params.registerEvents : undefined,
    },
  );

export default getMsConfig;
