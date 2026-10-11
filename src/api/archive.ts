import {
	parseXlsBuffer, getSheet, sheetToRows, excelDateToIso, type Row, type XlsInput,
} from './parse-xls.ts';
import { fetchSource } from './fetch-source.ts';
import type {
	ArchiveDailyRate, ArchiveMonthlySummary, ArchiveAnnualSummary, ArchiveCurrency, ArchiveResult,
} from './types.ts';

type CurrencyInfo = {
	code: string;
	ttsColumn: number;
};

export type ParseArchiveWorkbookOptions = {
	sourceUrl?: string;
};

const validateArchiveYear = (year: number): void => {
	if (!Number.isInteger(year) || year < 1990) {
		throw new Error(`Invalid archive year: ${year} (expected an integer from 1990)`);
	}
};

export const getArchiveSourceUrl = (year: number): string => {
	validateArchiveYear(year);
	return `https://www.murc-kawasesouba.jp/fx/xls/murc_${year}.xls`;
};

export const downloadArchiveSource = async (year: number): Promise<ArrayBuffer> => {
	const url = getArchiveSourceUrl(year);
	const response = await fetchSource(url);
	if (response.status < 200 || response.status >= 300) {
		throw new Error(`HTTP ${response.status}: ${url}`);
	}
	return response.arrayBuffer();
};

const parseCurrencyList = (headerRow: Row): CurrencyInfo[] => {
	const currencies: CurrencyInfo[] = [];
	for (let column = 2; column < headerRow.length; column += 3) {
		const cell = headerRow[column];
		if (typeof cell !== 'string' || !cell.trim()) {
			continue;
		}
		const match = cell.match(/[（(]([A-Z]{3})[）)]/);
		if (match) {
			currencies.push({
				code: match[1]!,
				ttsColumn: column,
			});
		}
	}
	return currencies;
};

const parseDailyData = (
	rows: Row[],
	currencies: CurrencyInfo[],
): Map<string, ArchiveDailyRate[]> => {
	const dailyMap = new Map<string, ArchiveDailyRate[]>();
	for (const currency of currencies) {
		dailyMap.set(currency.code, []);
	}

	for (let rowIndex = 3; rowIndex < rows.length; rowIndex += 1) {
		const row = rows[rowIndex]!;
		const dateSerial = row[0];

		// Skip non-data rows (summary rows have string labels, empty rows have null)
		if (typeof dateSerial !== 'number') {
			continue;
		}

		// Skip weekends/holidays — check if first currency (USD) has rate data
		const firstTts = row[2];
		if (typeof firstTts !== 'number') {
			continue;
		}

		const date = excelDateToIso(dateSerial);

		for (const currency of currencies) {
			const tts = row[currency.ttsColumn];
			const ttb = row[currency.ttsColumn + 1];
			const ttm = row[currency.ttsColumn + 2];

			if (typeof tts !== 'number' || typeof ttb !== 'number' || typeof ttm !== 'number') {
				continue;
			}

			dailyMap.get(currency.code)!.push({
				date,
				tts,
				ttb,
				ttm,
			});
		}
	}

	return dailyMap;
};

const inferArchiveYear = (dailyMap: Map<string, ArchiveDailyRate[]>): number => {
	for (const dailyRates of dailyMap.values()) {
		const firstDate = dailyRates[0]?.date;
		if (firstDate) {
			const year = Number(firstDate.slice(0, 4));
			validateArchiveYear(year);
			return year;
		}
	}
	throw new Error('Could not infer archive year from workbook dates');
};

const parseSummaryLabel = (text: string): 'high' | 'low' | 'average' | null => {
	const label = text.replaceAll(/[※*]/gu, '');
	if (label === '高値' || label === '最高値') { return 'high'; }
	if (label === '安値' || label === '最低値') { return 'low'; }
	if (label === '平均' || label === '平均値') { return 'average'; }
	return null;
};

const extractRowValues = (
	row: Row,
	ttsPositions: number[],
	currencies: CurrencyInfo[],
): Map<string, number> => {
	const values = new Map<string, number>();
	for (let index = 0; index < currencies.length; index += 1) {
		const currency = currencies[index]!;
		const ttsColumn = ttsPositions[index];
		if (ttsColumn === undefined) {
			continue;
		}
		const ttmColumn = ttsColumn + 2;
		const value = row[ttmColumn];
		if (typeof value === 'number') {
			values.set(currency.code, value);
		}
	}
	return values;
};

