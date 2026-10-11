import type { WorkBook } from 'xlsx';
import {
	fetchXls, getSheet, sheetToRows, type CellValue, type Row,
} from './parse-xls.ts';
import type {
	ReferenceDailyRate, ReferenceMonthlySummary, ReferenceCurrency, ReferenceResult,
} from './types.ts';

type CurrencyConfig = {
	code: string;
	sourceColumn: number;
	perUsd?: {
		ttsColumn: number;
		ttbColumn: number;
	};
	perJpy?: {
		ttsColumn: number;
		ttbColumn: number;
	};
};

// Group A: CNY, TWD, MYR — rates per USD and per JPY
const groupAConfig: CurrencyConfig[] = [
	{
		code: 'CNY',
		sourceColumn: 2,
		// CNY has a single rate (no TTS/TTB split), stored in same column for both
		perUsd: {
			ttsColumn: 2,
			ttbColumn: 2,
		},
		perJpy: {
			ttsColumn: 3,
			ttbColumn: 3,
		},
	},
	{
		code: 'TWD',
		sourceColumn: 4,
		perUsd: {
			ttsColumn: 4,
			ttbColumn: 5,
		},
		perJpy: {
			ttsColumn: 6,
			ttbColumn: 7,
		},
	},
	{
		code: 'MYR',
		sourceColumn: 8,
		perUsd: {
			ttsColumn: 8,
			ttbColumn: 9,
		},
		perJpy: {
			ttsColumn: 10,
			ttbColumn: 11,
		},
	},
];

// Group B: KRW, IDR, BRL, ARS, CLP — rates per USD only
const groupBConfig: CurrencyConfig[] = [
	{
		code: 'KRW',
		sourceColumn: 2,
		perUsd: {
			ttsColumn: 2,
			ttbColumn: 3,
		},
	},
	{
		code: 'IDR',
		sourceColumn: 4,
		perUsd: {
			ttsColumn: 4,
			ttbColumn: 5,
		},
	},
	{
		code: 'BRL',
		sourceColumn: 6,
		perUsd: {
			ttsColumn: 6,
			ttbColumn: 7,
		},
	},
	{
		code: 'ARS',
		sourceColumn: 8,
		perUsd: {
			ttsColumn: 8,
			ttbColumn: 9,
		},
	},
	{
		code: 'CLP',
		sourceColumn: 10,
		// CLP has a single Interbank average — same column for TTS and TTB
		perUsd: {
			ttsColumn: 10,
			ttbColumn: 10,
		},
	},
];

const monthSheetNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const asNumber = (value: CellValue): number | null => {
	if (typeof value === 'number') {
		return value;
	}
	return null;
};

const parseSourceJa = (rows: Row[], config: CurrencyConfig): string => {
	const headerRow = rows[1];
	if (!headerRow) {
		return '';
	}
	const raw = headerRow[config.sourceColumn];
	if (typeof raw === 'string') {
		return raw.replaceAll('\n', ' ').trim();
	}
	return '';
};

const parseDailyRates = (
	rows: Row[],
	year: number,
	month: number,
	ttsColumn: number,
	ttbColumn: number,
): ReferenceDailyRate[] => {
	const rates: ReferenceDailyRate[] = [];
	for (const row of rows) {
		const day = row[0];
		if (typeof day !== 'number' || day < 1 || day > 31) {
			continue;
		}
		const tts = asNumber(row[ttsColumn]);
		const ttb = asNumber(row[ttbColumn]);
		if (tts === null && ttb === null) {
			continue;
		}
		const monthString = String(month).padStart(2, '0');
		const dayString = String(day).padStart(2, '0');
		rates.push({
			date: `${year}-${monthString}-${dayString}`,
			tts,
			ttb,
		});
	}
	return rates;
};

const parseMonthlySummary = (
	rows: Row[],
	ttsColumn: number,
): { high: number | null;
	low: number | null;
	average: number | null; } => {
	let high: number | null = null;
	let low: number | null = null;
	let average: number | null = null;

	for (const row of rows) {
		const label = row[0];
		if (typeof label !== 'string') {
			continue;
		}
		switch (label) {
			case '最高値': {
				high = asNumber(row[ttsColumn]);

				break;
			}
			case '最安値': {
				low = asNumber(row[ttsColumn]);

				break;
			}
			case '平均値': {
				average = asNumber(row[ttsColumn]);

				break;
			}
			default: {
				break;
			}
		}
	}

	return {
		high,
		low,
		average,
	};
};

