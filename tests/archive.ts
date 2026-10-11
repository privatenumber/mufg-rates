import { describe, test, expect } from 'manten';

import {
	downloadArchiveSource, getArchiveSourceUrl, parseArchiveWorkbook,
} from '../src/api/archive.ts';

const parseArchiveYear = async (year: number) => (
	parseArchiveWorkbook(await downloadArchiveSource(year))
);

describe('archive', () => {
	test('getArchiveSourceUrl returns official source file URL', () => {
		expect(getArchiveSourceUrl(2025)).toBe('https://www.murc-kawasesouba.jp/fx/xls/murc_2025.xls');
	});

	test('downloadArchiveSource returns raw XLS bytes', async () => {
		const xlsBuffer = await downloadArchiveSource(2025);
		expect(xlsBuffer.byteLength).toBeGreaterThan(0);
	});

	test('parseArchiveWorkbook reads 2025 USD daily, monthly, and annual data', async () => {
		const result = await parseArchiveYear(2025);
		const usd = result.currencies.USD;
		expect(result.source).toBe(getArchiveSourceUrl(2025));
		expect(usd).toBeDefined();

		if (process.env.MUFG_LIVE) {
			expect(usd!.daily.length).toBeGreaterThan(200);
		} else {
			expect(usd!.daily.length).toBeGreaterThan(0);
		}

		// Monthly: 12 entries
		expect(usd!.monthly.length).toBe(12);

		// Annual summary exists with positive values
		expect(usd!.annual.high).toBeGreaterThan(0);
		expect(usd!.annual.low).toBeGreaterThan(0);
		expect(usd!.annual.average).toBeGreaterThan(0);
	});

	test('daily entries have valid dates and positive rates', async () => {
		const result = await parseArchiveYear(2025);
		const usd = result.currencies.USD;
		const datePattern = /^\d{4}-\d{2}-\d{2}$/;

		for (const entry of usd!.daily) {
			expect(datePattern.test(entry.date)).toBe(true);
			expect(entry.tts).toBeGreaterThan(0);
			expect(entry.ttb).toBeGreaterThan(0);
			expect(entry.ttm).toBeGreaterThan(0);
		}
	});

	test('daily TTM is approximately (TTS + TTB) / 2', async () => {
		const result = await parseArchiveYear(2025);
		const usd = result.currencies.USD;

		for (const entry of usd!.daily) {
			const expectedTtm = (entry.tts + entry.ttb) / 2;
			expect(Math.abs(entry.ttm - expectedTtm)).toBeLessThan(0.01);
		}
	});

	test('monthly entries have months 1-12 and high >= average >= low', async () => {
		const result = await parseArchiveYear(2025);
		const usd = result.currencies.USD;

		for (const entry of usd!.monthly) {
			expect(entry.month).toBeGreaterThanOrEqual(1);
			expect(entry.month).toBeLessThanOrEqual(12);
			expect(entry.high).toBeGreaterThanOrEqual(entry.average);
			expect(entry.average).toBeGreaterThanOrEqual(entry.low);
		}
	});

	test('annual high >= average >= low', async () => {
		const result = await parseArchiveYear(2025);
		const usd = result.currencies.USD;
		expect(usd!.annual.high).toBeGreaterThanOrEqual(usd!.annual.average);
		expect(usd!.annual.average).toBeGreaterThanOrEqual(usd!.annual.low);
	});

	test('2013 has TRY (Turkish Lira)', async () => {
		const result = await parseArchiveYear(2013);
		expect(result.currencies.TRY).toBeDefined();
		expect(result.currencies.TRY!.daily.length).toBeGreaterThan(0);
	});

	test('no daily entries with null or zero rates (weekends/holidays filtered)', async () => {
		const result = await parseArchiveYear(2025);
		const usd = result.currencies.USD;

		for (const entry of usd!.daily) {
			expect(entry.tts).not.toBe(0);
			expect(entry.ttb).not.toBe(0);
			expect(entry.ttm).not.toBe(0);
		}
	});

	test('parseArchiveWorkbook(2002) reads 月毎HLA sheet', async () => {
		const result = await parseArchiveYear(2002);
		expect(result.currencies.USD).toBeDefined();
		expect(result.currencies.USD.monthly.length).toBeGreaterThan(0);
	});

	test('parseArchiveWorkbook(2005) reads 最高値/最低値/平均値 summaries', async () => {
		const result = await parseArchiveYear(2005);
		const usd = result.currencies.USD;
		expect(usd.monthly.length).toBe(12);
		expect(usd.monthly[0].high).toBeGreaterThan(0);
		expect(usd.monthly[0].low).toBeGreaterThan(0);
		expect(usd.monthly[0].average).toBeGreaterThan(0);
		expect(usd.annual.high).toBeGreaterThan(0);
	});

	test('parseArchiveWorkbook(2001) reads monthly summaries', async () => {
		const result = await parseArchiveYear(2001);
		const usd = result.currencies.USD;
		expect(usd.monthly.length).toBe(12);
		expect(usd.monthly[0].high).toBeGreaterThan(0);
		expect(usd.annual.high).toBeGreaterThan(0);
	});

	test('parseArchiveWorkbook(2009) has non-zero annual summary', async () => {
		const result = await parseArchiveYear(2009);
		const usd = result.currencies.USD;
		expect(usd.annual.high).toBeGreaterThan(0);
		expect(usd.annual.low).toBeGreaterThan(0);
		expect(usd.annual.average).toBeGreaterThan(0);
	});
});
