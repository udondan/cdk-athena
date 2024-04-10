import {
  Context,
  Callback,
  CustomResource,
  Event,
  Logger,
} from 'aws-cloudformation-custom-resource';
import {
  AthenaClient,
  CreateWorkGroupCommand,
  CreateWorkGroupCommandInput,
  TagResourceCommand,
  TagResourceCommandInput,
  Tag,
  UntagResourceCommand,
  UntagResourceCommandInput,
  GetWorkGroupCommand,
  GetWorkGroupCommandInput,
  GetWorkGroupCommandOutput,
  DeleteWorkGroupCommand,
  DeleteWorkGroupCommandInput,
  UpdateWorkGroupCommand,
  UpdateWorkGroupCommandInput,
  ResultConfigurationUpdates,
} from '@aws-sdk/client-athena';
import { WorkGroupProperties } from './types';

const athenaClient = new AthenaClient({});

export function workGroup(
  event: Event<WorkGroupProperties>,
  context: Context,
  callback: Callback,
  logger: Logger,
) {
  const resource = new CustomResource<WorkGroupProperties>(
    event,
    context,
    callback,
    createResource,
    updateResource,
    deleteResource,
  );

  resource.addResponseValue('ARN', resource.properties.Arn.value);

  resource.setLogger(logger);
}

async function createResource(
  resource: CustomResource<WorkGroupProperties>,
  log: Logger,
): Promise<void> {
  log.info(
    `Attempting to create Athena WorkGroup ${resource.properties.Name.value}`,
  );

  const params: CreateWorkGroupCommandInput = {
    /* eslint-disable @typescript-eslint/naming-convention */
    Name: resource.properties.Name.value,
    Description: resource.properties.Description.value,
    Configuration: {
      EnforceWorkGroupConfiguration:
        resource.properties.EnforceWorkGroupConfiguration?.value == 'true',
      PublishCloudWatchMetricsEnabled:
        resource.properties.PublishCloudWatchMetricsEnabled?.value == 'true',
      RequesterPaysEnabled:
        resource.properties.RequesterPaysEnabled?.value == 'true',
    },
    Tags: makeTags(resource, resource.properties.Tags.value),
    /* eslint-enable @typescript-eslint/naming-convention */
  };

  if (resource.properties.ResultConfiguration) {
    params.Configuration!.ResultConfiguration =
      resource.properties.ResultConfiguration.value!;
  }

  if (
    typeof resource.properties.BytesScannedCutoffPerQuery?.value !== 'undefined'
  ) {
    params.Configuration!.BytesScannedCutoffPerQuery = parseInt(
      resource.properties.BytesScannedCutoffPerQuery.value,
    );
  }

  log.debug('Sending payload', JSON.stringify(params, null, 2));

  const result = await athenaClient.send(new CreateWorkGroupCommand(params));
  log.debug(JSON.stringify(result, null, 2));
}

async function updateResource(
  resource: CustomResource<WorkGroupProperties>,
  log: Logger,
): Promise<void> {
  await updateWorkGroup(resource, log);
  await updateWorkGroupAddTags(resource, log);
  await updateWorkGroupRemoveTags(resource, log);
}

async function getWorkGroup(
  name: string,
  log: Logger,
): Promise<GetWorkGroupCommandOutput> {
  log.info(`Fetching details of Athena WorkGroup ${name}`);

  const params: GetWorkGroupCommandInput = {
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    WorkGroup: name,
  };

  log.debug('Sending payload', JSON.stringify(params, null, 2));

  const result = await athenaClient.send(new GetWorkGroupCommand(params));
  return result;
}

async function updateWorkGroup(
  resource: CustomResource<WorkGroupProperties>,
  log: Logger,
): Promise<void> {
  log.info(
    `Attempting to update Athena WorkGroup ${resource.properties.Name.value}`,
  );

  const current = await getWorkGroup(resource.properties.Name.value, log);

  log.debug('Current WorkGroup', JSON.stringify(current, null, 2));

  const params: UpdateWorkGroupCommandInput = {
    /* eslint-disable @typescript-eslint/naming-convention */
    WorkGroup: resource.properties.Name.value,
    Description: resource.properties.Description.value,
    ConfigurationUpdates: {
      EnforceWorkGroupConfiguration:
        resource.properties.EnforceWorkGroupConfiguration?.value == 'true',
      PublishCloudWatchMetricsEnabled:
        resource.properties.PublishCloudWatchMetricsEnabled?.value == 'true',
      RequesterPaysEnabled:
        resource.properties.RequesterPaysEnabled?.value == 'true',
      /* eslint-enable @typescript-eslint/naming-convention */
    },
  };

  const hasOutputLocation =
    !!current.WorkGroup?.Configuration?.ResultConfiguration?.OutputLocation;

  const hasEncryptionConfiguration =
    !!current.WorkGroup?.Configuration?.ResultConfiguration
      ?.EncryptionConfiguration;

  const hasBytesScannedCutoffPerQuery =
    !!current.WorkGroup?.Configuration?.BytesScannedCutoffPerQuery;

  if (resource.properties.BytesScannedCutoffPerQuery) {
    params.ConfigurationUpdates!.BytesScannedCutoffPerQuery = parseInt(
      resource.properties.BytesScannedCutoffPerQuery.value!,
    );
  } else if (
    hasBytesScannedCutoffPerQuery &&
    !resource.properties.BytesScannedCutoffPerQuery
  ) {
    params.ConfigurationUpdates!.RemoveBytesScannedCutoffPerQuery = true;
  }

  if (resource.properties.ResultConfiguration?.value) {
    const resultConfig: ResultConfigurationUpdates =
      resource.properties.ResultConfiguration?.value;

    if (hasEncryptionConfiguration && !resultConfig.EncryptionConfiguration) {
      resultConfig.RemoveEncryptionConfiguration = true;
    }

    if (hasOutputLocation && !resultConfig.OutputLocation) {
      resultConfig.RemoveOutputLocation = true;
    }

    params.ConfigurationUpdates!.ResultConfigurationUpdates = resultConfig;
  }

  log.debug('Sending payload', JSON.stringify(params, null, 2));

  await athenaClient.send(new UpdateWorkGroupCommand(params));
}

