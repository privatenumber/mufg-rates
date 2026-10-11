import { Buffer } from 'node:buffer';
import * as XLSX from 'xlsx';

const monthKanji = '\u6708';
const monthlySheetName = `${monthKanji}\u6BCE`;
const monthlyHlaSheetName = `${monthKanji}\u6BCEHLA`;
const annualLabel = '\u5E74\u9593';
const highLabel = '\u9AD8\u5024';
const lowLabel = '\u5B89\u5024';
const averageLabel = '\u5E73\u5747';
const highestLabel = '\u6700\u9AD8\u5024';
const lowestLabel = '\u6700\u4F4E\u5024';
const minimumLabel = '\u6700\u5B89\u5024';
const averageValueLabel = '\u5E73\u5747\u5024';

const monthName = (month: number) => `${month}${monthKanji}`;

const urlFromFetchInput = (input: Parameters<typeof fetch>[0]) => {
	if (typeof input === 'string') {
		return input;
	}

	if (input instanceof URL) {
		return input.toString();
	}

	return input.url;
};

const cell = (value: string | number | null) => `<td>${value ?? ''}</td>`;

const table = (className: string, rows: (string | number | null)[][]) => (
	`<table class="${className}">${rows.map(row => `<tr>${row.map(cell).join('')}</tr>`).join('')}</table>`
);

const searchRows = (legacy = false): (string | number | null)[][] => {
	if (legacy) {
		return [
			['Synthetic Mark', 'Synthetic DEM', 'DEM', '61.00', '59.00', '60.00'],
			['US Dollar', 'Synthetic USD', 'USD', '105.00', '103.00', '104.00'],
		];
	}

	return [
		['US Dollar', 'Synthetic USD', 'USD', '105.00', '103.00', '104.00'],
		['Euro', 'Synthetic EUR', 'EUR', '205.00', '203.00', '204.00'],
		['Indian Rupee', 'Synthetic INR', 'INR', '3.50', '3.10', '3.30'],
		['Korean Won', 'Synthetic KRW', 'KRW', '11.00', '10.44', '10.72'],
		['Indonesian Rupiah', 'Synthetic IDR', 'IDR', '1.10', '0.86', '0.98'],
		['Malaysian Ringgit', 'Synthetic MYR', 'MYR', 'unquoted', 'unquoted', 'unquoted'],
	];
};

const legacyBelgianFrancRows = (): (string | number | null)[][] => [
	['Belgian Franc', '&#12505;&#12523;&#12462;&#12540;&#12539;&#12501;&#12521;&#12531;', '&#12467;&#12510;&#12540;&#12471;&#12515;&#12523;', '320.00', '300.00', '310.00'],
	['US Dollar', 'Synthetic USD', 'USD', '105.00', '103.00', '104.00'],
];

const dailyRows = (): (string | number | null)[][] => [
	['US Dollar', 'Synthetic USD', 'USD', '105.00', '103.00', ''],
	['Euro', 'Synthetic EUR', 'EUR', '205.00', '203.00', ''],
	['Indian Rupee', 'Synthetic INR', 'INR', '3.50', '3.10', ''],
	['Korean Won', 'Synthetic KRW', 'KRW', '11.00', '10.44', ''],
	['Indonesian Rupiah', 'Synthetic IDR', 'IDR', '1.10', '0.86', ''],
	['Malaysian Ringgit', 'Synthetic MYR', 'MYR', 'unquoted', 'unquoted', ''],
];

const cashRows = (): (string | number | null)[][] => [
	['Synthetic USD', 'USD', '110.00', '100.00'],
	['Synthetic EUR', 'EUR', '212.00', '196.00'],
];

const rateSummaryRows = (includeNewerCurrencies = true): (string | number | null)[][] => {
	const rows: (string | number | null)[][] = [
		['US Dollar', 'Synthetic USD', 'USD', '1unit', '105.00', '103.00', '104.50', '102.50', ''],
		['Euro', 'Synthetic EUR', 'EUR', '1unit', '205.00', '203.00', '204.50', '202.50', ''],
		['Korean Won', 'Synthetic KRW', 'KRW', '100unit', '11.00', '10.00', '10.80', '9.80', ''],
		['Indonesian Rupiah', 'Synthetic IDR', 'IDR', '100unit', '1.20', '1.00', '1.10', '0.90', ''],
		['Malaysian Ringgit', 'Synthetic MYR', 'MYR', '1unit', 'unquoted', 'unquoted', 'unquoted', 'unquoted', ''],
	];

	if (includeNewerCurrencies) {
		rows.push(['Turkish Lira', 'Synthetic TRY', 'TRY', '1unit', '5.20', '4.80', '5.10', '4.70', '']);
	}

	return rows;
};

