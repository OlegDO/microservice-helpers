import type {
  IGatewayOptions,
  IGatewayParams,
  IMicroserviceOptions,
  IMicroserviceParams,
} from '@lomray/microservice-nodejs-lib';
import { Gateway, Microservice } from '@lomray/microservice-nodejs-lib';
import type { IMiddlewareRepository } from '@lomray/microservice-remote-middleware';
import {
  RemoteMiddlewareClient,
  RemoteMiddlewareServer,
} from '@lomray/microservice-remote-middleware';
import type { ConnectionOptions } from 'typeorm';
import CreateDbConnection from '@helpers/create-db-connection';
import Jobs from '@services/jobs';
import Log from '@services/log';
import type { ILokiTransportOptions } from '@services/log';
import RemoteConfig from '@services/remote-config';

type TRemoteMiddleware = { isEnable?: boolean } & (
  | { type: 'client'; msConfigName?: string }
  | { type: 'server'; getRepository: () => IMiddlewareRepository }
);

export interface IStartConfig {
  type: 'gateway' | 'microservice';
  msOptions: Partial<IGatewayOptions | IMicroserviceOptions>;
  msParams: Partial<IGatewayParams> | IMicroserviceParams;
  registerMethods?: (ms: Microservice | Gateway) => Promise<void> | void;
  registerEvents?: (ms: Microservice | Gateway) => Promise<void> | void;
  registerJobs?: (jobService: Jobs) => Promise<void> | void;
  remoteMiddleware?: TRemoteMiddleware;
  remoteConfig?: { isDisable?: boolean; msConfigName?: string };
  logGrafana?: ILokiTransportOptions | boolean;
  logConsoleLevel?: string;
  hooks?: {
    beforeCreateMicroservice?: () => Promise<void> | void;
    afterCreateMicroservice?: (ms: Microservice | Gateway) => Promise<void> | void;
    afterInitRemoteMiddleware?: () => Promise<void> | void;
    beforeStart?: () => Promise<void> | void;
  };
}

export interface IStartConfigWithDb extends IStartConfig {
  dbOptions: ConnectionOptions;
  shouldUseDbRemoteOptions?: boolean;
}

/**
 * 1. Initialize
 * 2. Start microservice
 */
const start = async ({
  type,
  msOptions,
  msParams,
  registerMethods,
  registerEvents,
  registerJobs,
  remoteMiddleware,
  remoteConfig,
  logGrafana,
  logConsoleLevel,
  hooks: {
    beforeCreateMicroservice,
    afterCreateMicroservice,
    afterInitRemoteMiddleware,
    beforeStart,
  } = {},
}: IStartConfig): Promise<void> => {
  try {
    Log.defaultMeta = {
      ...Log.defaultMeta,
      service: msOptions.name,
      msOptions,
      remoteMiddleware,
    };

    if (logConsoleLevel) {
      Log.setConsoleLogLevel(logConsoleLevel);
    }

    await beforeCreateMicroservice?.();

    const microservice = (type === 'gateway' ? Gateway : Microservice).create(msOptions, msParams);
    const jobsService = Jobs.init(microservice);

    // Enable remote config
    RemoteConfig.init(microservice, {
      msName: msOptions.name as string,
      msConfigName: remoteConfig?.msConfigName || 'configuration',
      isOffline: remoteConfig?.isDisable ?? false,
    });

    // Enable grafana loki transport
    if (logGrafana) {
      // Get options from environment or remote config
      const config =
        typeof logGrafana !== 'boolean'
          ? logGrafana
          : await RemoteConfig.get<ILokiTransportOptions>('grafana-loki', {
              isThrowNotExist: true,
              isCommon: true,
            });

      Log.enableLokiTransport(config);
    }

    await afterCreateMicroservice?.(microservice);
    await registerMethods?.(microservice);
    await registerEvents?.(microservice);
    await registerJobs?.(jobsService);

    // Enable remote middleware (enabled by default)
    if (remoteMiddleware?.isEnable ?? true) {
      // client by default
      if (remoteMiddleware?.type === 'client' || !remoteMiddleware?.type) {
        const rmMiddleware = RemoteMiddlewareClient.create(microservice, {
          logDriver: msParams.logDriver,
          configurationMsName: remoteMiddleware?.msConfigName ?? 'configuration',
        });

        await rmMiddleware.addRegisterEndpoint().obtainMiddlewares();
      } else {
        // server
        const rmMiddleware = RemoteMiddlewareServer.create(
          microservice,
          remoteMiddleware.getRepository(),
          {
            logDriver: msParams.logDriver,
          },
        );

        rmMiddleware.addRegisterEndpoint().addObtainEndpoint();
      }

      await afterInitRemoteMiddleware?.();
    }

    await beforeStart?.();
    await microservice.start();
  } catch (e) {
    Log.error('Failed to start microservice:', e);

    throw e;
  }
};

/**
 * 1. Initialize
 * 2. Create db connection
 * 3. Start microservice
 */
const startWithDb = ({
  dbOptions,
  shouldUseDbRemoteOptions = true,
  ...config
}: IStartConfigWithDb): Promise<void> =>
  start({
    ...config,
    hooks: {
      ...(config.hooks ?? {}),
      afterCreateMicroservice: async (...hookParams) => {
        await CreateDbConnection(dbOptions, shouldUseDbRemoteOptions);
        await config?.hooks?.afterCreateMicroservice?.(...hookParams);
      },
    },
  });

/**
 * Choose launcher depends on params and run microservice
 */
const run = (params: IStartConfig | IStartConfigWithDb): Promise<void> =>
  'dbOptions' in params ? startWithDb(params) : start(params);

export { start, startWithDb, run };
