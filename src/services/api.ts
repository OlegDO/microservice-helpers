import type { ClassReturn } from '@lomray/client-helpers/interfaces/class-return';
import { Microservice } from '@lomray/microservice-nodejs-lib';
import type { AbstractMicroservice } from '@lomray/microservice-nodejs-lib';
import ApiClientBackend from '@lomray/microservices-client-api/api-client-backend';
import Endpoints from '@lomray/microservices-client-api/endpoints';

export interface IApiParams {
  endpoints: Endpoints<Endpoints, ApiClientBackend>;
}

type PropTypeIfExist<T extends { endpoints: any }> = T extends {
  extendEndpoints: infer CustomEndpoints;
}
  ? CustomEndpoints
  : T['endpoints'];

/**
 * Service for make requests to another microservices
 * This service can generate automatically (in future)
 */
class Api {
  /**
   * @private
   */
  private static instance: PropTypeIfExist<IApiParams> | null = null;

  /**
   * Get api client
   */
  static get(): PropTypeIfExist<IApiParams> {
    if (Api.instance === null) {
      Api.init();
    }

    return Api.instance!;
  }

  /**
   * Init client
   */
  static init(
    ms?: AbstractMicroservice,
    endpoints: ClassReturn<PropTypeIfExist<IApiParams>> = Endpoints,
  ): void {
    if (Api.instance !== null) {
      return;
    }

    const apiClient = new ApiClientBackend(ms || Microservice.getInstance());

    Api.instance = new endpoints(apiClient);
  }
}

export default Api;