const localMarketTable = () => `
	<table class="data-table7">
		<tr><td>Synthetic Taiwan</td><td>TWD Synthetic dollar</td><td>31.50</td><td>31.10</td><td>Synthetic Branch</td><td>Synthetic Source</td></tr>
		<tr><td>Synthetic China</td><td>CNY Synthetic yuan</td><td colspan="2">unquoted</td><td>Synthetic Center</td><td>Synthetic Source</td></tr>
	</table>
`;

const dailyHtml = (className = 'data-table7', includeCash = true) => (
	table(className, dailyRows())
	+ (includeCash ? table(className, cashRows()) : '')
);

const todayHtml = () => `
	<main>
		<h1>2026&#24180;5&#26376;18&#26085;</h1>
		${dailyHtml('data-table5')}
	</main>
`;

const monthlyHtml = () => `
	${table('data-table7', rateSummaryRows())}
	${localMarketTable()}
`;

const yearlyHtml = (year: number, includeNewerCurrencies = true) => `
	<h2>${year}&#24180; synthetic yearly rates</h2>
	${table('data-table7', rateSummaryRows(includeNewerCurrencies))}
`;

const worldHtml = () => {
	// These bytes decode as "2026年5月15日現在" under Shift_JIS.
	const bytes = Buffer.concat([
		Buffer.from('<html><body><p>2026', 'ascii'),
		Buffer.from([0x94, 0x4E, 0x35, 0x8C, 0x8E, 0x31, 0x35, 0x93, 0xFA, 0x8C, 0xBB, 0x8D, 0xDD]),
		Buffer.from('</p></body></html>', 'ascii'),
	]);
	return new Response(new Uint8Array(bytes));
};

const worldCsv = (region: string) => {
	const rows = [
		'Country,CountryJa,Currency,Code,Quotation,MarketLevel,Remarks',
		`Fictional ${region},&#12471;&#12531;&#12475;,Synthetic Currency,SYN,per USD,1.2345,uses &amp; entity`,
		`No Rate ${region},Synthetic no-rate,,,,"",No published local level`,
	];
	return new Response(`${rows.join('\n')}\n`);
};

type ArchiveCurrency = {
	code: string;
	label: string;
	base: number;
};

const archiveCurrencies = (year: number): ArchiveCurrency[] => {
	const currencies = [
		{
			code: 'USD',
			label: 'Synthetic Dollar (USD)',
			base: 100,
		},
		{
			code: 'KRW',
			label: 'Synthetic Won (KRW)',
			base: 10,
		},
	];

	if (year >= 2013) {
		currencies.push({
			code: 'TRY',
			label: 'Synthetic Lira (TRY)',
			base: 5,
		});
	}

	return currencies;
};

const excelSerial = (year: number, month: number, day: number) => {
	const epoch = Date.UTC(1900, 0, 1);
	const target = Date.UTC(year, month - 1, day);
	const serial = Math.floor((target - epoch) / 86_400_000) + 1;
	return serial >= 60 ? serial + 1 : serial;
};

const setTriplet = (
	row: (string | number | null)[],
	startColumn: number,
	tts: string | number,
	ttb: string | number,
	ttm: string | number,
) => {
	row[startColumn] = tts;
	row[startColumn + 1] = ttb;
	row[startColumn + 2] = ttm;
};

const archiveDataRows = (year: number, currencies: ArchiveCurrency[]) => {
	const header: (string | number | null)[] = [null, null];
	for (const [index, currency] of currencies.entries()) {
		header[2 + index * 3] = currency.label;
	}

	const rows: (string | number | null)[][] = [
		header,
		[],
		[],
	];

	for (const day of [6, 7, 8]) {
		const row: (string | number | null)[] = [excelSerial(year, 1, day), null];
		for (const [index, currency] of currencies.entries()) {
			const tts = currency.base + day / 100;
			const ttb = currency.base - 1 + day / 100;
			setTriplet(row, 2 + index * 3, tts, ttb, (tts + ttb) / 2);
		}
		rows.push(row);
	}

	return rows;
};