const parseMonthlySummarySheet = (
	rows: Row[],
	ttsPositions: number[],
	currencies: CurrencyInfo[],
): { monthly: Map<string, ArchiveMonthlySummary[]>;
	annual: Map<string, ArchiveAnnualSummary>; } => {
	const monthlyMap = new Map<string, ArchiveMonthlySummary[]>();
	const annualMap = new Map<string, ArchiveAnnualSummary>();
	for (const currency of currencies) {
		monthlyMap.set(currency.code, []);
		annualMap.set(currency.code, {
			high: 0,
			low: 0,
			average: 0,
		});
	}

	// 月毎 sheet: rows are grouped by month (3 rows each: 高値, 安値, 平均)
	// then 3 annual rows: 年間 高値, 安値, 平均
	let currentMonth = 0;
	const monthHighs = new Map<string, number>();
	const monthLows = new Map<string, number>();
	const monthAverages = new Map<string, number>();

	for (const row of rows) {
		const cell0 = row[0];
		const cell1 = row[1];

		// Detect month label (e.g. "1月", "2月", ...)
		if (typeof cell0 === 'string') {
			const monthMatch = cell0.match(/^(\d{1,2})月$/);
			if (monthMatch) {
				currentMonth = Number(monthMatch[1]);
				monthHighs.clear();
				monthLows.clear();
				monthAverages.clear();
			}

			if (cell0 === '年間') {
				currentMonth = 0; // Annual section
				monthHighs.clear();
				monthLows.clear();
				monthAverages.clear();
			}
		}

		if (typeof cell1 !== 'string') {
			continue;
		}

		// Labels vary across eras:
		// - '高値'/'安値'/'平均' (2010+)
		// - '最高値'/'最低値'/'平均値' (2001-2009)
		// - '平均値※' (2009 annual — trailing ※ footnote marker)
		const summaryLabel = parseSummaryLabel(cell1);
		if (!summaryLabel) {
			continue;
		}

		const rowValues = extractRowValues(row, ttsPositions, currencies);

		if (summaryLabel === 'high') {
			for (const [code, value] of rowValues) {
				monthHighs.set(code, value);
			}
		} else if (summaryLabel === 'low') {
			for (const [code, value] of rowValues) {
				monthLows.set(code, value);
			}
		} else {
			for (const [code, value] of rowValues) {
				monthAverages.set(code, value);

				// When we have the average, we can emit the summary
				const high = monthHighs.get(code);
				const low = monthLows.get(code);

				if (currentMonth > 0 && high !== undefined && low !== undefined) {
					monthlyMap.get(code)!.push({
						month: currentMonth,
						high,
						low,
						average: value,
					});
				} else if (currentMonth === 0 && high !== undefined && low !== undefined) {
					annualMap.set(code, {
						high,
						low,
						average: value,
					});
				}
			}
		}
	}

	return {
		monthly: monthlyMap,
		annual: annualMap,
	};
};

const parseFuzzyLabel = (label: string): 'high' | 'low' | 'average' | null => {
	if (label.includes('平均')) { return 'average'; }
	if (label.includes('高')) { return 'high'; }
	if (label.includes('安')) { return 'low'; }
	return null;
};

const parseAverageAnnualSection = (
	rows: Row[],
	startIndex: number,
	ttsPositions: number[],
	currencies: CurrencyInfo[],
	annualMap: Map<string, ArchiveAnnualSummary>,
): void => {
	const annualHighMap = new Map<string, number>();
	const annualLowMap = new Map<string, number>();
	const annualAverageMap = new Map<string, number>();

	// Scan all annual summary rows
	for (let scanIndex = startIndex; scanIndex < rows.length; scanIndex += 1) {
		const scanRow = rows[scanIndex]!;
		const label = scanRow[0];
		if (typeof label !== 'string') {
			continue;
		}

		const fuzzyLabel = parseFuzzyLabel(label);
		if (!fuzzyLabel) {
			continue;
		}

		const rowValues = extractRowValues(scanRow, ttsPositions, currencies);
		const targetMaps = {
			average: annualAverageMap,
			high: annualHighMap,
			low: annualLowMap,
		};
		const targetMap = targetMaps[fuzzyLabel];

		for (const [code, value] of rowValues) {
			targetMap.set(code, value);
		}
	}

	for (const currency of currencies) {
		annualMap.set(currency.code, {
			high: annualHighMap.get(currency.code) ?? 0,
			low: annualLowMap.get(currency.code) ?? 0,
			average: annualAverageMap.get(currency.code) ?? 0,
		});
	}
};

