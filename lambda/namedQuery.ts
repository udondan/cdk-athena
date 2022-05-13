import { CustomResource, Event, LambdaEvent, StandardLogger } from 'aws-cloudformation-custom-resource';
import { Callback, Context } from 'aws-lambda';
import { Athena, AWSError } from 'aws-sdk';

const athena = new Athena();

let log: StandardLogger;

export function NamedQuery(
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
  return new Promise(function (resolve, reject) {
    event.setPhysicalResourceId(event.LogicalResourceId);
    createQuery(event.ResourceProperties)
      .then((id) => {
        event.addResponseValue('id', id);
        resolve(event);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

function Update(event: Event): Promise<Event> {
  event.setPhysicalResourceId(event.LogicalResourceId);
  return new Promise(async function (resolve, reject) {
    if (
      JSON.stringify(event.OldResourceProperties) ==
      JSON.stringify(event.ResourceProperties)
    ) {
      log.info(
        `No changes detected for NamedQuery ${event.ResourceProperties.Name}. Not attempting any update`
      );
      return resolve(event);
    }

    try {
      const oldQuery = await getNamedQuery(event.OldResourceProperties);
      createQuery(event.ResourceProperties) //first: create new query
        .then((id) => {
          event.addResponseValue('id', id);
          deleteQuery(oldQuery.NamedQueryId) // then: delete old query
            .then(() => {
              resolve(event);
            })
            .catch((err) => {
              reject(err);
            });
        })
        .catch((err) => {
          reject(err);
        });
    } catch (err) {
      reject(err);
    }
  });
}

function Delete(event: any): Promise<Event> {
  event.setPhysicalResourceId(event.LogicalResourceId);
  return new Promise(async function (resolve, reject) {
    try {
      const query = await getNamedQuery(event.ResourceProperties);
      deleteQuery(query.NamedQueryId)
        .then(() => {
          resolve(event);
        })
        .catch((err) => {
          reject(err);
        });
    } catch (err) {
      reject(err);
    }
  });
}

function createQuery(resourceProperties: any): Promise<String> {
  log.info(`Attempting to create Athena NamedQuery ${resourceProperties.Name}`);
  return new Promise(function (resolve, reject) {
    var params = {
      Name: resourceProperties.Name,
      Database: resourceProperties.Database,
      QueryString: resourceProperties.QueryString,
    };

    if (resourceProperties.Description.length) {
      params['Description'] = resourceProperties.Description;
    }

    if (resourceProperties.WorkGroup.length) {
      params['WorkGroup'] = resourceProperties.WorkGroup;
    }

    log.debug('Sending payload', JSON.stringify(params, null, 2));

    athena.createNamedQuery(
      params,
      function (err: AWSError, data: Athena.CreateNamedQueryOutput) {
        if (err) return reject(err);
        resolve(data.NamedQueryId);
      }
    );
  });
}

function deleteQuery(queryId: string): Promise<Athena.DeleteNamedQueryOutput> {
  log.info(`Attempting to delete Athena NamedQuery with ID ${queryId}`);
  return new Promise(function (resolve, reject) {
    const params: Athena.DeleteNamedQueryInput = {
      NamedQueryId: queryId,
    };

    log.debug('Sending payload', JSON.stringify(params, null, 2));

    athena.deleteNamedQuery(
      params,
      function (err: AWSError, result: Athena.DeleteNamedQueryOutput) {
        if (err) return reject(err);
        resolve(result);
      }
    );
  });
}

function getWorkGroupQueries(
  resourceProperties: any
): Promise<Athena.ListNamedQueriesOutput> {
  return new Promise(function (resolve, reject) {
    const params: Athena.ListNamedQueriesInput = {};
    if (resourceProperties.WorkGroup.length) {
      params['WorkGroup'] = resourceProperties.WorkGroup;
    }

    log.debug('Sending payload', JSON.stringify(params, null, 2));

    athena.listNamedQueries(
      params,
      function (err: AWSError, data: Athena.ListNamedQueriesOutput) {
        if (err) return reject(err);
        resolve(data);
      }
    );
  });
}

function getNamedQuery(resourceProperties: any): Promise<Athena.NamedQuery> {
  return new Promise(async function (resolve, reject) {
    try {
      const queries = await getWorkGroupQueries(resourceProperties);
      if (
        typeof queries['NamedQueryIds'] == undefined ||
        queries.NamedQueryIds.length == 0
      ) {
        reject(new Error("Didn't find any queries"));
      }

      let searchWorkGroup = resourceProperties.WorkGroup;
      if (typeof searchWorkGroup == 'undefined' || searchWorkGroup == '') {
        searchWorkGroup = 'primary';
      }

      for (let i = 0; i < queries.NamedQueryIds.length; i++) {
        const details = await getNamedQueryDetails(queries.NamedQueryIds[i]);
        if (
          details.NamedQuery!.Name == resourceProperties.Name &&
          details.NamedQuery!.WorkGroup == searchWorkGroup
        ) {
          return resolve(details.NamedQuery!);
        }
      }
    } catch (err) {
      reject(err);
    }

    reject(
      new Error(
        `No matching query found for workgroup=${resourceProperties.WorkGroup} / name=${resourceProperties.Name}`
      )
    );
  });
}

function getNamedQueryDetails(
  queryId: string
): Promise<Athena.GetNamedQueryOutput> {
  return new Promise(function (resolve, reject) {
    const params: Athena.GetNamedQueryInput = {
      NamedQueryId: queryId,
    };

    athena.getNamedQuery(
      params,
      function (err: AWSError, data: Athena.GetNamedQueryOutput) {
        if (err) return reject(err);
        resolve(data);
      }
    );
  });
}