async function updateWorkGroupAddTags(
  resource: CustomResource<WorkGroupProperties>,
  log: Logger,
): Promise<void> {
  log.info(
    `Attempting to update tags for Athena WorkGroup ${resource.properties.Name.value}`,
  );

  if (!resource.properties.Tags.changed) {
    log.info(
      `No changes of tags detected for WorkGroup ${resource.properties.Name.value}. Not attempting any update`,
    );
    return;
  }

  const newTags = makeTags(resource, resource.properties.Tags.value);

  const params: TagResourceCommandInput = {
    /* eslint-disable @typescript-eslint/naming-convention */
    ResourceARN: resource.properties.Arn.value,
    Tags: newTags,
    /* eslint-enable @typescript-eslint/naming-convention */
  };

  log.debug('Sending payload', JSON.stringify(params, null, 2));

  await athenaClient.send(new TagResourceCommand(params));
}

async function updateWorkGroupRemoveTags(
  resource: CustomResource<WorkGroupProperties>,
  log: Logger,
): Promise<void> {
  log.info(
    `Attempting to remove some tags for Athena WorkGroup ${resource.properties.Name.value}`,
  );

  if (!resource.properties.Tags.changed) {
    log.info(
      `No changes of tags detected for WorkGroup ${resource.properties.Name.value}. Not attempting any update`,
    );
    return;
  }

  const oldTags = makeTags(resource, resource.properties.Tags.before);
  const newTags = makeTags(resource, resource.properties.Tags.value);
  const tagsToRemove = getMissingTags(oldTags, newTags);
  if (!tagsToRemove.length) {
    log.info('No tags to remove');
    return;
  }

  log.info(`Will remove the following tags: ${JSON.stringify(tagsToRemove)}`);

  const params: UntagResourceCommandInput = {
    /* eslint-disable @typescript-eslint/naming-convention */
    ResourceARN: resource.properties.Arn.value,
    TagKeys: tagsToRemove,
    /* eslint-enable @typescript-eslint/naming-convention */
  };

  log.debug('Sending payload', JSON.stringify(params, null, 2));

  await athenaClient.send(new UntagResourceCommand(params));
}

async function deleteResource(
  resource: CustomResource<WorkGroupProperties>,
  log: Logger,
): Promise<void> {
  log.info(
    `Attempting to delete Athena WorkGroup ${resource.properties.Name.value}`,
  );

  const params: DeleteWorkGroupCommandInput = {
    /* eslint-disable @typescript-eslint/naming-convention */
    WorkGroup: resource.properties.Name.value,
    RecursiveDeleteOption: true,
    /* eslint-enable @typescript-eslint/naming-convention */
  };

  log.debug('Sending payload', JSON.stringify(params, null, 2));

  await athenaClient.send(new DeleteWorkGroupCommand(params));
}

function makeTags(
  resource: CustomResource<WorkGroupProperties>,
  eventTags?: Record<string, string>,
): Tag[] {
  const tags: Tag[] = [
    /* eslint-disable @typescript-eslint/naming-convention */
    {
      Key: 'aws-cloudformation:stack-id',
      Value: resource.event.StackId,
    },
    {
      Key: 'aws-cloudformation:stack-name',
      Value: resource.properties.StackName.value,
    },
    {
      Key: 'aws-cloudformation:logical-id',
      Value: resource.event.LogicalResourceId,
    },
    /* eslint-enable @typescript-eslint/naming-convention */
  ];
  if (eventTags && Object.keys(eventTags).length) {
    Object.keys(eventTags).forEach(function (key: string) {
      tags.push({
        /* eslint-disable @typescript-eslint/naming-convention */
        Key: key,
        Value: eventTags[key],
        /* eslint-enable @typescript-eslint/naming-convention */
      });
    });
  }
  return tags;
}

function getMissingTags(oldTags: Tag[], newTags: Tag[]): string[] {
  const missing = oldTags.filter(missingTags(newTags));
  return missing.map(function (tag: Tag) {
    return tag.Key!;
  });
}

function missingTags(newTags: Tag[]) {
  return (currentTag: Tag) => {
    return (
      newTags.filter((newTag: Tag) => {
        return newTag.Key == currentTag.Key;
      }).length == 0
    );
  };
}
