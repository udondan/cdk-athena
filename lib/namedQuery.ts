import { aws_lambda, CustomResource, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ensureLambda } from './lambda';
import { WorkGroup } from './workGroup';
import { NamedQueryProperties } from '../lambda/types';

const resourceType = 'Custom::Athena-NamedQuery';

/**
 * Definition of the Athena NamedQuery
 */
export interface NamedQueryProps extends StackProps {
  /**
   * The query name
   */
  readonly name: string;

  /**
   * The query description
   */
  readonly desc?: string;

  /**
   * The database to which the query belongs
   */
  readonly database: string;

  /**
   * The workgroup in which the named query is being created
   */
  readonly workGroup?: WorkGroup | string;

  /**
   * The contents of the query with all query statements
   */
  readonly queryString: string;
}

/**
 * An Athena NamedQuery
 */
export class NamedQuery extends Construct {
  /**
   * The lambda function that is created
   */
  public readonly lambda: aws_lambda.IFunction;
  /**
   * Name of the query
   */
  public readonly name: string = '';

  /**
   * The unique ID of the query
   */
  public readonly id: string = '';

  /**
   * Defines a new Athena NamedQuery
   */
  constructor(scope: Construct, id: string, props: NamedQueryProps) {
    super(scope, id);

    this.lambda = ensureLambda(this);
    this.name = props.name;

    const namedQueryProperties: NamedQueryProperties = {
      /* eslint-disable @typescript-eslint/naming-convention */
      Name: this.name,
      Description: props.desc ?? '',
      Database: props.database,
      QueryString: props.queryString,
      WorkGroup: '',
      /* eslint-enable @typescript-eslint/naming-convention */
    };

    if (typeof props.workGroup === 'string') {
      namedQueryProperties.WorkGroup = props.workGroup;
    } else if (typeof props.workGroup !== 'undefined') {
      namedQueryProperties.WorkGroup = props.workGroup.name;
    }

    const namedQuery = new CustomResource(
      this,
      `Athena-NamedQuery-${props.name
        .replace(/\s+/g, '-')
        .replace(/[a-z0-9_-]+/gi, '')}`,
      {
        serviceToken: this.lambda.functionArn,
        resourceType: resourceType,
        properties: namedQueryProperties,
      },
    );

    if (['undefined', 'string'].indexOf(typeof props.workGroup) < 0) {
      namedQuery.node.addDependency(props.workGroup! as WorkGroup);
    }

    this.id = namedQuery.getAttString('id');
  }
}
