import type { ClassReturn } from '@lomray/client-helpers/interfaces/class-return';
import { Microservice } from '@lomray/microservice-nodejs-lib';
import type { AbstractMicroservice } from '@lomray/microservice-nodejs-lib';
import ApiClientBackend from '@lomray/microservices-client-api/api-client-backend';
import Endpoints from '@lomray/microservices-client-api/endpoints';

export interface IApiParams {
  endpoints: Endpoints<Endpoints, ApiClientBackend>;
}

/**
 * Service for make requests to another microservices
 * This service can generate automatically (in future)
 */
class Api {
  /**
   * @private
   */
  private static instance: IApiParams['endpoints'] | null = null;

  /**
   * Get api client
   */
  static get(): IApiParams['endpoints'] {
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
    endpoints: ClassReturn<IApiParams['endpoints']> = Endpoints,
  ): void {
    if (Api.instance !== null) {
      return;
    }

    const apiClient = new ApiClientBackend(ms || Microservice.getInstance());

    Api.instance = new endpoints(apiClient);
  }
}

export default Api;
