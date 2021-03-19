# CDK Athena WorkGroup

[![Source](https://img.shields.io/badge/Source-GitHub-blue?logo=github)][source]
[![Test](https://github.com/udondan/cdk-athena-workgroup/workflows/Test/badge.svg)](https://github.com/udondan/cdk-athena-workgroup/actions?query=workflow%3ATest)
[![GitHub](https://img.shields.io/github/license/udondan/cdk-athena-workgroup)][license]
[![Docs](https://img.shields.io/badge/awscdk.io-cdk--athena--workgroup-orange)][docs]

[![npm package](https://img.shields.io/npm/v/cdk-athena-workgroup?color=brightgreen)][npm]
[![PyPI package](https://img.shields.io/pypi/v/cdk-athena-workgroup?color=brightgreen)][PyPI]
[![NuGet package](https://img.shields.io/nuget/v/CDK.Athena.WorkGroup?color=brightgreen)][NuGet]

![Downloads](https://img.shields.io/badge/-DOWNLOADS:-brightgreen?color=gray)
[![npm](https://img.shields.io/npm/dt/cdk-athena-workgroup?label=npm&color=blueviolet)][npm]
[![PyPI](https://img.shields.io/pypi/dm/cdk-athena-workgroup?label=pypi&color=blueviolet)][PyPI]
[![NuGet](https://img.shields.io/nuget/dt/CDK.Athena.WorkGroup?label=nuget&color=blueviolet)][NuGet]

[AWS CDK] L3 construct for managing [WorkGroups] and named queries.

Because I couldn't get [@aws-cdk/aws-athena.CfnWorkGroup](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_aws-athena.CfnWorkGroup.html) to work and [@aws-cdk/custom-resources.AwsCustomResource](https://docs.aws.amazon.com/cdk/api/latest/docs/@aws-cdk_custom-resources.AwsCustomResource.html) has no support for tags.

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

cdk.Tag.add(wg, 'HelloTag', 'ok');

new cdk.CfnOutput(this, 'WorkGroupArn', {
  value: wg.arn,
});

new cdk.CfnOutput(this, 'WorkGroupName', {
  value: wg.name,
});

new cdk.CfnOutput(this, 'QueryId', {
  value: query.id,
});
```

   [AWS CDK]: https://aws.amazon.com/cdk/
   [custom CloudFormation resource]: https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/template-custom-resources.html
   [WorkGroups]: https://docs.aws.amazon.com/athena/latest/ug/manage-queries-control-costs-with-workgroups.html
   [npm]: https://www.npmjs.com/package/cdk-athena-workgroup
   [PyPI]: https://pypi.org/project/cdk-athena-workgroup/
   [NuGet]: https://www.nuget.org/packages/CDK.Athena.WorkGroup/
   [docs]: https://awscdk.io/packages/cdk-athena-workgroup@1.0.0
   [source]: https://github.com/udondan/cdk-athena-workgroup
   [license]: https://github.com/udondan/cdk-athena-workgroup/blob/master/LICENSE
