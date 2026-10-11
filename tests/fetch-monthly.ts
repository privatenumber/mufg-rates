import { describe, test, expect } from 'manten';
import { fetchMonthly } from '../src/api/fetch-monthly.ts';

describe('fetchMonthly', () => {
	test('fetches Jan 2026 historical data', async () => {
		const result = await fetchMonthly(2026, 1);
		expect(result).not.toBeNull();
		expect(result!.year).toBe(2026);
		expect(result!.month).toBe(1);
		expect(result!.rates.USD).toBeDefined();
		expect(result!.rates.USD.monthEnd.tts).toBeGreaterThan(0);
		expect(result!.rates.USD.monthlyAverage.ttm).toBeGreaterThan(0);
		expect(result!.rates.USD.unit).toBe(1);
	});

	test('KRW and IDR have unit 100', async () => {
		const result = await fetchMonthly(2026, 1);
		expect(result).not.toBeNull();
		expect(result!.rates.KRW.unit).toBe(100);
		expect(result!.rates.IDR.unit).toBe(100);
	});

	test('localMarketRates has entries with selling/buying/source', async () => {
		const result = await fetchMonthly(2026, 1);
		expect(result).not.toBeNull();
		expect(Object.keys(result!.localMarketRates).length).toBeGreaterThan(0);

		const twd = result!.localMarketRates.TWD;
		expect(twd).toBeDefined();
		expect(twd.selling).not.toBeNull();
		expect(twd.buying).not.toBeNull();
		expect(twd.source.length).toBeGreaterThan(0);

		const cny = result!.localMarketRates.CNY;
		expect(cny).toBeDefined();
		expect(cny.source.length).toBeGreaterThan(0);
	});

	test('returns null for out-of-range month (2004-01)', async () => {
		const result = await fetchMonthly(2004, 1);
		expect(result).toBeNull();
	});

	test('MYR monthEnd and monthlyAverage rates are all null', async () => {
		const result = await fetchMonthly(2026, 1);
		expect(result).not.toBeNull();
		expect(result!.rates.MYR).toBeDefined();
		expect(result!.rates.MYR.monthEnd.tts).toBeNull();
		expect(result!.rates.MYR.monthEnd.ttb).toBeNull();
		expect(result!.rates.MYR.monthEnd.ttm).toBeNull();
		expect(result!.rates.MYR.monthlyAverage.tts).toBeNull();
		expect(result!.rates.MYR.monthlyAverage.ttb).toBeNull();
		expect(result!.rates.MYR.monthlyAverage.ttm).toBeNull();
	});

	test('year and month fields are correct', async () => {
		const result = await fetchMonthly(2026, 1);
		expect(result).not.toBeNull();
		expect(result!.year).toBe(2026);
		expect(result!.month).toBe(1);
	});
});
