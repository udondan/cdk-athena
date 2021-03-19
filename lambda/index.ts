import { LambdaEvent, StandardLogger } from 'aws-cloudformation-custom-resource';
import { Callback, Context } from 'aws-lambda';

import { NamedQuery } from './namedQuery';
import { WorkGroup } from './workGroup';

const logger = new StandardLogger();

export const handler = function (
  event: LambdaEvent = {},
  context: Context,
  callback: Callback
) {
  logger.debug('Environment:', JSON.stringify(process.env, null, 2));

  switch (event.ResourceType) {
    case 'Custom::Athena-WorkGroup': {
      WorkGroup(event, context, callback, logger);
      break;
    }
    case 'Custom::Athena-NamedQuery': {
      NamedQuery(event, context, callback, logger);
      break;
    }
    default: {
      callback(`Unhandled resource type: ${event.ResourceType}`);
      break;
    }
  }
};