const monthlySummarySheetRows = (
	currencies: ArchiveCurrency[],
	oldLabels = false,
) => {
	const header: (string | number | null)[] = [null, null];
	for (const [index] of currencies.entries()) {
		setTriplet(header, 2 + index * 3, 'TTS', 'TTB', 'TTM');
	}

	const labels = oldLabels
		? {
			high: highestLabel,
			low: lowestLabel,
			average: averageValueLabel,
		}
		: {
			high: highLabel,
			low: lowLabel,
			average: averageLabel,
		};

	const rows: (string | number | null)[][] = [
		[],
		[],
		[],
		header,
	];

	const addSummaryRow = (
		month: number | null,
		label: string,
		offset: number,
	) => {
		const row: (string | number | null)[] = [month === null ? null : monthName(month), label];
		for (const [index, currency] of currencies.entries()) {
			const value = currency.base + offset + index / 10 + (month ?? 0) / 100;
			row[2 + index * 3 + 2] = value;
		}
		rows.push(row);
	};

	for (let month = 1; month <= 12; month += 1) {
		addSummaryRow(month, labels.high, 20);
		addSummaryRow(null, labels.low, 10);
		addSummaryRow(null, labels.average, 15);
	}

	const addAnnualRow = (label: string, offset: number, firstCell: string | null = null) => {
		const row: (string | number | null)[] = [firstCell, label];
		for (const [index, currency] of currencies.entries()) {
			row[2 + index * 3 + 2] = currency.base + offset + index / 10;
		}
		rows.push(row);
	};

	addAnnualRow(labels.high, 30, annualLabel);
	addAnnualRow(labels.low, 5);
	addAnnualRow(labels.average, 18);

	return rows;
};

const averageSheetRows = (year: number, currencies: ArchiveCurrency[]) => {
	const rows: (string | number | null)[][] = [
		[],
		[],
		[],
	];

	for (let month = 1; month <= 12; month += 1) {
		const row: (string | number | null)[] = [excelSerial(year, month, 1)];
		for (const [index, currency] of currencies.entries()) {
			row[1 + index * 3 + 2] = currency.base + month / 10;
		}
		rows.push(row);
	}

	for (const [label, offset] of [
		[`${annualLabel}${highLabel}`, 30],
		[`${annualLabel}${lowLabel}`, 5],
		[`${annualLabel}${averageLabel}`, 18],
	] as const) {
		const row: (string | number | null)[] = [label];
		for (const [index, currency] of currencies.entries()) {
			row[1 + index * 3 + 2] = currency.base + offset + index / 10;
		}
		rows.push(row);
	}

	return rows;
};

const appendSheet = (
	workbook: XLSX.WorkBook,
	name: string,
	rows: (string | number | null)[][],
) => {
	XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
};

const writeWorkbook = (workbook: XLSX.WorkBook) => (
	new Uint8Array(XLSX.write(workbook, {
		type: 'buffer',
		bookType: 'biff8',
	}) as Buffer)
);

const cryptoApiMarkerWorkbook = () => {
	const cfb = XLSX.CFB.utils.cfb_new();
	const workbookStream = Buffer.from([
		// BOF record
		0x09,
		0x08,
		0x00,
		0x00,
		// FilePass record
		0x2F,
		0x00,
		0x04,
		0x00,
		// major version 4 => RC4 CryptoAPI
		0x00,
		0x00,
		0x04,
		0x00,
	]);

	XLSX.CFB.utils.cfb_add(cfb, 'Workbook', workbookStream);
	return new Response(new Uint8Array(XLSX.CFB.write(cfb) as Buffer));
};

const archiveWorkbook = (year: number) => {
	const workbook = XLSX.utils.book_new();
	const currencies = archiveCurrencies(year);
	appendSheet(workbook, 'data', archiveDataRows(year, currencies));

	if (year === 2001) {
		appendSheet(workbook, 'average', averageSheetRows(year, currencies));
	} else if (year < 2010) {
		appendSheet(workbook, monthlyHlaSheetName, monthlySummarySheetRows(currencies, true));
	} else {
		appendSheet(workbook, monthlySheetName, monthlySummarySheetRows(currencies));
	}

	return new Response(writeWorkbook(workbook));
};

