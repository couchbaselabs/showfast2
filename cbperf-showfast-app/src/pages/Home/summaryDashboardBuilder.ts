import { EmbeddedScene, PanelBuilders, SceneFlexLayout } from '@grafana/scenes';
import {
	buildLabeledCountData,
	buildSingleValueData,
	createSummaryPanel,
	SummaryPanelDefinition,
	TestsByComponentResponse,
	TestsRanLastMonthResponse,
} from './summaryDashboardData';

const summaryPanelDefinitions: Array<SummaryPanelDefinition<unknown>> = [
	{
		id: 'tests-ran-last-month',
		endpoint: 'tests-ran-last-month',
		minHeight: 170,
		buildPanel: (dataNode) =>
			PanelBuilders.stat()
				.setTitle('Tests ran in last 28 days')
				.setDescription('Count of benchmark test runs with dateTime newer than today - 28 days.')
				.setData(dataNode)
				.setUnit('none')
				.setDecimals(0)
				.build(),
		buildData: (response) => {
			const { testsRanLastMonth = 0 } = response as TestsRanLastMonthResponse;

			return buildSingleValueData('tests-ran-last-month', 'testsRanLastMonth', Number(testsRanLastMonth));
		},
	},
	{
		id: 'tests-ran-for-each-component-last-2-weeks',
		endpoint: 'tests-ran-for-each-component-last-2-weeks',
		minHeight: 320,
		buildPanel: (dataNode) =>
			PanelBuilders.piechart()
				.setTitle('Tests by component in last 28 days')
				.setDescription('Distribution of benchmark test runs per component with dateTime newer than today - 28 days.')
				.setOption('reduceOptions', {
					values: true,
				})
				.setData(dataNode)
				.build(),
		buildData: (response) =>
			buildLabeledCountData(
				'tests-ran-for-each-component-last-2-weeks',
				'component',
				'number_of',
				response as TestsByComponentResponse
			),
	},
];

export function buildSummaryDashboardScene() {
	const panels = summaryPanelDefinitions.map((definition) => createSummaryPanel(definition));

	const scene = new EmbeddedScene({
		body: new SceneFlexLayout({
			direction: 'column',
			children: panels.map((panel) => panel.item),
		}),
	});

	scene.addActivationHandler(() => {
		void Promise.allSettled(panels.map((panel) => panel.load()));
		return undefined;
	});

	return scene;
}