import type { RequiredOnlyProps } from '@lomray/client-helpers/interfaces/required-props';
import _ from 'lodash';
import type { ICommonConstants } from '@helpers/get-constants';
import type { IAwsConfig } from '@interfaces/aws-config';
import RemoteConfig from '@services/remote-config';

/**
 * Get AWS config
 */
const aws = async ({ AWS }: RequiredOnlyProps<ICommonConstants, 'AWS'>): Promise<IAwsConfig> => {
  const conf = AWS.IS_FROM_CONFIG_MS
    ? await RemoteConfig.get<IAwsConfig>('aws', {
        isCommon: true,
      })
    : {};
  const defaultConfig: IAwsConfig = {
    accessKeyId: AWS.ACCESS_KEY_ID,
    secretAccessKey: AWS.SECRET_ACCESS_KEY,
    region: AWS.REGION,
    s3: {
      bucketName: AWS.BUCKET_NAME,
      bucketAcl: AWS.BUCKET_ACL,
    },
  };

  return _.merge(defaultConfig, conf ?? {});
};

export default aws;
