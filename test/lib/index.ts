import {
  aws_kms,
  aws_s3,
  CfnOutput,
  RemovalPolicy,
  Stack,
  StackProps,
  Tags,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { EncryptionOption, LogLevel, NamedQuery, WorkGroup } from '../../lib';

export class TestStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bucket = new aws_s3.Bucket(this, 'bucket', {
      encryptionKey: aws_kms.Alias.fromAliasName(this, 'Key', 'aws/s3'),
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const workgroup = new WorkGroup(this, 'TestGroup', {
      name: 'Test',
      desc: 'Description of the WorkGroup',
      publishCloudWatchMetricsEnabled: true,
      enforceWorkGroupConfiguration: true,
      requesterPaysEnabled: true,
      bytesScannedCutoffPerQuery: 20000000,
      //engineVersion: 2,
      resultConfiguration: {
        outputLocation: `s3://${bucket.bucketName}/data`,
        encryptionConfiguration: {
          encryptionOption: EncryptionOption.SSE_KMS,
          kmsKey: 'aws/s3',
        },
      },
      logLevel: LogLevel.DEBUG,
    });

    Tags.of(workgroup).add('SomeTag', 'SomeValue');

    const query = new NamedQuery(this, 'a-query', {
      name: 'A Test Query',
      database: 'some-database',
      desc: 'This is the description',
      queryString: `
        SELECT
          count(*) AS assumed,
          split(useridentity.principalid, ':')[2] AS user,
          resources[1].arn AS role
        FROM cloudtrail_logs
        WHERE
          eventname='AssumeRole' AND
          useridentity.principalid is NOT NULL AND
          useridentity.principalid LIKE '%@%'
        GROUP BY
          split(useridentity.principalid,':')[2],
          resources[1].arn
      `,
      workGroup: workgroup,
      logLevel: LogLevel.DEBUG,
    });

    new CfnOutput(this, 'WorkGroupArn', {
      value: workgroup.arn,
    });

    new CfnOutput(this, 'WorkGroupName', {
      value: workgroup.name,
    });

    new CfnOutput(this, 'QueryId', {
      value: query.id,
    });
  }
}
