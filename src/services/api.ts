import { AbstractMicroservice, Microservice } from '@lomray/microservice-nodejs-lib';
import ApiClientBackend from '@lomray/microservices-client-api/api-client-backend';
import Endpoints from '@lomray/microservices-client-api/endpoints';

type TEndpoints = Endpoints<Endpoints, ApiClientBackend>;

/**
 * Service for make requests to another microservices
 * This service can generate automatically (in future)
 */
class Api {
  /**
   * @private
   */
  private static instance: TEndpoints | null = null;

  /**
   * @private
   */
  private static ms: AbstractMicroservice;

  /**
   * Get api client
   */
  static get(): TEndpoints {
    if (Api.instance === null) {
      const apiClient = new ApiClientBackend(Api.ms || Microservice.getInstance());

      Api.instance = new Endpoints(apiClient);
    }

    return Api.instance;
  }

  /**
   * Init client
   */
  static init(ms: AbstractMicroservice): void {
    Api.ms = ms;
  }
}

export default Api;
