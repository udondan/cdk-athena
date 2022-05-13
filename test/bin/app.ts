#!/usr/bin/env node
import cdk = require('aws-cdk-lib');

import { TestStack } from '../lib';

const app = new cdk.App();
new TestStack(app, 'AthenaTestStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
