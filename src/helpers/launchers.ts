import type {
  IGatewayOptions,
  IGatewayParams,
  IMicroserviceOptions,
  IMicroserviceParams,
  ISocketOptions,
  ISocketParams,
} from '@lomray/microservice-nodejs-lib';
import { Gateway, Microservice, Socket } from '@lomray/microservice-nodejs-lib';
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
  type: 'gateway' | 'microservice' | 'socket';
  msOptions: Partial<IGatewayOptions | IMicroserviceOptions | ISocketOptions>;
  msParams: Partial<IGatewayParams | IMicroserviceParams | ISocketParams>;
  registerMethods?: (ms: Microservice | Gateway | Socket) => Promise<void> | void;
  registerEvents?: (ms: Microservice | Gateway | Socket) => Promise<void> | void;
  registerJobs?: (jobService: Jobs) => Promise<void> | void;
  remoteMiddleware?: TRemoteMiddleware;
  remoteConfig?: { isDisable?: boolean; msConfigName?: string };
  logGrafana?: ILokiTransportOptions | boolean;
  logConsoleLevel?: string;
  hooks?: {
    beforeCreateMicroservice?: () => Promise<void> | void;
    afterCreateMicroservice?: (ms: Microservice | Gateway | Socket) => Promise<void> | void;
    afterInitRemoteMiddleware?: () => Promise<void> | void;
    beforeStart?: () => Promise<void> | void;
  };
}

export interface IStartConfigWithDb extends IStartConfig {
  dbOptions: ConnectionOptions;
  shouldUseDbRemoteOptions?: boolean;
}

export type IStartConfigSocket<T = IStartConfig | IStartConfigWithDb> = {
  registerRooms?: (ms: Socket) => Promise<void> | void;
} & T;

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

    const microservice = (
      type === 'gateway' ? Gateway : type === 'socket' ? Socket : Microservice
    ).create(msOptions, msParams);

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
    await registerJobs?.(Jobs.init(microservice));

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
 * Return start config with DB initialization
 */
const withDbConfig = ({
  dbOptions,
  shouldUseDbRemoteOptions = true,
  ...config
}: IStartConfigWithDb): IStartConfig => ({
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
 * Return start config with register socket rooms
 */
const withSocketConfig = ({ registerRooms, ...config }: IStartConfigSocket): IStartConfig => ({
  ...config,
  hooks: {
    ...(config.hooks ?? {}),
    afterCreateMicroservice: async (...hookParams) => {
      await registerRooms?.(hookParams[0] as Socket);
      await config?.hooks?.afterCreateMicroservice?.(...hookParams);
    },
  },
});

/**
 * Choose launcher depends on params and run microservice
 */
const run = (params: IStartConfig | IStartConfigWithDb | IStartConfigSocket): Promise<void> => {
  let config = params;

  if (params.type === 'socket') {
    config = withSocketConfig(config);
  }

  if ('dbOptions' in config) {
    config = withDbConfig(config);
  }

  return start(config);
};

export { withDbConfig, withSocketConfig, start, run };