const parseAverageSummarySheet = (
	rows: Row[],
	currencies: CurrencyInfo[],
): { monthly: Map<string, ArchiveMonthlySummary[]>;
	annual: Map<string, ArchiveAnnualSummary>; } => {
	const monthlyMap = new Map<string, ArchiveMonthlySummary[]>();
	const annualMap = new Map<string, ArchiveAnnualSummary>();
	for (const currency of currencies) {
		monthlyMap.set(currency.code, []);
		annualMap.set(currency.code, {
			high: 0,
			low: 0,
			average: 0,
		});
	}

	// TTS positions in average sheet: 1, 4, 7, 10, ... (every 3 starting at 1)
	// TTM is at TTS + 2
	const ttsPositions: number[] = [];
	for (let index = 0; index < currencies.length; index += 1) {
		ttsPositions.push(1 + index * 3);
	}

	// Rows 3-14: monthly averages (12 months)
	for (let rowIndex = 3; rowIndex < rows.length; rowIndex += 1) {
		const row = rows[rowIndex]!;
		const cell0 = row[0];

		if (typeof cell0 === 'number') {
			// Monthly average row — determine month from date serial
			const dateString = excelDateToIso(cell0);
			const month = Number(dateString.split('-')[1]);

			const rowValues = extractRowValues(row, ttsPositions, currencies);
			for (const [code, average] of rowValues) {
				monthlyMap.get(code)!.push({
					month,
					high: average,
					low: average,
					average,
				});
			}
		} else if (typeof cell0 === 'string') {
			parseAverageAnnualSection(rows, rowIndex, ttsPositions, currencies, annualMap);
			break;
		}
	}

	return {
		monthly: monthlyMap,
		annual: annualMap,
	};
};

export const parseArchiveWorkbook = async (
	input: XlsInput,
	options: ParseArchiveWorkbookOptions = {},
): Promise<ArchiveResult> => {
	const workbook = await parseXlsBuffer(input);

	// Parse data sheet for daily rates and currency list
	const dataSheet = getSheet(workbook, 'data');
	const dataRows = sheetToRows(dataSheet);
	const currencies = parseCurrencyList(dataRows[0]!);
	const dailyMap = parseDailyData(dataRows, currencies);
	const year = inferArchiveYear(dailyMap);

	// Parse summary sheet. Sheet names vary by era:
	// - '月毎' (2010+)
	// - '月毎HLA' (2002-2009 — some files use this variant)
	// - 'average' (1990-2000)
	const sheetNames = workbook.SheetNames;
	const monthlySheetName = sheetNames.find(
		name => name === '月毎' || name === '月毎HLA',
	);
	let summaryResult: { monthly: Map<string, ArchiveMonthlySummary[]>;
		annual: Map<string, ArchiveAnnualSummary>; };

	if (monthlySheetName) {
		const monthlySheet = getSheet(workbook, monthlySheetName);
		const monthlyRows = sheetToRows(monthlySheet);

		// TTS header row position varies: row 3 in most files, row 4 in 2001.
		// Find it dynamically by looking for a row containing 'TTS'.
		const headerIndex = monthlyRows.findIndex(
			row => row?.includes('TTS'),
		);
		const headerRow = monthlyRows[headerIndex === -1 ? 3 : headerIndex]!;
		const ttsPositions: number[] = [];
		for (let column = 0; column < headerRow.length; column += 1) {
			if (headerRow[column] === 'TTS') {
				ttsPositions.push(column);
			}
		}
		summaryResult = parseMonthlySummarySheet(monthlyRows, ttsPositions, currencies);
	} else {
		const averageSheet = getSheet(workbook, 'average');
		const averageRows = sheetToRows(averageSheet);
		summaryResult = parseAverageSummarySheet(averageRows, currencies);
	}

	const currencyRecords: Record<string, ArchiveCurrency> = {};
	for (const currency of currencies) {
		currencyRecords[currency.code] = {
			daily: dailyMap.get(currency.code) ?? [],
			monthly: summaryResult.monthly.get(currency.code) ?? [],
			annual: summaryResult.annual.get(currency.code) ?? {
				high: 0,
				low: 0,
				average: 0,
			},
		};
	}

	return {
		source: options.sourceUrl ?? getArchiveSourceUrl(year),
		year,
		currencies: currencyRecords,
	};
};
