import { fetchShiftJisHtml, fetchSource } from './fetch-source.ts';
import type { WorldRate, WorldResult } from './types.ts';

const baseUrl = 'https://www.murc-kawasesouba.jp/fx/worlddata/';

const regionFiles = ['asia', 'africa', 'europe', 'mideast', 'america'] as const;

const parseCsvRow = (line: string): string[] => {
	const fields: string[] = [];
	let current = '';
	let inQuotes = false;

	for (const character of line) {
		if (inQuotes) {
			if (character === '"') {
				inQuotes = false;
			} else {
				current += character;
			}
		} else if (character === '"') {
			inQuotes = true;
		} else if (character === ',') {
			fields.push(current.trim());
			current = '';
		} else {
			current += character;
		}
	}

	fields.push(current.trim());
	return fields;
};

const parseCsv = (text: string): WorldRate[] => {
	const lines = text.split('\n').filter(line => line.trim().length > 0);

	// Skip header row
	// The CSVs contain HTML <br> tags and &yen; entities from the source page.
	// Strip them since this is a programmatic API, not an HTML renderer.
	const cleanHtml = (html: string) => html
		.replaceAll('<br>', ' ')
		.replaceAll(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
		.replaceAll('&yen;', '¥')
		.replaceAll('&reg;', '')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&amp;', '&') // must be last (other entities contain &)
		.trim();

	return lines.slice(1).map((line) => {
		const fields = parseCsvRow(line);
		return {
			country: cleanHtml(fields[0] ?? ''),
			countryJa: cleanHtml(fields[1] ?? ''),
			currency: cleanHtml(fields[2] ?? ''),
			code: cleanHtml(fields[3] ?? ''),
			quotation: cleanHtml(fields[4] ?? ''),
			marketLevel: cleanHtml(fields[5] ?? ''),
			remarks: cleanHtml(fields[6] ?? ''),
		};
	});
};

const fetchCsv = async (filename: string): Promise<WorldRate[]> => {
	const response = await fetchSource(`${baseUrl}${filename}.csv`);
	if (response.status < 200 || response.status >= 300) {
		throw new Error(`Failed to fetch ${filename}.csv (HTTP ${response.status})`);
	}
	const buffer = await response.arrayBuffer();
	const text = new TextDecoder('shift_jis').decode(buffer);
	return parseCsv(text);
};

const parseDateFromText = (text: string): string => {
	// The page has multiple dates (old maintenance notices, commented-out SDR notes).
	// The actual data date is followed by '現在' ("as of").
	const match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日[）)\s]*現在/);
	if (!match) {
		// Fallback: last date on the page (most likely the data date)
		const allDates = [...text.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日/g)];
		const last = allDates.at(-1);
		if (!last) {
			throw new Error('Could not extract date from world page');
		}
		const [, year, month, day] = last;
		return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
	}
	const [, year, month, day] = match;
	return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

export const fetchWorld = async (): Promise<WorldResult> => {
	const html = await fetchShiftJisHtml('https://www.murc-kawasesouba.jp/fx/world.html');
	if (!html) {
		throw new Error('Failed to fetch world page');
	}

	const date = parseDateFromText(html);

	const [asia, africa, europe, mideast, americas] = await Promise.all(
		regionFiles.map(region => fetchCsv(region)),
	);

	return {
		source: 'https://www.murc-kawasesouba.jp/fx/world.html',
		date,
		asia,
		africa,
		europe,
		mideast,
		americas,
	};
};
