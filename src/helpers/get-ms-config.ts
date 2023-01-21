import type { IMicroserviceOptions, IMicroserviceParams } from '@lomray/microservice-nodejs-lib';
import { ConsoleLogDriver, LogType } from '@lomray/microservice-nodejs-lib';
import type { ICommonConstants } from '@helpers/get-constants';
import Log from '@services/log';

/**
 * Get default microservice options
 */
const GetMsOptions = ({
  MS_NAME,
  MS_CONNECTION,
  IS_CONNECTION_SRV,
  MS_WORKERS,
  VERSION,
}: ICommonConstants): Partial<IMicroserviceOptions> => ({
  name: MS_NAME,
  connection: MS_CONNECTION,
  isSRV: IS_CONNECTION_SRV,
  workers: MS_WORKERS,
  version: VERSION,
});

/**
 * Get default microservice params
 */
const GetMsParams = (): Partial<IMicroserviceParams> => ({
  logDriver: ConsoleLogDriver((message, { type }) =>
    Log.log(type === LogType.ERROR ? 'error' : 'info', message),
  ),
});

export { GetMsOptions, GetMsParams };