const parseMonthSheets = (workbook: WorkBook): (Row[] | null)[] => {
	const sheets: (Row[] | null)[] = [];
	for (const sheetName of monthSheetNames) {
		const sheet = workbook.Sheets[sheetName];
		sheets.push(sheet ? sheetToRows(sheet) : null);
	}
	return sheets;
};

const processAllCurrencies = (
	monthRows: (Row[] | null)[],
	year: number,
	configs: CurrencyConfig[],
	firstSheetRows: Row[],
): Record<string, ReferenceCurrency> => {
	// Initialize accumulators for each currency
	const accumulators = configs.map(config => ({
		config,
		sourceJa: parseSourceJa(firstSheetRows, config),
		perUsdRates: [] as ReferenceDailyRate[],
		perJpyRates: [] as ReferenceDailyRate[],
		monthlySummary: [] as ReferenceMonthlySummary[],
	}));

	// Single pass: iterate months in outer loop, currencies in inner loop
	for (let month = 1; month <= 12; month += 1) {
		const rows = monthRows[month - 1];
		if (!rows) {
			continue;
		}

		for (const accumulator of accumulators) {
			const { config } = accumulator;

			if (config.perUsd) {
				const { ttsColumn, ttbColumn } = config.perUsd;
				accumulator.perUsdRates.push(
					...parseDailyRates(rows, year, month, ttsColumn, ttbColumn),
				);
			}

			if (config.perJpy) {
				const { ttsColumn, ttbColumn } = config.perJpy;
				accumulator.perJpyRates.push(
					...parseDailyRates(rows, year, month, ttsColumn, ttbColumn),
				);
			}

			const summaryColumn = config.perUsd?.ttsColumn ?? config.perJpy?.ttsColumn ?? 2;
			const summary = parseMonthlySummary(rows, summaryColumn);
			if (summary.high !== null || summary.low !== null || summary.average !== null) {
				accumulator.monthlySummary.push({
					month,
					...summary,
				});
			}
		}
	}

	// Build result
	const currencies: Record<string, ReferenceCurrency> = {};
	for (const accumulator of accumulators) {
		const rates: ReferenceCurrency['rates'] = {};
		if (accumulator.perUsdRates.length > 0) {
			rates.perUsd = accumulator.perUsdRates;
		}
		if (accumulator.perJpyRates.length > 0) {
			rates.perJpy = accumulator.perJpyRates;
		}
		currencies[accumulator.config.code] = {
			sourceJa: accumulator.sourceJa,
			rates,
			monthlySummary: accumulator.monthlySummary,
		};
	}
	return currencies;
};

const tryFetchXls = async (url: string): Promise<WorkBook | null> => {
	try {
		return await fetchXls(url);
	} catch (error) {
		// 404: file doesn't exist for this year (e.g., b_2007.xls)
		if (error instanceof Error && error.message.includes('HTTP 404')) {
			return null;
		}
		throw error;
	}
};

export const fetchReference = async (year: number): Promise<ReferenceResult | null> => {
	const urlA = `https://www.murc-kawasesouba.jp/fx/ref_rate/a_${year}.xls`;
	const urlB = `https://www.murc-kawasesouba.jp/fx/ref_rate/b_${year}.xls`;

	const [workbookA, workbookB] = await Promise.all([
		tryFetchXls(urlA),
		tryFetchXls(urlB),
	]);

	if (!workbookA && !workbookB) {
		return null;
	}

	const source: string[] = [];
	let currencies: Record<string, ReferenceCurrency> = {};

	if (workbookA) {
		source.push(urlA);
		const monthRows = parseMonthSheets(workbookA);
		const firstSheetRows = monthRows[0] ?? sheetToRows(getSheet(workbookA, monthSheetNames[0]!));
		currencies = {
			...currencies,
			...processAllCurrencies(monthRows, year, groupAConfig, firstSheetRows),
		};
	}

	if (workbookB) {
		source.push(urlB);
		const monthRows = parseMonthSheets(workbookB);
		const firstSheetRows = monthRows[0] ?? sheetToRows(getSheet(workbookB, monthSheetNames[0]!));
		currencies = {
			...currencies,
			...processAllCurrencies(monthRows, year, groupBConfig, firstSheetRows),
		};
	}

	return {
		source,
		year,
		currencies,
	};
};
