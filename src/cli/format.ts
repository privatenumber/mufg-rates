import type { Ansis } from 'ansis';
import type {
	RatesResult, DailyResult, MonthlyResult, YearlyResult, WorldResult,
	ReferenceResult, ArchiveResult, ConvertCurrencyResult,
} from '../api/types.ts';
import { formatTable } from './format-table.ts';

const fmtRate = (style: Ansis, value: number | null, decimals = 2): string => (value === null ? style.dim('—') : value.toFixed(decimals));

const numberFormat = new Intl.NumberFormat('en-US', {
	maximumFractionDigits: 10,
});

const rateColumns = [
	{ header: 'Code' },
	{ header: 'Currency' },
	{
		header: 'TTS',
		align: 'right' as const,
	},
	{
		header: 'TTB',
		align: 'right' as const,
	},
	{
		header: 'TTM',
		align: 'right' as const,
	},
];

export const formatRates = (result: RatesResult, style: Ansis): string => {
	const rows = Object.entries(result.rates).map(([code, rate]) => [
		style.bold(code),
		rate.name,
		fmtRate(style, rate.tts),
		fmtRate(style, rate.ttb),
		fmtRate(style, rate.ttm),
	]);

	return [
		style.bold(result.date),
		'',
		formatTable(rateColumns, rows, style),
	].join('\n');
};

export const formatDaily = (result: DailyResult, style: Ansis): string => {
	const rateRows = Object.entries(result.rates).map(([code, rate]) => [
		style.bold(code),
		rate.name,
		fmtRate(style, rate.tts),
		fmtRate(style, rate.ttb),
		fmtRate(style, rate.ttm),
	]);

	const sections = [
		style.bold(result.date),
		'',
		formatTable(rateColumns, rateRows, style),
	];

	const cashEntries = Object.entries(result.cashRates);
	if (cashEntries.length > 0) {
		const cashColumns = [
			{ header: 'Code' },
			{
				header: 'Selling',
				align: 'right' as const,
			},
			{
				header: 'Buying',
				align: 'right' as const,
			},
		];
		const cashRows = cashEntries.map(([code, rate]) => [
			style.bold(code),
			rate.selling.toFixed(2),
			rate.buying.toFixed(2),
		]);
		sections.push('', style.dim('Cash Rates'), formatTable(cashColumns, cashRows, style));
	}

	return sections.join('\n');
};

export const formatConversion = (result: ConvertCurrencyResult, style: Ansis): string => {
	const foreignCurrency = result.from === 'JPY'
		? result.to
		: result.from;
	const dateLine = result.requestedDate === result.sourceDate
		? result.sourceDate
		: `${result.requestedDate} -> ${result.sourceDate}`;

	return [
		style.bold(
			`${numberFormat.format(result.amount)} ${result.from} = ${numberFormat.format(result.convertedAmount)} ${result.to}`,
		),
		`Rate: ${result.rate.toUpperCase()} ${fmtRate(style, result.rateValue)} JPY per ${result.unit} ${foreignCurrency}`,
		`Date: ${dateLine}`,
		`Source: ${result.source}`,
	].join('\n');
};

export const formatMonthly = (result: MonthlyResult, style: Ansis): string => {
	const monthString = `${result.year}-${String(result.month).padStart(2, '0')}`;
	let hasUnitFootnote = false;

	const buildRows = (
		getRates: (rate: MonthlyResult['rates'][string]) => { tts: number | null;
			ttb: number | null;
			ttm: number | null; },
	) => Object.entries(result.rates).map(([code, rate]) => {
		const displayCode = rate.unit === 100 ? `${code}*` : code;
		if (rate.unit === 100) {
			hasUnitFootnote = true;
		}
		const rateValues = getRates(rate);
		return [
			style.bold(displayCode),
			rate.name,
			fmtRate(style, rateValues.tts),
			fmtRate(style, rateValues.ttb),
			fmtRate(style, rateValues.ttm),
		];
	});

	const sections = [
		style.bold(monthString),
		'',
		style.dim('Month-End'),
		formatTable(rateColumns, buildRows(rate => rate.monthEnd), style),
		'',
		style.dim('Monthly Average'),
		formatTable(rateColumns, buildRows(rate => rate.monthlyAverage), style),
	];

	if (hasUnitFootnote) {
		sections.push('', style.dim('* per 100 units'));
	}

	const localEntries = Object.entries(result.localMarketRates);
	if (localEntries.length > 0) {
		const localColumns = [
			{ header: 'Code' },
			{
				header: 'Selling',
				align: 'right' as const,
			},
			{
				header: 'Buying',
				align: 'right' as const,
			},
			{ header: 'Source' },
		];
		const localRows = localEntries.map(([code, rate]) => [
			style.bold(code),
			fmtRate(style, rate.selling, 4),
			fmtRate(style, rate.buying, 4),
			rate.source,
		]);
		sections.push('', style.dim('Local Market Rates'), formatTable(localColumns, localRows, style));
	}

	return sections.join('\n');
};

