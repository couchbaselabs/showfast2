import { DataFrame, FieldType, LoadingState, PanelData, dateTime } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { SceneDataNode, SceneFlexItem } from '@grafana/scenes';
import { API_BASE_URL } from '../../constants';

export type TestsRanLastMonthResponse = {
    testsRanLastMonth: number;
};

export type TestsByComponentResponse = Record<string, number>;

export type SummaryPanelDefinition<TResponse> = {
    id: string;
    endpoint: string;
    minHeight: number;
    buildPanel: (dataNode: SceneDataNode) => SceneFlexItem['state']['body'];
    buildData: (response: TResponse) => PanelData;
};

function buildPanelTimeRange() {
    const now = dateTime();

    return {
        from: now,
        to: now,
        raw: { from: now, to: now },
    };
}

export function buildLoadingData(): PanelData {
    return {
        state: LoadingState.Loading,
        series: [],
        timeRange: buildPanelTimeRange(),
    };
}

export function buildErrorData(): PanelData {
    return {
        state: LoadingState.Error,
        series: [],
        timeRange: buildPanelTimeRange(),
    };
}

export function buildSingleValueData(frameName: string, fieldName: string, value: number): PanelData {
    const frame: DataFrame = {
        name: frameName,
        refId: 'A',
        length: 1,
        fields: [
            {
                name: fieldName,
                type: FieldType.number,
                config: {},
                values: [value],
            },
        ],
    };

    return {
        state: LoadingState.Done,
        series: [frame],
        timeRange: buildPanelTimeRange(),
    };
}

export function buildLabeledCountData(
    frameName: string,
    labelFieldName: string,
    valueFieldName: string,
    valuesByLabel: Record<string, number>
): PanelData {
    const entries = Object.entries(valuesByLabel).sort(([leftLabel], [rightLabel]) =>
        leftLabel.localeCompare(rightLabel, undefined, { sensitivity: 'base' })
    );
    const frame: DataFrame = {
        name: frameName,
        refId: 'A',
        length: entries.length,
        fields: [
            {
                name: labelFieldName,
                type: FieldType.string,
                config: {},
                values: entries.map(([label]) => label),
            },
            {
                name: valueFieldName,
                type: FieldType.number,
                config: {},
                values: entries.map(([, value]) => Number(value ?? 0)),
            },
        ],
    };

    return {
        state: LoadingState.Done,
        series: [frame],
        timeRange: buildPanelTimeRange(),
    };
}

export async function fetchSummaryEndpoint<TResponse>(endpoint: string): Promise<TResponse> {
    return getBackendSrv().get<TResponse>(`${API_BASE_URL}/summary/${endpoint}`);
}

export function createSummaryPanel<TResponse>(definition: SummaryPanelDefinition<TResponse>) {
    const dataNode = new SceneDataNode({ data: buildLoadingData() });

    const item = new SceneFlexItem({
        minHeight: definition.minHeight,
        body: definition.buildPanel(dataNode),
    });

    const load = async () => {
        try {
            const response = await fetchSummaryEndpoint<TResponse>(definition.endpoint);
            dataNode.setState({ data: definition.buildData(response) });
        } catch (error) {
            console.error(`Failed to load summary panel: ${definition.id}`, error);
            dataNode.setState({ data: buildErrorData() });
        }
    };

    return { item, load };
}