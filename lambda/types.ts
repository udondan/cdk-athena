export enum LogLevel {
  /* eslint-disable @typescript-eslint/naming-convention */
  ERROR,
  WARN,
  INFO,
  DEBUG,
  /* eslint-enable @typescript-eslint/naming-convention */
}

export interface NamedQueryProperties {
  /* eslint-disable @typescript-eslint/naming-convention */
  Name: string;
  Database: string;
  QueryString: string;
  Description?: string;
  WorkGroup?: string;
  LogLevel?: LogLevel;
  /* eslint-enable @typescript-eslint/naming-convention */
}

export interface ConfigurationUpdates {
  /* eslint-disable @typescript-eslint/naming-convention */
  EnforceWorkGroupConfiguration?: boolean;
  PublishCloudWatchMetricsEnabled?: boolean;
  RequesterPaysEnabled?: boolean;
  /* eslint-enable @typescript-eslint/naming-convention */
}

export interface WorkGroupResultConfiguration {
  /* eslint-disable @typescript-eslint/naming-convention */
  OutputLocation?: string;
  EncryptionConfiguration?: {
    EncryptionOption: 'SSE_S3' | 'SSE_KMS' | 'CSE_KMS';
    KmsKey: string;
  };
  /* eslint-enable @typescript-eslint/naming-convention */
}

export interface WorkGroupProperties {
  /* eslint-disable @typescript-eslint/naming-convention */
  Name: string;
  Arn: string;
  Description: string;
  EnforceWorkGroupConfiguration?: 'true' | 'false';
  PublishCloudWatchMetricsEnabled?: 'true' | 'false';
  RequesterPaysEnabled?: 'true' | 'false';
  ResultConfiguration?: WorkGroupResultConfiguration;
  BytesScannedCutoffPerQuery?: string;
  StackName: string;
  Tags: Record<string, string>;
  LogLevel?: LogLevel;
  /* eslint-enable @typescript-eslint/naming-convention */
}
