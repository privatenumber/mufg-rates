import { describe, test, expect } from 'manten';
import { Ansis } from 'ansis';
import {
	formatRates, formatDaily, formatMonthly, formatYearly, formatWorld, formatReference,
	formatArchive, formatConversion,
} from '../src/cli/format.ts';

const noColor = new Ansis(0);

describe('formatters', () => {
	test('formatRates shows date header and currency table', () => {
		const output = formatRates({
			source: 'https://www.murc-kawasesouba.jp/fx/past_3month_result.php?y=2025&m=1&d=6',
			date: '2025-01-06',
			rates: {
				USD: {
					name: 'US Dollar',
					nameJa: 'Synthetic USD',
					unit: 1,
					tts: 105,
					ttb: 103,
					ttm: 104,
				},
				MYR: {
					name: 'Malaysian Ringgit',
					nameJa: 'Synthetic MYR',
					unit: 1,
					tts: null,
					ttb: null,
					ttm: null,
				},
			},
		}, noColor);
		expect(output).toContain('2025-01-06');
		expect(output).toContain('USD');
		expect(output).toContain('105.00');
		expect(output).toContain('—');
		expect(output).toContain('Code');
	});

	test('formatDaily includes cash rates section', () => {
		const output = formatDaily({
			source: 'https://www.murc-kawasesouba.jp/fx/past/index.php?id=20250106',
			date: '2025-01-06',
			rates: {
				USD: {
					name: 'US Dollar',
					nameJa: 'Synthetic USD',
					unit: 1,
					tts: 105,
					ttb: 103,
					ttm: 104,
				},
			},
			cashRates: {
				USD: {
					selling: 110,
					buying: 100,
				},
			},
		}, noColor);
		expect(output).toContain('Cash Rates');
		expect(output).toContain('110.00');
		expect(output).toContain('Selling');
	});

	test('formatDaily with empty cashRates omits section', () => {
		const output = formatDaily({
			source: 'https://www.murc-kawasesouba.jp/fx/past/index.php?id=20250106',
			date: '2025-01-06',
			rates: {
				USD: {
					name: 'US Dollar',
					nameJa: 'Synthetic USD',
					unit: 1,
					tts: 105,
					ttb: 103,
					ttm: 104,
				},
			},
			cashRates: {},
		}, noColor);
		expect(output).not.toContain('Cash Rates');
	});

	test('formatConversion shows amount, rate, date, and source', () => {
		const output = formatConversion({
			source: 'https://www.murc-kawasesouba.jp/fx/past_3month_result.php?y=2025&m=1&d=6',
			requestedDate: '2025-01-06',
			sourceDate: '2025-01-06',
			amount: 100,
			from: 'USD',
			to: 'JPY',
			rate: 'ttm',
			rateValue: 104,
			unit: 1,
			convertedAmount: 10_400,
		}, noColor);

		expect(output).toContain('100 USD = 10,400 JPY');
		expect(output).toContain('Rate: TTM 104.00 JPY per 1 USD');
		expect(output).toContain('Date: 2025-01-06');
		expect(output).toContain('Source: https://www.murc-kawasesouba.jp/fx/');
	});

	test('formatMonthly shows sections with unit footnote', () => {
		const output = formatMonthly({
			source: 'https://www.murc-kawasesouba.jp/fx/monthend/index.php?id=2602',
			year: 2026,
			month: 2,
			rates: {
				USD: {
					name: 'US Dollar',
					nameJa: 'Synthetic USD',
					unit: 1,
					monthEnd: {
						tts: 105,
						ttb: 103,
						ttm: 104,
					},
					monthlyAverage: {
						tts: 104.5,
						ttb: 102.5,
						ttm: 103.5,
					},
				},
				KRW: {
					name: 'Won',
					nameJa: 'Synthetic KRW',
					unit: 100,
					monthEnd: {
						tts: 11,
						ttb: 10,
						ttm: 10.5,
					},
					monthlyAverage: {
						tts: 10.8,
						ttb: 9.8,
						ttm: 10.3,
					},
				},
			},
			localMarketRates: {
				CNY: {
					nameJa: 'Synthetic CNY',
					name: 'CNY Synthetic yuan',
					selling: 6.5,
					buying: null,
					sourceJa: 'Synthetic Center',
					source: 'Synthetic Source',
				},
			},
		}, noColor);
		expect(output).toContain('2026-02');
		expect(output).toContain('Month-End');
		expect(output).toContain('Monthly Average');
		expect(output).toContain('KRW*');
		expect(output).toContain('* per 100 units');
		expect(output).toContain('Local Market Rates');
		expect(output).toContain('6.5000');
	});

	test('formatWorld shows regions with country tables', () => {
		const output = formatWorld({
			source: 'https://www.murc-kawasesouba.jp/fx/world.html',
			date: '2026-02-27',
			asia: [
				{
					country: 'Australia',
					countryJa: 'Synthetic Australia',
					currency: 'AUD',
					code: '$A',
					quotation: '',
					marketLevel: '1.4',
					remarks: '',
				},
				{
					country: 'Guam',
					countryJa: 'Synthetic Guam',
					currency: '',
					code: '',
					quotation: '',
					marketLevel: '',
					remarks: 'USD circulates',
				},
			],
			africa: [],
			europe: [
				{
					country: 'Euro',
					countryJa: 'Synthetic Euro',
					currency: 'EUR',
					code: 'Eur',
					quotation: '',
					marketLevel: '1.1816',
					remarks: '',
				},
			],
			mideast: [],
			americas: [],
		}, noColor);
		expect(output).toContain('2026-02-27');
		expect(output).toContain('Asia (2)');
		expect(output).toContain('Australia');
		expect(output).toContain('1.4');
		expect(output).toContain('—'); // Guam has empty marketLevel
		expect(output).toContain('Europe (1)');
		// Empty regions should be skipped
		expect(output).not.toContain('Africa');
		expect(output).not.toContain('Mideast');
		expect(output).not.toContain('Americas');
	});

	test('formatReference shows monthly summaries per currency', () => {
		const output = formatReference({
			source: ['https://www.murc-kawasesouba.jp/fx/ref_rate/a_2024.xls', 'https://www.murc-kawasesouba.jp/fx/ref_rate/b_2024.xls'],
			year: 2024,
			currencies: {
				CNY: {
					sourceJa: 'Synthetic CNY Source',
					rates: {
						perUsd: [],
						perJpy: [],
					},
					monthlySummary: [
						{
							month: 1,
							high: 7.5,
							low: 7.1,
							average: 7.3,
						},
						{
							month: 2,
							high: 7.6,
							low: 7.2,
							average: 7.4,
						},
					],
				},
				TWD: {
					sourceJa: 'Synthetic TWD Source',
					rates: { perUsd: [] },
					monthlySummary: [
						{
							month: 1,
							high: 31.6,
							low: 31.1,
							average: 31.3,
						},
					],
				},
			},
		}, noColor);
		expect(output).toContain('2024');
		expect(output).toContain('CNY');
		expect(output).toContain('Synthetic CNY Source');
		expect(output).toContain('7.5000');
		expect(output).toContain('Jan');
		expect(output).toContain('TWD');
		expect(output).toContain('High');
	});

	test('formatArchive shows annual summary for all currencies', () => {
		const output = formatArchive({
			source: 'https://www.murc-kawasesouba.jp/fx/xls/murc_2024.xls',
			year: 2024,
			currencies: {
				USD: {
					daily: [],
					monthly: [],
					annual: {
						high: 130,
						low: 105,
						average: 118,
					},
				},
				MYR: {
					daily: [],
					monthly: [],
					annual: {
						high: 0,
						low: 0,
						average: 0,
					},
				},
			},
		}, noColor);
		expect(output).toContain('2024');
		expect(output).toContain('USD');
		expect(output).toContain('130.00');
		expect(output).toContain('105.00');
		expect(output).toContain('—'); // MYR all-zero
		expect(output).toContain('High');
	});

	test('formatYearly shows year-end and average sections', () => {
		const output = formatYearly({
			source: 'https://www.murc-kawasesouba.jp/fx/yearend/index.php?id=2025',
			year: 2025,
			rates: {
				USD: {
					name: 'US Dollar',
					nameJa: 'Synthetic USD',
					unit: 1,
					yearEnd: {
						tts: 105,
						ttb: 103,
						ttm: 104,
					},
					yearlyAverage: {
						tts: 104.5,
						ttb: 102.5,
						ttm: 103.5,
					},
				},
			},
		}, noColor);
		expect(output).toContain('2025');
		expect(output).toContain('Year-End');
		expect(output).toContain('Yearly Average');
		expect(output).toContain('105.00');
		expect(output).toContain('103.50');
	});
});
