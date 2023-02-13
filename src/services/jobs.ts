import type {
  AbstractMicroservice,
  IEndpointHandler,
  IEndpointHandlerOptions,
  IEndpoints,
} from '@lomray/microservice-nodejs-lib';
import Log from '@services/log';

/**
 * Jobs manager service
 */
class Jobs {
  /**
   * @private
   */
  protected static instance: Jobs | null = null;

  /**
   * @protected
   */
  protected readonly ms: AbstractMicroservice;

  /**
   * @protected
   */
  protected constructor(ms: AbstractMicroservice) {
    this.ms = ms;
  }

  /**
   * Init service
   */
  public static init(ms: AbstractMicroservice): Jobs {
    if (Jobs.instance === null) {
      Jobs.instance = new Jobs(ms);
    }

    return Jobs.instance;
  }

  /**
   * Return service instance
   */
  public static get(): Jobs {
    if (!Jobs.instance) {
      throw new Error('Call Jobs.init method before try to get service instance.');
    }

    return Jobs.instance;
  }

  /**
   * Get job endpoint name
   * @private
   */
  private getEndpoint(path: string): string {
    return ['job', path].join('.');
  }

  /**
   * Add new job
   */
  public addJobEndpoint<TParams = Record<string, any>, TPayload = Record<string, any>>(
    path: string,
    handler: IEndpointHandler<TParams, TPayload>,
    options: Partial<IEndpointHandlerOptions> = {},
  ): void {
    const method = this.getEndpoint(path);

    if (this.hasJob(method)) {
      Log.warn(`Job with name ${method} already exist. It will be replaced.`);
    }

    this.ms.addEndpoint(method, handler, options);
  }

  /**
   * Remove job endpoint
   */
  public removeJobEndpoint(path: string): void {
    this.ms.removeEndpoint(this.getEndpoint(path));
  }

  /**
   * Get all job endpoints
   */
  public getJobs(): IEndpoints {
    return Object.entries(this.ms.getEndpoints()).reduce(
      (res, [method, params]) => ({
        ...(method.includes('job.') ? { [method]: params } : {}),
        ...res,
      }),
      {},
    );
  }

  /**
   * Has job
   */
  public hasJob(path: string): boolean {
    return (
      this.ms.getEndpoints()[path] !== undefined ||
      this.ms.getEndpoints()[this.getEndpoint(path)] !== undefined
    );
  }
}

export default Jobs;
