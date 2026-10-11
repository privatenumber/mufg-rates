import { parseHTML } from 'linkedom';
import type { MonthlyRate, LocalMarketRate, MonthlyResult } from './types.ts';
import {
	parseRate, computeTtm, parseUnit, cleanCellText,
} from './utils.ts';
import { fetchShiftJisHtml } from './fetch-source.ts';

const mainColumnsPerRow = 9;

const extractCurrencyCode = (text: string): string => {
	const match = text.match(/^([A-Z]{3})/);
	return match ? match[1] : text.trim();
};

const parseMainTable = (table: Element): Record<string, MonthlyRate> => {
	const cells = Array.from(table.querySelectorAll('td'));
	const rates: Record<string, MonthlyRate> = {};

	for (let i = 0; i + mainColumnsPerRow <= cells.length; i += mainColumnsPerRow) {
		const name = cleanCellText(cells[i].textContent ?? '');
		const nameJa = cleanCellText(cells[i + 1].textContent ?? '');
		const code = (cells[i + 2].textContent ?? '').trim();
		const unit = parseUnit(cells[i + 3].textContent ?? '');
		const monthEndTts = parseRate(cells[i + 4].textContent ?? '');
		const monthEndTtb = parseRate(cells[i + 5].textContent ?? '');
		const monthlyAverageTts = parseRate(cells[i + 6].textContent ?? '');
		const monthlyAverageTtb = parseRate(cells[i + 7].textContent ?? '');

		if (code) {
			rates[code] = {
				name,
				nameJa,
				unit,
				monthEnd: {
					tts: monthEndTts,
					ttb: monthEndTtb,
					ttm: computeTtm(monthEndTts, monthEndTtb),
				},
				monthlyAverage: {
					tts: monthlyAverageTts,
					ttb: monthlyAverageTtb,
					ttm: computeTtm(monthlyAverageTts, monthlyAverageTtb),
				},
			};
		}
	}

	return rates;
};

const parseLocalMarketTable = (table: Element): Record<string, LocalMarketRate> => {
	const localRates: Record<string, LocalMarketRate> = {};
	const rows = Array.from(table.querySelectorAll('tr'));

	for (const row of rows) {
		const cells = Array.from(row.querySelectorAll('td'));
		if (cells.length === 0) { continue; }

		const hasColspan = cells.some(cell => cell.getAttribute('colspan'));

		if (hasColspan && cells.length === 5) {
			// colspan="2" merges selling/buying into one cell
			const nameJa = (cells[0].textContent ?? '').trim();
			const currencyText = (cells[1].textContent ?? '').trim();
			const code = extractCurrencyCode(currencyText);
			const sourceJa = (cells[3].textContent ?? '').trim();
			const source = (cells[4].textContent ?? '').trim();

			localRates[code] = {
				nameJa,
				name: currencyText,
				selling: null,
				buying: null,
				sourceJa,
				source,
			};
		} else if (cells.length === 6) {
			const nameJa = (cells[0].textContent ?? '').trim();
			const currencyText = (cells[1].textContent ?? '').trim();
			const code = extractCurrencyCode(currencyText);
			const selling = parseRate(cells[2].textContent ?? '');
			const buying = parseRate(cells[3].textContent ?? '');
			const sourceJa = (cells[4].textContent ?? '').trim();
			const source = (cells[5].textContent ?? '').trim();

			localRates[code] = {
				nameJa,
				name: currencyText,
				selling,
				buying,
				sourceJa,
				source,
			};
		}
	}

	return localRates;
};

export const fetchMonthly = async (year: number, month: number): Promise<MonthlyResult | null> => {
	const yearSuffix = (year % 100).toString().padStart(2, '0');
	const monthPadded = month.toString().padStart(2, '0');
	const id = `${yearSuffix}${monthPadded}`;

	const url = `https://www.murc-kawasesouba.jp/fx/monthend/index.php?id=${id}`;
	const html = await fetchShiftJisHtml(url);
	if (!html) { return null; }

	const { document } = parseHTML(html);
	const tables = Array.from(document.querySelectorAll('table.data-table7'));

	const mainTable = tables[0];
	if (!mainTable) { return null; }

	const rates = parseMainTable(mainTable);

	let localMarketRates: Record<string, LocalMarketRate> = {};
	for (let i = 1; i < tables.length; i += 1) {
		const parsed = parseLocalMarketTable(tables[i]);
		localMarketRates = {
			...localMarketRates,
			...parsed,
		};
	}

	return {
		source: url,
		year,
		month,
		rates,
		localMarketRates,
	};
};
