export interface IAwsConfig {
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  s3?: {
    bucketName?: string;
    bucketAcl?: string;
  };
}
