import {
  Context,
  Callback,
  CustomResource,
  Event,
  Logger,
} from 'aws-cloudformation-custom-resource';
import {
  AthenaClient,
  CreateNamedQueryCommand,
  CreateNamedQueryCommandInput,
  DeleteNamedQueryCommand,
  DeleteNamedQueryCommandInput,
  DeleteNamedQueryCommandOutput,
  GetNamedQueryCommand,
  GetNamedQueryCommandInput,
  GetNamedQueryCommandOutput,
  NamedQuery,
  ListNamedQueriesCommand,
  ListNamedQueriesCommandInput,
  ListNamedQueriesCommandOutput,
} from '@aws-sdk/client-athena';
import { NamedQueryProperties } from './types';

const athenaClient = new AthenaClient({});

export function namedQuery(
  event: Event<NamedQueryProperties>,
  context: Context,
  callback: Callback,
  logger: Logger,
) {
  const resource = new CustomResource<NamedQueryProperties>(
    event,
    context,
    callback,
    createResource,
    updateResource,
    deleteResource,
  );

  resource.setLogger(logger);
  resource.setPhysicalResourceId(resource.event.LogicalResourceId);
}

async function createResource(
  resource: CustomResource<NamedQueryProperties>,
  log: Logger,
): Promise<void> {
  await createQuery(resource, log);
}

async function updateResource(
  resource: CustomResource<NamedQueryProperties>,
  log: Logger,
): Promise<void> {
  if (
    !resource.properties.Name.changed &&
    !resource.properties.Database.changed &&
    !resource.properties.QueryString.changed &&
    (!resource.properties.Description ||
      !resource.properties.Description.changed) &&
    (!resource.properties.WorkGroup || //
      !resource.properties.WorkGroup.changed)
  ) {
    log.info(
      `No changes detected for NamedQuery ${resource.properties.Name.value}. Not attempting any update`,
    );
    return;
  }

  const oldQuery = await getNamedQuery(
    resource.event.OldResourceProperties!,
    log,
  );
  await createQuery(resource, log);
  await deleteQuery(oldQuery.NamedQueryId!, log);
}

async function deleteResource(
  resource: CustomResource<NamedQueryProperties>,
  log: Logger,
): Promise<void> {
  const query = await getNamedQuery(resource.event.ResourceProperties, log);
  await deleteQuery(query.NamedQueryId!, log);
}

async function createQuery(
  resource: CustomResource<NamedQueryProperties>,
  log: Logger,
): Promise<void> {
  log.info(
    `Attempting to create Athena NamedQuery ${resource.properties.Name.value}`,
  );

  const params: CreateNamedQueryCommandInput = {
    /* eslint-disable @typescript-eslint/naming-convention */
    Name: resource.properties.Name.value,
    Database: resource.properties.Database.value,
    QueryString: resource.properties.QueryString.value,
    /* eslint-enable @typescript-eslint/naming-convention */
  };

  if (resource.properties.Description?.value?.length) {
    params.Description = resource.properties.Description.value;
  }

  if (resource.properties.WorkGroup?.value?.length) {
    params.WorkGroup = resource.properties.WorkGroup.value;
  }

  log.debug('Sending payload', JSON.stringify(params, null, 2));

  const result = await athenaClient.send(new CreateNamedQueryCommand(params));
  resource.addResponseValue('id', result.NamedQueryId!);
}

async function deleteQuery(
  queryId: string,
  log: Logger,
): Promise<DeleteNamedQueryCommandOutput> {
  log.info(`Attempting to delete Athena NamedQuery with ID ${queryId}`);

  const params: DeleteNamedQueryCommandInput = {
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    NamedQueryId: queryId,
  };

  log.debug('Sending payload', JSON.stringify(params, null, 2));
  const result = await athenaClient.send(new DeleteNamedQueryCommand(params));
  return result;
}

async function getWorkGroupQueries(
  properties: NamedQueryProperties,
  log: Logger,
): Promise<ListNamedQueriesCommandOutput> {
  const params: ListNamedQueriesCommandInput = {};
  if (properties.WorkGroup?.length) {
    params.WorkGroup = properties.WorkGroup;
  }

  log.debug('Sending payload', JSON.stringify(params, null, 2));

  const result = await athenaClient.send(new ListNamedQueriesCommand(params));
  return result;
}

async function getNamedQuery(
  properties: NamedQueryProperties,
  log: Logger,
): Promise<NamedQuery> {
  const queries = await getWorkGroupQueries(properties, log);
  if (
    typeof queries.NamedQueryIds == 'undefined' ||
    queries.NamedQueryIds.length == 0
  ) {
    throw new Error("Didn't find any queries");
  }

  let searchWorkGroup = properties.WorkGroup;
  if (typeof searchWorkGroup == 'undefined' ?? searchWorkGroup == '') {
    searchWorkGroup = 'primary';
  }

  for (const id of queries.NamedQueryIds) {
    const details = await getNamedQueryDetails(id);
    if (
      details.NamedQuery!.Name == properties.Name &&
      details.NamedQuery!.WorkGroup == searchWorkGroup
    ) {
      return details.NamedQuery!;
    }
  }

  throw new Error(
    `No matching query found for workgroup=${properties.WorkGroup} / name=${properties.Name}`,
  );
}

async function getNamedQueryDetails(
  queryId: string,
): Promise<GetNamedQueryCommandOutput> {
  const params: GetNamedQueryCommandInput = {
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    NamedQueryId: queryId,
  };

  const result = await athenaClient.send(new GetNamedQueryCommand(params));
  return result;
}
