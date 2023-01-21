import _ from 'lodash';
import type { ICommonConstants } from '@helpers/get-constants';
import type { IStartConfig, IStartConfigWithDb } from '@helpers/launchers';

export type TOverloadMsStartConfigParams<T extends Record<string, any>> = T['DB'] extends Record<
  string,
  any
>
  ? IStartConfigWithDb
  : IStartConfig;

/**
 * Get default microservice start config
 */
const getMsStartConfig = <T extends ICommonConstants>(
  {
    MS_GRAFANA_LOKI_CONFIG,
    IS_ENABLE_GRAFANA_LOG,
    MS_CONSOLE_LOG_LEVEL,
    IS_ENABLE_REMOTE_MIDDLEWARE,
    IS_ENABLE_EVENTS,
    ...OTHER
  }: T,
  params: TOverloadMsStartConfigParams<T>,
): TOverloadMsStartConfigParams<T> =>
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

export default getMsStartConfig;
