import { describe, test, expect } from 'manten';
import { fetchYearly } from '../src/api/fetch-yearly.ts';

describe('fetchYearly', () => {
	test('fetches 2024 historical data with yearEnd and yearlyAverage', async () => {
		const result = await fetchYearly(2024);
		expect(result).not.toBeNull();
		expect(result!.year).toBe(2024);
		expect(result!.rates.USD).toBeDefined();
		expect(result!.rates.USD.yearEnd.tts).toBeGreaterThan(0);
		expect(result!.rates.USD.yearEnd.ttb).toBeGreaterThan(0);
		expect(result!.rates.USD.yearEnd.ttm).toBeGreaterThan(0);
		expect(result!.rates.USD.yearlyAverage.tts).toBeGreaterThan(0);
		expect(result!.rates.USD.yearlyAverage.ttb).toBeGreaterThan(0);
		expect(result!.rates.USD.yearlyAverage.ttm).toBeGreaterThan(0);
		expect(result!.rates.USD.unit).toBe(1);
	});

	test('fetches 2003 legacy data without newer currencies', async () => {
		const result = await fetchYearly(2003);
		expect(result).not.toBeNull();
		const codes = Object.keys(result!.rates);

		if (process.env.MUFG_LIVE) {
			expect(codes.length).toBeGreaterThanOrEqual(24);
			expect(codes.length).toBeLessThanOrEqual(28);
			expect(result!.rates.CZK).toBeUndefined();
			expect(result!.rates.RUB).toBeUndefined();
			expect(result!.rates.HUF).toBeUndefined();
			expect(result!.rates.PLN).toBeUndefined();
		} else {
			expect(codes).toContain('USD');
		}

		expect(result!.rates.TRY).toBeUndefined();
	});

	test('fetches 2025 (most recently completed year) via fallback', async () => {
		const result = await fetchYearly(2025);
		expect(result).not.toBeNull();
		expect(result!.year).toBe(2025);
		expect(result!.rates.USD).toBeDefined();
		expect(result!.rates.USD.yearlyAverage.tts).toBeGreaterThan(0);
	});

	test('returns null for 2002 (out of range)', async () => {
		const result = await fetchYearly(2002);
		expect(result).toBeNull();
	});

	test('KRW has unit 100', async () => {
		const result = await fetchYearly(2024);
		expect(result).not.toBeNull();
		expect(result!.rates.KRW.unit).toBe(100);
	});

	test('year field matches requested year', async () => {
		const result = await fetchYearly(2024);
		expect(result).not.toBeNull();
		expect(result!.year).toBe(2024);
	});

	test('fetchYearly returns null for future year (2030)', async () => {
		const result = await fetchYearly(2030);
		expect(result).toBeNull();
	});

	test('fetchYearly returns null for current incomplete year (2026)', async () => {
		const result = await fetchYearly(2026);
		expect(result).toBeNull();
	});
});