export const formatYearly = (result: YearlyResult, style: Ansis): string => {
	let hasUnitFootnote = false;

	const buildRows = (
		getRates: (rate: YearlyResult['rates'][string]) => { tts: number | null;
			ttb: number | null;
			ttm: number | null; },
	) => Object.entries(result.rates).map(([code, rate]) => {
		const displayCode = rate.unit === 100 ? `${code}*` : code;
		if (rate.unit === 100) {
			hasUnitFootnote = true;
		}
		const rateValues = getRates(rate);
		return [
			style.bold(displayCode),
			rate.name,
			fmtRate(style, rateValues.tts),
			fmtRate(style, rateValues.ttb),
			fmtRate(style, rateValues.ttm),
		];
	});

	const sections = [
		style.bold(String(result.year)),
		'',
		style.dim('Year-End'),
		formatTable(rateColumns, buildRows(rate => rate.yearEnd), style),
		'',
		style.dim('Yearly Average'),
		formatTable(rateColumns, buildRows(rate => rate.yearlyAverage), style),
	];

	if (hasUnitFootnote) {
		sections.push('', style.dim('* per 100 units'));
	}

	return sections.join('\n');
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatReference = (result: ReferenceResult, style: Ansis): string => {
	const summaryColumns = [
		{ header: 'Month' },
		{
			header: 'High',
			align: 'right' as const,
		},
		{
			header: 'Low',
			align: 'right' as const,
		},
		{
			header: 'Average',
			align: 'right' as const,
		},
	];

	const sections: string[] = [style.bold(String(result.year))];

	for (const [code, currency] of Object.entries(result.currencies)) {
		if (currency.monthlySummary.length === 0) { continue; }

		const rows = currency.monthlySummary.map(summary => [
			monthNames[summary.month - 1],
			fmtRate(style, summary.high, 4),
			fmtRate(style, summary.low, 4),
			fmtRate(style, summary.average, 4),
		]);

		sections.push(
			'',
			style.dim(`${code} — ${currency.sourceJa}`),
			formatTable(summaryColumns, rows, style),
		);
	}

	return sections.join('\n');
};

const regionKeys = ['asia', 'africa', 'europe', 'mideast', 'americas'] as const;

const worldColumns = [
	{ header: 'Country' },
	{ header: 'Code' },
	{ header: 'Market Level' },
];

export const formatWorld = (result: WorldResult, style: Ansis): string => {
	const sections: string[] = [style.bold(result.date)];

	for (const key of regionKeys) {
		const entries = result[key];
		if (entries.length === 0) {
			continue;
		}

		const label = key.charAt(0).toUpperCase() + key.slice(1);
		const rows = entries.map(entry => [
			entry.country,
			entry.code,
			entry.marketLevel || style.dim('—'),
		]);

		sections.push(
			'',
			style.dim(`${label} (${entries.length})`),
			formatTable(worldColumns, rows, style),
		);
	}

	return sections.join('\n');
};

export const formatArchive = (result: ArchiveResult, style: Ansis): string => {
	const columns = [
		{ header: 'Code' },
		{
			header: 'High',
			align: 'right' as const,
		},
		{
			header: 'Low',
			align: 'right' as const,
		},
		{
			header: 'Average',
			align: 'right' as const,
		},
	];

	const rows = Object.entries(result.currencies).map(([code, currency]) => {
		const { high, low, average } = currency.annual;
		const isEmpty = high === 0 && low === 0 && average === 0;
		return [
			style.bold(code),
			isEmpty ? style.dim('—') : high.toFixed(2),
			isEmpty ? style.dim('—') : low.toFixed(2),
			isEmpty ? style.dim('—') : average.toFixed(2),
		];
	});

	return [
		style.bold(String(result.year)),
		'',
		formatTable(columns, rows, style),
	].join('\n');
};
