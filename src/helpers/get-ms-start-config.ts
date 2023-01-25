import type { PartialProps } from '@lomray/client-helpers/interfaces/partial-props';
import type { RequiredOnlyProps } from '@lomray/client-helpers/interfaces/required-props';
import _ from 'lodash';
import type { ICommonConstants } from '@helpers/get-constants';
import GetDbConfig from '@helpers/get-db-config';
import { GetMsOptions, GetMsParams } from '@helpers/get-ms-config';
import type { IStartConfig, IStartConfigWithDb } from '@helpers/launchers';

export type TOverloadMsStartConfigParams<T extends Record<string, any>> = T['DB'] extends Record<
  string,
  any
>
  ? PartialProps<IStartConfigWithDb, 'msOptions' | 'msParams' | 'dbOptions'>
  : PartialProps<IStartConfig, 'msOptions' | 'msParams'>;

/**
 * Get default microservice start config
 */
const getMsStartConfig = <T extends ICommonConstants>(
  CONST: T,
  params: TOverloadMsStartConfigParams<T>,
): TOverloadMsStartConfigParams<T> => {
  const {
    MS_GRAFANA_LOKI_CONFIG,
    IS_ENABLE_GRAFANA_LOG,
    MS_CONSOLE_LOG_LEVEL,
    IS_ENABLE_REMOTE_MIDDLEWARE,
    IS_ENABLE_EVENTS,
    ...OTHER
  } = CONST;

  return _.merge(
    {
      logGrafana: MS_GRAFANA_LOKI_CONFIG || IS_ENABLE_GRAFANA_LOG,
      logConsoleLevel: MS_CONSOLE_LOG_LEVEL,
      remoteMiddleware: {
        isEnable: IS_ENABLE_REMOTE_MIDDLEWARE,
        type: 'client',
      },
      msOptions: GetMsOptions(CONST),
      msParams: GetMsParams(),
      ...(OTHER.DB
        ? {
            // for local run without configuration ms this should be set to false (or use RunConfiguration IDE)
            shouldUseDbRemoteOptions: OTHER.DB.IS_FROM_CONFIG_MS,
            dbOptions: GetDbConfig(CONST as RequiredOnlyProps<ICommonConstants, 'DB'>),
          }
        : {}),
    },
    {
      ...params,
      registerEvents: IS_ENABLE_EVENTS ? params.registerEvents : undefined,
    },
  );
};

export default getMsStartConfig;
