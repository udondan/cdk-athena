import cfn = require('@aws-cdk/aws-cloudformation');
import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import cdk = require('@aws-cdk/core');
import * as statement from 'iam-floyd';
import path = require('path');

export enum EncryptionOption {
  SSE_S3 = 'SSE_S3',
  SSE_KMS = 'SSE_KMS',
  CSE_KMS = 'CSE_KMS',
}

/**
 * Definition of the Athena WorkGroup
 */
export interface WorkGroupProps extends cdk.StackProps {
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
  readonly resultConfiguration?: ResultConfiguration;
}

export interface ResultConfiguration {
  /**
   * The location in Amazon S3 where your query results are stored, such as `s3://path/to/query/bucket/`. To run the query, you must specify the query results location using one of the ways: either for individual queries using either this setting (client-side), or in the workgroup, using WorkGroupConfiguration. If none of them is set, Athena issues an error that no output location is provided. For more information, see [Query results](https://docs.aws.amazon.com/athena/latest/ug/querying.html). If workgroup settings override client-side settings, then the query uses the settings specified for the workgroup.
   */
  readonly outputLocation?: string;

  /**
   * If query results are encrypted in Amazon S3, indicates the encryption option used (for example, `SSE-KMS` or `CSE-KMS`) and key information. This is a client-side setting. If workgroup settings override client-side settings, then the query uses the encryption configuration that is specified for the workgroup, and also uses the location for storing query results specified in the workgroup.
   */
  readonly encryptionConfiguration?: EncryptionConfiguration;
}

export interface EncryptionConfiguration {
  /**
   * Indicates whether Amazon S3 server-side encryption with Amazon S3-managed keys (`SSE-S3`), server-side encryption with KMS-managed keys (`SSE-KMS`), or client-side encryption with KMS-managed keys (`CSE-KMS`) is used.
   *
   * If a query runs in a workgroup and the workgroup overrides client-side settings, then the workgroup's setting for encryption is used. It specifies whether query results must be encrypted, for all queries that run in this workgroup.
   *
   * Possible values include:
   * - `SSE_S3`
   * - `SSE_KMS`
   * - `CSE_KMS`
   */
  readonly encryptionOption: EncryptionOption;

  /**
   * For `SSE-KMS` and `CSE-KMS`, this is the KMS key ARN or ID.
   */
  readonly kmsKey?: string;
}

const resourceType = 'Custom::Athena-WorkGroup';
const ID = `CFN::Resource::${resourceType}`;
const cleanID = ID.replace(/:+/g, '-');
const lambdaTimeout = 3; // minutes

/**
 * An Athena WorkGroup
 */
export class WorkGroup extends cdk.Construct implements cdk.ITaggable {
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
  public readonly tags: cdk.TagManager;

  /**
   * Defines a new Athena WorkGroup
   */
  constructor(scope: cdk.Construct, id: string, props: WorkGroupProps) {
    super(scope, id);

    if (
      typeof props.bytesScannedCutoffPerQuery !== 'undefined' &&
      props.bytesScannedCutoffPerQuery < 10000000
    ) {
      scope.node.addError(
        `Parameter bytesScannedCutoffPerQuery must have value greater than or equal to 10000000. Got ${props.bytesScannedCutoffPerQuery}`
      );
    }

    this.tags = new cdk.TagManager(cdk.TagType.MAP, resourceType);
    this.tags.setTag('CreatedBy', ID);

    const stack = cdk.Stack.of(this);
    const fn = this.ensureLambda();
    this.name = props.name;

    const workGroup = new cfn.CustomResource(
      this,
      `Athena-WorkGroup-${this.name}`,
      {
        provider: cfn.CustomResourceProvider.fromLambda(fn),
        resourceType: resourceType,
        properties: {
          name: this.name,
          description: props.desc || '',
          bytesScannedCutoffPerQuery: props.bytesScannedCutoffPerQuery,
          enforceWorkGroupConfiguration:
            props.enforceWorkGroupConfiguration || false,
          publishCloudWatchMetricsEnabled:
            props.publishCloudWatchMetricsEnabled || false,
          requesterPaysEnabled: props.requesterPaysEnabled || false,
          resultConfiguration: props.resultConfiguration,
          StackName: stack.stackName,
          arn: new statement.Athena()
            .onWorkgroup(this.name, stack.account, stack.region)
            .toJSON().Resource,
          tags: cdk.Lazy.anyValue({
            produce: () => this.tags.renderTags(),
          }),
        },
      }
    );

    this.arn = workGroup.getAttString('ARN');
  }

  private ensureLambda(): lambda.Function {
    const stack = cdk.Stack.of(this);
    const constructName = 'Athena-WorkGroup-Manager-Lambda';
    const existing = stack.node.tryFindChild(constructName);
    if (existing) {
      return existing as lambda.Function;
    }

    const policy = new iam.ManagedPolicy(
      stack,
      'Athena-WorkGroup-Manager-Policy',
      {
        managedPolicyName: `${stack.stackName}-${cleanID}`,
        description: `Used by Lambda ${cleanID}, which is a custom CFN resource, managing Athena WorkGroups`,
        statements: [
          new statement.Athena().allow().getWorkGroup(),
          new statement.Athena()
            .allow()
            .createWorkGroup()
            .tagResource()
            .ifRequestTag('CreatedBy', ID),
          new statement.Athena()
            .allow()
            .deleteWorkGroup()
            .updateWorkGroup()
            .tagResource()
            .untagResource()
            .ifResourceTag('CreatedBy', ID),
        ],
      }
    );

    const role = new iam.Role(stack, 'Athena-WorkGroup-Manager-Role', {
      roleName: `${stack.stackName}-${cleanID}`,
      description: `Used by Lambda ${cleanID}, which is a custom CFN resource, managing Athena WorkGroups`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        policy,
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    const fn = new lambda.Function(stack, constructName, {
      functionName: `${stack.stackName}-${cleanID}`,
      role: role,
      description: 'Custom CFN resource: Manage Athena WorkGroups',
      runtime: lambda.Runtime.NODEJS_10_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/code.zip')),
      timeout: cdk.Duration.minutes(lambdaTimeout),
    });

    return fn;
  }
}
