import { aws_iam, aws_lambda, Duration, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import path = require('path');

const lambdaTimeout = Duration.seconds(10);

export function ensureLambda(scope: Construct): aws_lambda.Function {
  const stack = Stack.of(scope);
  const lambdaName = 'AthenaManager';
  const ID = 'CFN::Resource::Custom::Athena';
  const existing = stack.node.tryFindChild(lambdaName);
  if (existing) {
    return existing as aws_lambda.Function;
  }

  const policy = new aws_iam.ManagedPolicy(stack, 'Athena-Manager-Policy', {
    managedPolicyName: `${stack.stackName}-${lambdaName}`,
    description: `Used by Lambda ${lambdaName}, which is a custom CFN resource, managing Athena resources`,
    statements: [
      new aws_iam.PolicyStatement({
        actions: ['athena:GetWorkGroup'],
        resources: ['*'],
      }),
      new aws_iam.PolicyStatement({
        actions: ['athena:CreateWorkGroup', 'athena:TagResource'],
        resources: ['*'],
        conditions: {
          StringLike: {
            'aws:RequestTag/CreatedByCfnCustomResource': `${ID}-WorkGroup`,
          },
        },
      }),
      new aws_iam.PolicyStatement({
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
      new aws_iam.PolicyStatement({
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

  const role = new aws_iam.Role(stack, 'Athena-Manager-Role', {
    roleName: `${stack.stackName}-${lambdaName}`,
    description: `Used by Lambda ${lambdaName}, which is a custom CFN resource, managing Athena resources`,
    assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
    managedPolicies: [
      policy,
      aws_iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaBasicExecutionRole'
      ),
    ],
  });

  const fn = new aws_lambda.Function(stack, lambdaName, {
    functionName: `${stack.stackName}-${lambdaName}`,
    role: role,
    description: 'Custom CFN resource: Manage Athena resources',
    runtime: aws_lambda.Runtime.NODEJS_20_X,
    handler: 'index.handler',
    code: aws_lambda.Code.fromAsset(path.join(__dirname, '../lambda/code.zip')),
    timeout: lambdaTimeout,
  });

  return fn;
}
