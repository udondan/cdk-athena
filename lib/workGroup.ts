import {
  Annotations,
  Aws,
  aws_lambda,
  CustomResource,
  ITaggable,
  Lazy,
  Stack,
  StackProps,
  TagManager,
  TagType,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ensureLambda } from './lambda';
import {
  WorkGroupProperties,
  WorkGroupResultConfiguration,
} from '../lambda/types';

export enum EncryptionOption {
  /* eslint-disable @typescript-eslint/naming-convention */
  SSE_S3 = 'SSE_S3',
  SSE_KMS = 'SSE_KMS',
  CSE_KMS = 'CSE_KMS',
  /* eslint-enable @typescript-eslint/naming-convention */
}

// Converts the first letter of the string to lowercase
type CamelCase<S extends string> = S extends `${infer F}${infer R}`
  ? `${Lowercase<F>}${R}`
  : S;

// Recursive conversion of object keys to camelCase by only changing the first letter of each key
type ConvertKeysToCamelCase<T> = T extends unknown[]
  ? { [K in keyof T]: ConvertKeysToCamelCase<T[K]> }
  : T extends object
    ? {
        [K in keyof T as CamelCase<K & string>]: ConvertKeysToCamelCase<T[K]>;
      }
    : T;

const resourceType = 'Custom::Athena-WorkGroup';
const ID = `CFN::Resource::${resourceType}`;
const createdByTag = 'CreatedByCfnCustomResource';

/**
 * Definition of the Athena WorkGroup
 */
export interface WorkGroupProps extends StackProps {
  /**
   * Name of the WorkGroup
   *
   * **This cannot be changed! The name is the primary  and only identifier of the WorkGroup. Changing the name will destroy the WorkGroup and create a new one with the new name.**
   */
  readonly name: string;

  /**
   * Description of the WorkGroup
   */
  readonly desc?: string;

  /**
   * The upper data usage limit (cutoff) for the amount of bytes a single query in a workgroup is allowed to scan.
   *
   * Minimum value of 10000000
   */
  readonly bytesScannedCutoffPerQuery?: number;

  /**
   * If set to `true`, the settings for the workgroup override client-side settings. If set to `false`, client-side settings are used. For more information, see [Workgroup Settings Override Client-Side Settings](https://docs.aws.amazon.com/athena/latest/ug/workgroups-settings-override.html).
   *
   * @default false
   */
  readonly enforceWorkGroupConfiguration?: boolean;

  /**
   * Indicates that the Amazon CloudWatch metrics are enabled for the workgroup.
   *
   * @default false
   */
  readonly publishCloudWatchMetricsEnabled?: boolean;

  /**
   * If set to `true`, allows members assigned to a workgroup to specify Amazon S3 Requester Pays buckets in queries. If set to `false`, workgroup members cannot query data from Requester Pays buckets, and queries that retrieve data from Requester Pays buckets cause an error. The default is `false`. For more information about Requester Pays buckets, see [Requester Pays Buckets](https://docs.aws.amazon.com/AmazonS3/latest/dev/RequesterPaysBuckets.html) in the *Amazon Simple Storage Service Developer Guide*.
   *
   * @default false
   */
  readonly requesterPaysEnabled?: boolean;

  /**
   * The configuration for the workgroup, which includes the location in Amazon S3 where query results are stored and the encryption option, if any, used for query results. To run the query, you must specify the query results location using one of the ways: either in the workgroup using this setting, or for individual queries (client-side), using ResultConfiguration$OutputLocation. If none of them is set, Athena issues an error that no output location is provided. For more information, see [Query results](https://docs.aws.amazon.com/athena/latest/ug/querying.html).
   */
  readonly resultConfiguration?: ConvertKeysToCamelCase<WorkGroupResultConfiguration>;

  ///**
  // * Athena Engine Version
  // *
  // * @default - auto
  // */
  //readonly engineVersion?: number;
}

/**
 * An Athena WorkGroup
 */
export class WorkGroup extends Construct implements ITaggable {
  /**
   * The lambda function that is created
   */
  public readonly lambda: aws_lambda.IFunction;

  /**
   * Name of the WorkGroup
   */
  public readonly name: string = '';

  /**
   * ARN of the WorkGroup
   */
  public readonly arn: string = '';

  /**
   * Resource tags
   */
  public readonly tags: TagManager;

  /**
   * Defines a new Athena WorkGroup
   */
  constructor(scope: Construct, id: string, props: WorkGroupProps) {
    super(scope, id);

    if (
      typeof props.bytesScannedCutoffPerQuery !== 'undefined' &&
      props.bytesScannedCutoffPerQuery < 10000000
    ) {
      Annotations.of(this).addError(
        `Parameter bytesScannedCutoffPerQuery must have value greater than or equal to 10000000. Got ${props.bytesScannedCutoffPerQuery}`,
      );
    }

    if (!props.name.match(/^[a-zA-Z0-9._-]{1,128}$/)) {
      Annotations.of(this).addError(
        `The WorkGroup name must match /^[a-zA-Z0-9._-]{1,128}$/. Got "${props.name}"`,
      );
    }

    this.tags = new TagManager(TagType.MAP, resourceType);
    this.tags.setTag(createdByTag, ID);

    const stack = Stack.of(this);
    this.lambda = ensureLambda(this);
    this.name = props.name;

    const workGroupProperties: WorkGroupProperties = {
      /* eslint-disable @typescript-eslint/naming-convention */
      Name: this.name,
      Description: props.desc ?? '',
      BytesScannedCutoffPerQuery:
        props.bytesScannedCutoffPerQuery?.toString() ?? '',
      EnforceWorkGroupConfiguration: props.enforceWorkGroupConfiguration
        ? 'true'
        : 'false',
      PublishCloudWatchMetricsEnabled: props.publishCloudWatchMetricsEnabled
        ? 'true'
        : 'false',
      RequesterPaysEnabled: props.requesterPaysEnabled ? 'true' : 'false',
      //EngineVersion: props.engineVersion,
      ResultConfiguration: capKeys(
        props.resultConfiguration,
      ) as WorkGroupResultConfiguration,
      StackName: stack.stackName,
      Arn: `arn:aws:athena:${Aws.REGION}:${Aws.ACCOUNT_ID}:workgroup/${this.name}`,
      Tags: Lazy.any({
        produce: () => this.tags.renderTags() as Record<string, string>,
      }) as unknown as Record<string, string>,
      /* eslint-enable @typescript-eslint/naming-convention */
    };

    const workGroup = new CustomResource(
      this,
      `Athena-WorkGroup-${this.name}`,
      {
        serviceToken: this.lambda.functionArn,
        resourceType: resourceType,
        properties: workGroupProperties,
      },
    );

    this.arn = workGroup.getAttString('ARN');
  }
}

function capKeys<T extends { [K in keyof T]: unknown }>(input: T): T {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    let item = value as T;
    if (!!item && item.constructor === Object) {
      item = capKeys<T>(item);
    }
    output[upperFirst(key)] = item;
  }
  return output as T;
}

function upperFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
