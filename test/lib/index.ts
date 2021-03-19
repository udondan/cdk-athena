import kms = require('@aws-cdk/aws-kms');
import s3 = require('@aws-cdk/aws-s3');
import * as cdk from '@aws-cdk/core';

import { EncryptionOption, NamedQuery, WorkGroup } from '../../lib';

export class Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'bucket', {
      encryptionKey: kms.Alias.fromAliasName(this, 'Key', 'aws/s3'),
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
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
          encryptionOption: EncryptionOption.CSE_KMS,
          kmsKey: 'aws/s3',
        },
      },
    });

    cdk.Tags.of(workgroup).add('SomeTag', 'SomeValue');

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
    });

    new cdk.CfnOutput(this, 'WorkGroupArn', {
      value: workgroup.arn,
    });

    new cdk.CfnOutput(this, 'WorkGroupName', {
      value: workgroup.name,
    });

    new cdk.CfnOutput(this, 'QueryId', {
      value: query.id,
    });
  }
}