type ReferenceConfig = {
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

const referenceGroupA: ReferenceConfig[] = [
	{
		code: 'CNY',
		sourceColumn: 2,
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

const referenceGroupB: ReferenceConfig[] = [
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
		perUsd: {
			ttsColumn: 10,
			ttbColumn: 10,
		},
	},
];

const setReferenceRate = (
	row: (string | number | null)[],
	config: ReferenceConfig,
	base: number,
) => {
	if (config.perUsd) {
		row[config.perUsd.ttsColumn] = base + 0.2;
		row[config.perUsd.ttbColumn] = base - 0.2;
	}
	if (config.perJpy) {
		row[config.perJpy.ttsColumn] = base / 100 + 0.02;
		row[config.perJpy.ttbColumn] = base / 100 - 0.02;
	}
};

const referenceMonthRows = (
	configs: ReferenceConfig[],
	month: number,
) => {
	const sourceRow: (string | number | null)[] = [];
	for (const config of configs) {
		sourceRow[config.sourceColumn] = `Synthetic ${config.code} Source`;
	}

	const rows: (string | number | null)[][] = [
		[],
		sourceRow,
	];

	for (const day of [1, 2]) {
		const row: (string | number | null)[] = [day];
		for (const [index, config] of configs.entries()) {
			setReferenceRate(row, config, 20 + month + day + index);
		}
		rows.push(row);
	}

	for (const [label, offset] of [
		[highestLabel, 10],
		[minimumLabel, 1],
		[averageValueLabel, 5],
	] as const) {
		const row: (string | number | null)[] = [label];
		for (const [index, config] of configs.entries()) {
			row[config.perUsd?.ttsColumn ?? config.perJpy?.ttsColumn ?? 2] = 20 + month + offset + index;
		}
		rows.push(row);
	}

	return rows;
};

const referenceWorkbook = (group: 'a' | 'b') => {
	const workbook = XLSX.utils.book_new();
	const configs = group === 'a' ? referenceGroupA : referenceGroupB;

	for (let month = 1; month <= 12; month += 1) {
		appendSheet(workbook, monthName(month), referenceMonthRows(configs, month));
	}

	return new Response(writeWorkbook(workbook));
};

export const createFixtureFetch = (): typeof fetch => async (input) => {
	const url = urlFromFetchInput(input);

	if (url === 'https://synthetic.local/cryptoapi.xls') {
		return cryptoApiMarkerWorkbook();
	}

	if (url.includes('past_3month_result.php?y=2025&m=1&d=6')) {
		return new Response(table('data-table5', searchRows()));
	}
	if (url.includes('past_3month_result.php?y=2025&m=1&d=7')) {
		return new Response(null, { status: 500 });
	}
	if (url.includes('past_3month_result.php?y=2025&m=1&d=4')
		|| url.includes('past_3month_result.php?y=2025&m=1&d=3')
		|| url.includes('past_3month_result.php?y=2025&m=1&d=2')
		|| url.includes('past_3month_result.php?y=2025&m=1&d=1')
		|| url.includes('past_3month_result.php?y=2024&m=12&d=31')) {
		return new Response(null, { status: 302 });
	}
	if (url.includes('past_3month_result.php?y=2024&m=12&d=30')) {
		return new Response(table('data-table5', searchRows()));
	}
	if (url.includes('past_3month_result.php?y=1990&m=1&d=4')) {
		return new Response(table('data-table5', searchRows(true)));
	}
	if (url.includes('past_3month_result.php?y=1994&m=1&d=5')) {
		return new Response(table('data-table5', legacyBelgianFrancRows()));
	}

	if (url.includes('past/index.php?id=250106')) {
		return new Response(dailyHtml());
	}
	if (url.includes('past/index.php?id=250104')
		|| url.includes('past/index.php?id=250103')
		|| url.includes('past/index.php?id=250102')
		|| url.includes('past/index.php?id=250101')
		|| url.includes('past/index.php?id=241231')) {
		return new Response(null, { status: 302 });
	}
	if (url.includes('past/index.php?id=241230')) {
		return new Response(dailyHtml());
	}
	if (url.includes('past/index.php?id=060104')) {
		return new Response(dailyHtml('data-table7', false));
	}
	if (url.includes('fx/index.php')) {
		return new Response(todayHtml());
	}

	if (url.includes('monthend/index.php?id=2601')) {
		return new Response(monthlyHtml());
	}
	if (url.includes('monthend/index.php?id=0401')) {
		return new Response(null, { status: 302 });
	}

	if (url.includes('yearend/index.php?id=2024')) {
		return new Response(yearlyHtml(2024));
	}
	if (url.includes('yearend/index.php?id=2025')
		|| url.includes('yearend/index.php?id=2002')
		|| url.includes('yearend/index.php?id=2026')
		|| url.includes('yearend/index.php?id=2030')) {
		return new Response(null, { status: 302 });
	}
	if (url.includes('yearend/index.php?id=2003')) {
		return new Response(yearlyHtml(2003, false));
	}
	if (url.includes('year_average.php')) {
		return new Response(yearlyHtml(2025));
	}

	if (url.includes('world.html')) {
		return worldHtml();
	}
	for (const region of ['asia', 'africa', 'europe', 'mideast', 'america']) {
		if (url.includes(`worlddata/${region}.csv`)) {
			return worldCsv(region);
		}
	}

	const archiveMatch = url.match(/xls\/murc_(\d{4})\.xls/);
	if (archiveMatch) {
		return archiveWorkbook(Number(archiveMatch[1]));
	}

	const referenceMatch = url.match(/ref_rate\/([ab])_(\d{4})\.xls/);
	if (referenceMatch) {
		const [, group, yearText] = referenceMatch;
		const year = Number(yearText);
		if (year < 2021 || year > 2025) {
			return new Response(null, { status: 404 });
		}
		return referenceWorkbook(group as 'a' | 'b');
	}

	throw new Error(
		`[fixture-source-fetch] No synthetic fixture mapped for URL: ${url}\nAdd a mapping in tests/helpers/fixture-source-fetch.ts`,
	);
};
