import iam = require('@aws-cdk/aws-iam');
import lambda = require('@aws-cdk/aws-lambda');
import cdk = require('@aws-cdk/core');
import path = require('path');

const lambdaTimeout = cdk.Duration.seconds(10);

export function ensureLambda(scope: cdk.Construct): lambda.Function {
  const stack = cdk.Stack.of(scope);
  const lambdaName = 'AthenaManager';
  const ID = 'CFN::Resource::Custom::Athena';
  const existing = stack.node.tryFindChild(lambdaName);
  if (existing) {
    return existing as lambda.Function;
  }

  const policy = new iam.ManagedPolicy(stack, 'Athena-Manager-Policy', {
    managedPolicyName: `${stack.stackName}-${lambdaName}`,
    description: `Used by Lambda ${lambdaName}, which is a custom CFN resource, managing Athena resources`,
    statements: [
      new iam.PolicyStatement({
        actions: ['athena:GetWorkGroup'],
        resources: ['*'],
      }),
      new iam.PolicyStatement({
        actions: ['athena:CreateWorkGroup', 'athena:TagResource'],
        resources: ['*'],
        conditions: {
          StringLike: {
            'aws:RequestTag/CreatedByCfnCustomResource': `${ID}-WorkGroup`,
          },
        },
      }),
      new iam.PolicyStatement({
        actions: [
          'athena:DeleteWorkGroup',
          'athena:TagResource',
          'athena:UntagResource',
          'athena:UpdateWorkGroup',
        ],
        resources: ['*'],
        conditions: {
          StringLike: {
            'aws:ResourceTag/CreatedByCfnCustomResource': `${ID}-WorkGroup`,
          },
        },
      }),
      new iam.PolicyStatement({
        actions: [
          'athena:CreateNamedQuery',
          'athena:DeleteNamedQuery',
          'athena:GetNamedQuery',
          'athena:ListNamedQueries',
        ],
        resources: ['*'],
      }),
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
    runtime: lambda.Runtime.NODEJS_14_X,
    handler: 'index.handler',
    code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/code.zip')),
    timeout: lambdaTimeout,
  });

  return fn;
}
