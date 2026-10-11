import { parseHTML } from 'linkedom';
import type { DailyRate, CashRate, DailyResult } from './types.ts';
import {
	parseDate, formatDate, formatDateId, parseRate, computeTtm, cleanCellText,
} from './utils.ts';
import { fetchShiftJisHtml } from './fetch-source.ts';
import { getDailyRateUnit } from './rate-units.ts';

const mainColumnsPerRow = 6;
const cashColumnsPerRow = 4;

const parseMainTable = (table: Element, year: number): Record<string, DailyRate> => {
	const cells = Array.from(table.querySelectorAll('td'));
	const rates: Record<string, DailyRate> = {};

	for (let i = 0; i + mainColumnsPerRow <= cells.length; i += mainColumnsPerRow) {
		const name = cleanCellText(cells[i].textContent ?? '');
		const nameJa = cleanCellText(cells[i + 1].textContent ?? '');
		const code = (cells[i + 2].textContent ?? '').trim();
		const tts = parseRate(cells[i + 3].textContent ?? '');
		const ttb = parseRate(cells[i + 4].textContent ?? '');
		const ttm = computeTtm(tts, ttb);

		if (code) {
			rates[code] = {
				name,
				nameJa,
				unit: getDailyRateUnit(code, year),
				tts,
				ttb,
				ttm,
			};
		}
	}

	return rates;
};

const parseCashTable = (table: Element): Record<string, CashRate> => {
	const cells = Array.from(table.querySelectorAll('td'));
	const cashRates: Record<string, CashRate> = {};

	for (let i = 0; i + cashColumnsPerRow <= cells.length; i += cashColumnsPerRow) {
		const code = (cells[i + 1].textContent ?? '').trim();
		const selling = parseRate(cells[i + 2].textContent ?? '');
		const buying = parseRate(cells[i + 3].textContent ?? '');

		if (code && selling !== null && buying !== null) {
			cashRates[code] = {
				selling,
				buying,
			};
		}
	}

	return cashRates;
};

const parseDateFromHeading = (document: Document): string | null => {
	const text = document.body?.textContent ?? '';
	const match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
	if (!match) { return null; }
	const [, year, month, day] = match;
	return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const maxWalkbackDays = 10;

const fetchDailyForDate = async (date: Date): Promise<DailyResult | null> => {
	const url = `https://www.murc-kawasesouba.jp/fx/past/index.php?id=${formatDateId(date)}`;
	const html = await fetchShiftJisHtml(url);
	if (!html) { return null; }

	const { document } = parseHTML(html);
	const tables = document.querySelectorAll('table.data-table7');
	const altTables = document.querySelectorAll('table.data-table5');
	const allTables = tables.length > 0 ? tables : altTables;

	const mainTable = allTables[0];
	if (!mainTable) { return null; }

	return {
		source: url,
		date: formatDate(date),
		rates: parseMainTable(mainTable, date.getFullYear()),
		cashRates: allTables.length >= 2
			? parseCashTable(allTables[1])
			: {},
	};
};

/**
 * Fetch daily TTS/TTB rates and cash selling/buying rates.
 *
 * If the given date is a weekend or holiday (no published rates), automatically
 * walks back to the nearest preceding business day. This follows the standard
 * practice for Japanese tax filings per NTA guidance (所得税基本通達 57の3-2):
 * https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/11a/01.htm
 *
 * The result's `date` field reflects the actual business day used.
 * Call with no arguments to get today's rates.
 */
export const fetchDaily = async (
	date?: string | Date,
): Promise<DailyResult | null> => {
	if (!date) {
		const url = 'https://www.murc-kawasesouba.jp/fx/index.php';
		const html = await fetchShiftJisHtml(url);
		if (!html) { return null; }

		const { document } = parseHTML(html);
		const tables = document.querySelectorAll('table.data-table5');
		const mainTable = tables[0];
		if (!mainTable) { return null; }

		const resultDate = parseDateFromHeading(document) ?? formatDate(new Date());

		return {
			source: url,
			date: resultDate,
			rates: parseMainTable(mainTable, Number(resultDate.slice(0, 4))),
			cashRates: tables.length >= 2
				? parseCashTable(tables[1])
				: {},
		};
	}

	const parsed = parseDate(date);

	for (let attempt = 0; attempt < maxWalkbackDays; attempt += 1) {
		const target = new Date(parsed);
		target.setDate(target.getDate() - attempt);

		const result = await fetchDailyForDate(target);
		if (result) { return result; }
	}

	return null;
};
