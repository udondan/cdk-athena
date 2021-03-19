import { CustomResource, Event, LambdaEvent, StandardLogger } from 'aws-cloudformation-custom-resource';
import { Callback, Context } from 'aws-lambda';
import AWS = require('aws-sdk');

const athena = new AWS.Athena();

let log: StandardLogger;

export function WorkGroup(
  event: LambdaEvent,
  context: Context,
  callback: Callback,
  logger: StandardLogger
) {
  log = logger;
  new CustomResource(context, callback, logger)
    .onCreate(Create)
    .onUpdate(Update)
    .onDelete(Delete)
    .handle(event);
}

function Create(event: Event): Promise<Event> {
  log.info(
    `Attempting to create Athena WorkGroup ${event.ResourceProperties.Name}`
  );
  return new Promise(function (resolve, reject) {
    const params: AWS.Athena.CreateWorkGroupInput = {
      Name: event.ResourceProperties.Name,
      Description: event.ResourceProperties.Description,
      Configuration: {
        EnforceWorkGroupConfiguration:
          event.ResourceProperties.EnforceWorkGroupConfiguration == 'true',
        PublishCloudWatchMetricsEnabled:
          event.ResourceProperties.PublishCloudWatchMetricsEnabled == 'true',
        RequesterPaysEnabled:
          event.ResourceProperties.RequesterPaysEnabled == 'true',

        // docs say yes, api says no  ¯\_(ツ)_/¯
        //EngineVersion: {
        //  SelectedEngineVersion:
        //    event.ResourceProperties.EngineVersion || 'auto',
        //},
      },
      Tags: makeTags(event, event.ResourceProperties),
    };

    if ('ResultConfiguration' in event.ResourceProperties) {
      params.Configuration['ResultConfiguration'] = capKeys(
        event.ResourceProperties.ResultConfiguration
      );
    }

    if ('BytesScannedCutoffPerQuery' in event.ResourceProperties) {
      params.Configuration['BytesScannedCutoffPerQuery'] = parseInt(
        event.ResourceProperties.BytesScannedCutoffPerQuery
      );
    }

    log.debug('Sending payload', JSON.stringify(params, null, 2));

    athena.createWorkGroup(
      params,
      function (err: AWS.AWSError, _: AWS.Athena.CreateWorkGroupOutput) {
        if (err) return reject(err);
        event.addResponseValue('ARN', event.ResourceProperties.Arn);
        resolve(event);
      }
    );
  });
}

function Update(event: Event): Promise<Event> {
  return new Promise(function (resolve, reject) {
    updateWorkGroup(event)
      .then(updateWorkGroupAddTags)
      .then(updateWorkGroupRemoveTags)
      .then(function (data) {
        event.addResponseValue('ARN', event.ResourceProperties.Arn);
        resolve(data);
      })
      .catch(function (err: Error) {
        reject(err);
      });
  });
}

function getWorkGroup(name: string): Promise<AWS.Athena.GetWorkGroupOutput> {
  log.info(`Fetching details of Athena WorkGroup ${name}`);
  return new Promise(function (resolve, reject) {
    const params = {
      WorkGroup: name,
    };

    log.debug('Sending payload', JSON.stringify(params, null, 2));

    athena.getWorkGroup(
      params,
      function (err: AWS.AWSError, data: AWS.Athena.GetWorkGroupOutput) {
        if (err) return reject(err);
        resolve(data);
      }
    );
  });
}

function updateWorkGroup(event: Event): Promise<Event> {
  log.info(
    `Attempting to update Athena WorkGroup ${event.ResourceProperties.Name}`
  );
  return new Promise(async function (resolve, reject) {
    try {
      var current: AWS.Athena.GetWorkGroupOutput = await getWorkGroup(
        event.ResourceProperties.Name
      );
    } catch (err) {
      reject(
        `Unable to get WorkGroup of name ${event.ResourceProperties.Name}: ${err}`
      );
    }

    log.debug('Current WorkGroup', JSON.stringify(current, null, 2));

    const params = {
      WorkGroup: event.ResourceProperties.Name,
      Description: event.ResourceProperties.Description,
      ConfigurationUpdates: {
        EnforceWorkGroupConfiguration:
          event.ResourceProperties.EnforceWorkGroupConfiguration == 'true',
        PublishCloudWatchMetricsEnabled:
          event.ResourceProperties.PublishCloudWatchMetricsEnabled == 'true',
        RequesterPaysEnabled:
          event.ResourceProperties.RequesterPaysEnabled == 'true',

        // docs say yes, api says no  ¯\_(ツ)_/¯
        //EngineVersion: {
        //  SelectedEngineVersion:
        //    event.ResourceProperties.EngineVersion || 'auto',
        //},
      },
    };

    const hasOutputLocation =
      'OutputLocation' in current.WorkGroup.Configuration.ResultConfiguration;

    const hasEncryptionConfiguration =
      'EncryptionConfiguration' in
      current.WorkGroup.Configuration.ResultConfiguration;

    const hasBytesScannedCutoffPerQuery =
      'BytesScannedCutoffPerQuery' in current.WorkGroup.Configuration;

    if ('BytesScannedCutoffPerQuery' in event.ResourceProperties) {
      params.ConfigurationUpdates['BytesScannedCutoffPerQuery'] = parseInt(
        event.ResourceProperties.BytesScannedCutoffPerQuery
      );
    } else if (
      hasBytesScannedCutoffPerQuery &&
      !('BytesScannedCutoffPerQuery' in event.ResourceProperties)
    ) {
      params.ConfigurationUpdates['RemoveBytesScannedCutoffPerQuery'] = true;
    }

    let resultConfig = {};
    if ('ResultConfiguration' in event.ResourceProperties) {
      resultConfig = capKeys(event.ResourceProperties.ResultConfiguration);
    }

    if (
      hasEncryptionConfiguration &&
      !('EncryptionConfiguration' in resultConfig)
    ) {
      resultConfig['RemoveEncryptionConfiguration'] = true;
    }

    if (hasOutputLocation && !('OutputLocation' in resultConfig)) {
      resultConfig['RemoveOutputLocation'] = true;
    }

    if (Object.keys(resultConfig).length) {
      params.ConfigurationUpdates['ResultConfigurationUpdates'] = resultConfig;
    }

    log.debug('Sending payload', JSON.stringify(params, null, 2));

    athena.updateWorkGroup(
      params,
      function (err: AWS.AWSError, _: AWS.Athena.UpdateWorkGroupOutput) {
        if (err) return reject(err);
        resolve(event);
      }
    );
  });
}

