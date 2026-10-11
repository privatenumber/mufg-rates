import { parseHTML } from 'linkedom';
import type { YearlyRate, YearlyResult } from './types.ts';
import {
	parseRate, computeTtm, parseUnit, cleanCellText,
} from './utils.ts';
import { fetchShiftJisHtml } from './fetch-source.ts';

const columnsPerRow = 9;

const parseTable = (table: Element): Record<string, YearlyRate> => {
	const cells = Array.from(table.querySelectorAll('td'));
	const rates: Record<string, YearlyRate> = {};

	for (let i = 0; i + columnsPerRow <= cells.length; i += columnsPerRow) {
		const name = cleanCellText(cells[i].textContent ?? '');
		const nameJa = cleanCellText(cells[i + 1].textContent ?? '');
		const code = (cells[i + 2].textContent ?? '').trim();
		const unit = parseUnit(cells[i + 3].textContent ?? '');
		const yearEndTts = parseRate(cells[i + 4].textContent ?? '');
		const yearEndTtb = parseRate(cells[i + 5].textContent ?? '');
		const yearlyAverageTts = parseRate(cells[i + 6].textContent ?? '');
		const yearlyAverageTtb = parseRate(cells[i + 7].textContent ?? '');

		if (code) {
			rates[code] = {
				name,
				nameJa,
				unit,
				yearEnd: {
					tts: yearEndTts,
					ttb: yearEndTtb,
					ttm: computeTtm(yearEndTts, yearEndTtb),
				},
				yearlyAverage: {
					tts: yearlyAverageTts,
					ttb: yearlyAverageTtb,
					ttm: computeTtm(yearlyAverageTts, yearlyAverageTtb),
				},
			};
		}
	}

	return rates;
};

export const fetchYearly = async (year: number): Promise<YearlyResult | null> => {
	if (year < 2003) { return null; }

	const yearEndUrl = `https://www.murc-kawasesouba.jp/fx/yearend/index.php?id=${year}`;
	let html = await fetchShiftJisHtml(yearEndUrl);
	let source = yearEndUrl;

	if (!html) {
		// Fallback: year_average.php shows the most recently completed year.
		// Only use it if the requested year matches what the page actually contains.
		const yearAverageUrl = 'https://www.murc-kawasesouba.jp/fx/year_average.php';
		html = await fetchShiftJisHtml(yearAverageUrl);
		if (html) {
			source = yearAverageUrl;
			const { document } = parseHTML(html);
			const heading = document.querySelector('h2');
			const headingText = heading?.textContent ?? '';
			// Heading contains the year like "2025年末及び年間平均"
			if (!headingText.includes(String(year))) {
				return null;
			}
		}
	}

	if (!html) { return null; }

	const { document } = parseHTML(html);
	const table = document.querySelector('table.data-table7');
	if (!table) { return null; }

	const rates = parseTable(table);

	return {
		source,
		year,
		rates,
	};
};
