import { DataQueryRequest, DataQueryResponse, MetricFindValue } from '@grafana/data';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import {
  EmbeddedScene,
  PanelBuilders,
  QueryVariable,
  RuntimeDataSource,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneVariableSet,
  VariableValueSelectors,
  registerRuntimeDataSource,
} from '@grafana/scenes';
import { API_BASE_URL } from '../../constants';

// in memory datasource for filter variables 
const SHOWFAST_FILTERS_RUNTIME_DATASOURCE_PLUGIN_ID = 'cbperf-showfast-app-filters-runtime';
const SHOWFAST_FILTERS_RUNTIME_DATASOURCE_UID = 'cbperf-showfast-app-filters-runtime';

const variableToQueryKey = {
  component: 'component',
  category: 'category',
  subcategory: 'subcategory',
  cluster: 'cluster',
  os: 'os',
} as const;

const endpointToVariable = {
  components: 'component',
  categories: 'category',
  subcategories: 'subcategory',
  clusters: 'cluster',
  os: 'os',
} as const;

type VariableName = keyof typeof variableToQueryKey;
type FilterEndpoint = keyof typeof endpointToVariable;
type FilterDefinition = {
  name: VariableName;
  label: string;
  endpoint: FilterEndpoint;
};

const FILTER_DEFINITIONS: FilterDefinition[] = [
  { name: 'component', label: 'Component', endpoint: 'components' },
  { name: 'category', label: 'Category', endpoint: 'categories' },
  { name: 'subcategory', label: 'Subcategory', endpoint: 'subcategories' },
  { name: 'os', label: 'OS', endpoint: 'os' },
  { name: 'cluster', label: 'Cluster', endpoint: 'clusters' },
];

function selectedValuesForVariable(name: string): string[] {
  const templateSrv = getTemplateSrv();
  const values: string[] = [];

  templateSrv.replace(`$${name}`, {}, (value: string | string[]) => {
    if (Array.isArray(value)) {
      values.push(...value);
    } else {
      values.push(value);
    }
    return '';
  });

  return values
    .map((value) => value.trim())
    .filter((value) => value !== '' && value !== '$__all' && value !== '*')
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

function parseVariableNameFromQueryKey(queryKey: string): VariableName | null {
  const match = (Object.entries(variableToQueryKey) as Array<[VariableName, string]>).find(
    ([, value]) => value === queryKey
  );
  return match ? match[0] : null;
}

function buildFilterParamsFromDependencies(dependencies: VariableName[]): URLSearchParams {
  const params = new URLSearchParams();

  dependencies.forEach((variableName) => {
    const queryKey = variableToQueryKey[variableName];
    for (const value of selectedValuesForVariable(variableName)) {
      params.append(queryKey, value);
    }
  });

  return params;
}

class ShowfastFilterRuntimeDataSource extends RuntimeDataSource {
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
      : (Object.keys(variableToQueryKey) as VariableName[]).filter((name) => name !== variableForEndpoint);

    const params = buildFilterParamsFromDependencies(dependencies);
    const qs = params.toString();
    const url = `${API_BASE_URL}/utils/${endpoint}${qs ? `?${qs}` : ''}`;

    const values = await getBackendSrv().get<string[]>(url);
    return values.map((value) => ({ text: value, value }));
  }
}

let dataSourceRegistered = false;

function ensureRuntimeDataSourceRegistered() {
  if (dataSourceRegistered) {
    return;
  }

  registerRuntimeDataSource({ dataSource: new ShowfastFilterRuntimeDataSource() });
  dataSourceRegistered = true;
}

function createFilterVariable(name: VariableName, label: string, endpoint: FilterEndpoint) {
  return new QueryVariable({
    name,
    label,
    datasource: {
      uid: SHOWFAST_FILTERS_RUNTIME_DATASOURCE_UID,
      type: SHOWFAST_FILTERS_RUNTIME_DATASOURCE_PLUGIN_ID,
    },
    query: endpoint,
    isMulti: true,
    includeAll: true,
    defaultToAll: true,
    allValue: '*',
  });
}

function buildVariableQuery(endpoint: FilterEndpoint, dependencies: VariableName[]): string {
  const activeDependencies = dependencies.filter((name) => selectedValuesForVariable(name).length > 0);
  if (activeDependencies.length === 0) {
    return endpoint;
  }

  const query = activeDependencies.map((name) => `${variableToQueryKey[name]}=$${name}`).join('&');
  return `${endpoint}?${query}`;
}

function setQueryIfChanged(variable: QueryVariable, query: string) {
  if (variable.state.query !== query) {
    variable.setState({ query });
  }
}

function getPeerDependencies(variableName: VariableName): VariableName[] {
  return FILTER_DEFINITIONS.map((definition) => definition.name).filter((name) => name !== variableName);
}

export function timelinesScene() {
  ensureRuntimeDataSourceRegistered();

  const variableMap = FILTER_DEFINITIONS.reduce((acc, definition) => {
    acc[definition.name] = createFilterVariable(definition.name, definition.label, definition.endpoint);
    return acc;
  }, {} as Record<VariableName, QueryVariable>);

  const variables = FILTER_DEFINITIONS.map((definition) => variableMap[definition.name]);

  const syncQueries = () => {
    FILTER_DEFINITIONS.forEach((definition) => {
      const dependencies = getPeerDependencies(definition.name);
      const query = buildVariableQuery(definition.endpoint, dependencies);
      setQueryIfChanged(variableMap[definition.name], query);
    });
  };

  variables[0].addActivationHandler(() => {
    const subs = variables.map((variable) => variable.subscribeToState(() => syncQueries()));
    syncQueries();
    return () => subs.forEach((s) => s.unsubscribe());
  });

  return new EmbeddedScene({
    $variables: new SceneVariableSet({
      variables,
    }),
    body: new SceneFlexLayout({
      children: [
        new SceneFlexItem({
          minHeight: 120,
          body: PanelBuilders.text().setTitle('Timelines').build(),
        }),
      ],
    }),
    controls: [new VariableValueSelectors({}), new SceneControlsSpacer()],
  });
}
