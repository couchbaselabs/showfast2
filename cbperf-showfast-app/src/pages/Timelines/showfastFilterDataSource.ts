/**
 * RuntimeDataSource for Timelines filter variables.
 * Handles metric find queries for dynamic filter options.
 */

import { DataQueryRequest, DataQueryResponse, MetricFindValue } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { RuntimeDataSource, registerRuntimeDataSource } from '@grafana/scenes';
import { API_BASE_URL } from '../../constants';
import { isIgnorableRequestError } from '../../utils/utils.requests';
import {
  FILTER_DEFINITIONS,
  FilterEndpoint,
  VariableName,
  endpointToVariable,
  SHOWFAST_FILTERS_RUNTIME_DATASOURCE_PLUGIN_ID,
  SHOWFAST_FILTERS_RUNTIME_DATASOURCE_UID,
} from './filterConfig';
import {
  buildFilterParamsFromDependencies,
  parseVariableNameFromQueryKey,
} from './variableHelpers';

export class ShowfastFilterRuntimeDataSource extends RuntimeDataSource {
  constructor() {
    super(SHOWFAST_FILTERS_RUNTIME_DATASOURCE_PLUGIN_ID, SHOWFAST_FILTERS_RUNTIME_DATASOURCE_UID);
  }

  async query(_request: DataQueryRequest): Promise<DataQueryResponse> {
    return { data: [] };
  }

  async metricFindQuery(rawQuery: string): Promise<MetricFindValue[]> {
    const [rawEndpoint, rawQueryString] = rawQuery.trim().replace(/^\//, '').split('?');
    const endpoint = rawEndpoint as FilterEndpoint;
    const variableForEndpoint = endpointToVariable[endpoint];

    if (!variableForEndpoint) {
      return [];
    }

    const dependenciesFromQuery = rawQueryString
      ? rawQueryString
          .split('&')
          .map((part) => part.split('=')[0]?.trim())
          .filter((key) => key !== '')
          .map((queryKey) => parseVariableNameFromQueryKey(queryKey))
          .filter((name): name is VariableName => name !== null && name !== variableForEndpoint)
      : [];

    const dependencies = dependenciesFromQuery.length > 0
      ? dependenciesFromQuery
      : FILTER_DEFINITIONS.map((definition) => definition.name).filter((name) => name !== variableForEndpoint);

    const params = buildFilterParamsFromDependencies(dependencies);
    const qs = params.toString();
    const url = `${API_BASE_URL}/filters/${endpoint}${qs ? `?${qs}` : ''}`;

    try {
      const values = await getBackendSrv().get<string[]>(url);
      return values.map((value) => ({ text: value, value }));
    } catch (error) {
      if (isIgnorableRequestError(error)) {
        return [];
      }
      throw error;
    }
  }
}

let dataSourceRegistered = false;

/**
 * Register the ShowfastFilterRuntimeDataSource globally (singleton).
 */
export function ensureRuntimeDataSourceRegistered() {
  if (dataSourceRegistered) {
    return;
  }

  registerRuntimeDataSource({ dataSource: new ShowfastFilterRuntimeDataSource() });
  dataSourceRegistered = true;
}
