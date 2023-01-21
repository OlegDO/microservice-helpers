import { Endpoint } from '@services/endpoint';
import { MicroserviceMeta, MicroserviceMetaOutput } from '@services/microservice-meta';

/**
 * Get microservice metadata
 */
const meta = (version: string) =>
  Endpoint.custom(
    () => ({ output: MicroserviceMetaOutput, description: 'Get microservice metadata' }),
    (_, { app }) => MicroserviceMeta.getMeta(app.getEndpoints(), version),
  );

export default meta;
