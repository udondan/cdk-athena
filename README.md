# CDK Athena WorkGroup

[![Source](https://img.shields.io/badge/Source-GitHub-blue?logo=github)][source]
[![Test](https://github.com/udondan/cdk-athena/workflows/Test/badge.svg)](https://github.com/udondan/cdk-athena/actions?query=workflow%3ATest)
[![GitHub](https://img.shields.io/github/license/udondan/cdk-athena)][license]
[![Docs](https://img.shields.io/badge/awscdk.io-cdk--athena-orange)][docs]

[![npm package](https://img.shields.io/npm/v/cdk-athena?color=brightgreen)][npm]
[![PyPI package](https://img.shields.io/pypi/v/cdk-athena?color=brightgreen)][PyPI]

![Downloads](https://img.shields.io/badge/-DOWNLOADS:-brightgreen?color=gray)
[![npm](https://img.shields.io/npm/dt/cdk-athena?label=npm&color=blueviolet)][npm]
[![PyPI](https://img.shields.io/pypi/dm/cdk-athena?label=pypi&color=blueviolet)][PyPI]

[AWS CDK] L3 construct for managing Athena [WorkGroups] and named queries.

Because I couldn't get [@aws-cdk/aws-athena.CfnWorkGroup](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-athena.CfnWorkGroup.html) to work and [@aws-cdk/custom-resources.AwsCustomResource](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_custom-resources.AwsCustomResource.html) has no support for tags.

## Installation

This package has peer dependencies, which need to be installed along in the expected version.

For TypeScript/NodeJS, add these to your `dependencies` in `package.json`. For Python, add these to your `requirements.txt`:

- cdk-ec2-key-pair
- aws-cdk-lib (^2.0.0)
- constructs (^10.0.0)

## CDK compatibility

- Version 3.x is compatible with the CDK v2.
- Version 2.x is compatible with the CDK v1. There won't be regular updates for this.

## Usage

```typescript
const workgroup = new WorkGroup(this, 'WorkGroup', {
  name: 'TheName', // required
  desc: 'Some description',
  publishCloudWatchMetricsEnabled: true,
  enforceWorkGroupConfiguration: true,
  requesterPaysEnabled: true,
  bytesScannedCutoffPerQuery: 11000000,
  resultConfiguration: {
    outputLocation: `s3://some-bucket/prefix`,
    encryptionConfiguration: {
      encryptionOption: EncryptionOption.SSE_S3,
    },
  },
});

const query = new NamedQuery(this, 'a-query', {
  name: 'A Test Query',
  database: 'audit',
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

cdk.Tag.add(workgroup, 'HelloTag', 'ok');

new cdk.CfnOutput(this, 'WorkGroupArn', {
  value: workgroup.arn,
});

new cdk.CfnOutput(this, 'WorkGroupName', {
  value: workgroup.name,
});

new cdk.CfnOutput(this, 'QueryId', {
  value: query.id,
});
```

   [AWS CDK]: https://aws.amazon.com/cdk/
   [custom CloudFormation resource]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-custom-resources.html
   [WorkGroups]: https://docs.aws.amazon.com/athena/latest/ug/manage-queries-control-costs-with-workgroups.html
   [npm]: https://www.npmjs.com/package/cdk-athena
   [PyPI]: https://pypi.org/project/cdk-athena/
   [docs]: https://awscdk.io/packages/cdk-athena@2.0.0
   [source]: https://github.com/udondan/cdk-athena
   [license]: https://github.com/udondan/cdk-athena/blob/master/LICENSE
