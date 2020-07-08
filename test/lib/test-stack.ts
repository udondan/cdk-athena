import kms = require('@aws-cdk/aws-kms');
import s3 = require('@aws-cdk/aws-s3');
import * as cdk from '@aws-cdk/core';

import { EncryptionOption, WorkGroup } from '../../lib';

export class TestStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'bucket', {
      encryptionKey: kms.Alias.fromAliasName(this, 'Key', 'aws/s3'),
    });

    const wg = new WorkGroup(this, 'TestGroup', {
      name: 'Test',
      desc: 'Description of the WorkGroup',
      publishCloudWatchMetricsEnabled: true,
      enforceWorkGroupConfiguration: true,
      requesterPaysEnabled: true,
      bytesScannedCutoffPerQuery: 20000000,
      resultConfiguration: {
        outputLocation: `s3://${bucket.bucketName}/data`,
        encryptionConfiguration: {
          encryptionOption: EncryptionOption.CSE_KMS,
          kmsKey: 'aws/s3',
        },
      },
    });

    cdk.Tag.add(wg, 'HelloTag', 'ok');

    new cdk.CfnOutput(this, 'WorkGroupArn', {
      value: wg.arn,
    });

    new cdk.CfnOutput(this, 'WorkGroupName', {
      value: wg.name,
    });
  }
}
