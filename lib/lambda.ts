import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import cdk = require('@aws-cdk/core');
import * as statement from 'cdk-iam-floyd';
import path = require('path');

const lambdaTimeout = cdk.Duration.seconds(10);

export function ensureLambda(scope: cdk.Construct): lambda.Function {
  const stack = cdk.Stack.of(scope);
  const lambdaName = 'AthenaManager';
  const createdByTag = 'CreatedByCfnCustomResource';
  const ID = 'CFN::Resource::Custom::Athena';
  const existing = stack.node.tryFindChild(lambdaName);
  if (existing) {
    return existing as lambda.Function;
  }

  const policy = new iam.ManagedPolicy(stack, 'Athena-Manager-Policy', {
    managedPolicyName: `${stack.stackName}-${lambdaName}`,
    description: `Used by Lambda ${lambdaName}, which is a custom CFN resource, managing Athena resources`,
    statements: [
      new statement.Athena() //
        .allow()
        .toGetWorkGroup(),
      new statement.Athena()
        .allow()
        .toCreateWorkGroup()
        .toTagResource()
        .ifAwsRequestTag(createdByTag, `${ID}-WorkGroup`),
      new statement.Athena()
        .allow()
        .toDeleteWorkGroup()
        .toUpdateWorkGroup()
        .toTagResource()
        .toUntagResource()
        .ifAwsResourceTag(createdByTag, `${ID}-WorkGroup`),
      new statement.Athena()
        .allow()
        .toGetNamedQuery()
        .toListNamedQueries()
        .toCreateNamedQuery()
        .toDeleteNamedQuery(),
    ],
  });

  const role = new iam.Role(stack, 'Athena-Manager-Role', {
    roleName: `${stack.stackName}-${lambdaName}`,
    description: `Used by Lambda ${lambdaName}, which is a custom CFN resource, managing Athena resources`,
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    managedPolicies: [
      policy,
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaBasicExecutionRole'
      ),
    ],
  });

  const fn = new lambda.Function(stack, lambdaName, {
    functionName: `${stack.stackName}-${lambdaName}`,
    role: role,
    description: 'Custom CFN resource: Manage Athena resources',
    runtime: lambda.Runtime.NODEJS_10_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/code.zip')),
    timeout: lambdaTimeout,
  });

  return fn;
}