function updateWorkGroupAddTags(event: Event): Promise<Event> {
  log.info(
    `Attempting to update tags for Athena WorkGroup ${event.ResourceProperties.Name}`
  );
  return new Promise(function (resolve, reject) {
    const oldTags = makeTags(event, event.OldResourceProperties);
    const newTags = makeTags(event, event.ResourceProperties);
    if (JSON.stringify(oldTags) == JSON.stringify(newTags)) {
      log.info(
        `No changes of tags detected for WorkGroup ${event.ResourceProperties.Name}. Not attempting any update`
      );
      return resolve(event);
    }

    const params = {
      ResourceARN: event.ResourceProperties.Arn,
      Tags: newTags,
    };

    log.debug('Sending payload', JSON.stringify(params, null, 2));

    athena.tagResource(
      params,
      function (err: AWS.AWSError, _: AWS.Athena.TagResourceOutput) {
        if (err) return reject(err);
        resolve(event);
      }
    );
  });
}

function updateWorkGroupRemoveTags(event: Event): Promise<Event> {
  log.info(
    `Attempting to remove some tags for Athena WorkGroup ${event.ResourceProperties.Name}`
  );
  return new Promise(function (resolve, reject) {
    resolve(event);
    const oldTags = makeTags(event, event.OldResourceProperties);
    const newTags = makeTags(event, event.ResourceProperties);
    const tagsToRemove = getMissingTags(oldTags, newTags);
    if (
      JSON.stringify(oldTags) == JSON.stringify(newTags) ||
      !tagsToRemove.length
    ) {
      log.info(
        `No changes of tags detected for document ${event.ResourceProperties.Name}. Not attempting any update`
      );
      return resolve(event);
    }

    log.info(`Will remove the following tags: ${JSON.stringify(tagsToRemove)}`);

    const params = {
      ResourceARN: event.ResourceProperties.Arn,
      TagKeys: tagsToRemove,
    };

    log.debug('Sending payload', JSON.stringify(params, null, 2));

    athena.untagResource(
      params,
      function (err: AWS.AWSError, _: AWS.Athena.UntagResourceOutput) {
        if (err) return reject(err);
        resolve(event);
      }
    );
  });
}

function Delete(event: any): Promise<Event> {
  log.info(
    `Attempting to delete Athena WorkGroup ${event.ResourceProperties.Name}`
  );
  return new Promise(function (resolve, reject) {
    const params = {
      WorkGroup: event.ResourceProperties.Name,
      RecursiveDeleteOption: false,
    };

    log.debug('Sending payload', JSON.stringify(params, null, 2));

    athena.deleteWorkGroup(
      params,
      function (err: AWS.AWSError, _: AWS.Athena.DeleteWorkGroupOutput) {
        if (err) return reject(err);
        resolve(event);
      }
    );
  });
}

function makeTags(event: Event, properties: any): AWS.Athena.TagList {
  const tags: AWS.Athena.TagList = [
    {
      Key: 'aws-cloudformation:stack-id',
      Value: event.StackId,
    },
    {
      Key: 'aws-cloudformation:stack-name',
      Value: properties.StackName,
    },
    {
      Key: 'aws-cloudformation:logical-id',
      Value: event.LogicalResourceId,
    },
  ];
  if ('Tags' in properties) {
    Object.keys(properties.Tags).forEach(function (key: string) {
      tags.push({
        Key: key,
        Value: properties.Tags[key],
      });
    });
  }
  return tags;
}

function getMissingTags(
  oldTags: AWS.Athena.TagList,
  newTags: AWS.Athena.TagList
): string[] {
  const missing = oldTags.filter(missingTags(newTags));
  return missing.map(function (tag: AWS.Athena.Tag) {
    return tag.Key;
  });
}

function missingTags(newTags: AWS.Athena.TagList) {
  return (currentTag: AWS.Athena.Tag) => {
    return (
      newTags.filter((newTag: any) => {
        return newTag.Key == currentTag.Key;
      }).length == 0
    );
  };
}

function capKeys(input: any) {
  const output = {};
  for (let [key, value] of Object.entries(input)) {
    if (!!value && value.constructor === Object) {
      value = capKeys(value);
    }
    output[upperFirst(key)] = value;
  }
  return output;
}

function upperFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
