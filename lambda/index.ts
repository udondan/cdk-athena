import {
  Context,
  Callback,
  Event,
  StandardLogger,
  LogLevel,
} from 'aws-cloudformation-custom-resource';
import { namedQuery } from './namedQuery';
import { workGroup } from './workGroup';
import { NamedQueryProperties, WorkGroupProperties } from './types';

export const handler = function (
  event: Event<NamedQueryProperties | WorkGroupProperties>,
  context: Context,
  callback: Callback,
) {
  const logger = event.ResourceProperties.LogLevel
    ? new StandardLogger(
        // because jsii is forcing us to expose enums with all capitals and the enum in aws-cloudformation-custom-resource is all lowercase, we need to cast here. Other than the capitalization, the enums are identical
        event.ResourceProperties.LogLevel as unknown as LogLevel,
      )
    : new StandardLogger();

  logger.debug('Environment:', JSON.stringify(process.env, null, 2));

  switch (event.ResourceType) {
    case 'Custom::Athena-WorkGroup': {
      workGroup(event as Event<WorkGroupProperties>, context, callback, logger);
      break;
    }
    case 'Custom::Athena-NamedQuery': {
      namedQuery(
        event as Event<NamedQueryProperties>,
        context,
        callback,
        logger,
      );
      break;
    }
    default: {
      callback(`Unhandled resource type: ${event.ResourceType as string}`);
      break;
    }
  }
};
