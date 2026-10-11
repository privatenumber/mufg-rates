import { describe, test, expect } from 'manten';
import { fetchReference } from '../src/api/fetch-reference.ts';

describe('fetchReference', () => {
	test('TWD has perUsd and perJpy rates', async () => {
		const result = await fetchReference(2025);
		const twd = result!.currencies.TWD;
		expect(twd).toBeDefined();
		expect(Array.isArray(twd!.rates.perUsd)).toBe(true);
		expect(twd!.rates.perUsd!.length).toBeGreaterThan(0);
		expect(Array.isArray(twd!.rates.perJpy)).toBe(true);
		expect(twd!.rates.perJpy!.length).toBeGreaterThan(0);
	});

	test('BRL has perUsd but no perJpy', async () => {
		const result = await fetchReference(2025);
		const brl = result!.currencies.BRL;
		expect(brl).toBeDefined();
		expect(Array.isArray(brl!.rates.perUsd)).toBe(true);
		expect(brl!.rates.perUsd!.length).toBeGreaterThan(0);
		expect(brl!.rates.perJpy).toBeUndefined();
	});

	test('CLP rates have same tts and ttb (interbank average)', async () => {
		const result = await fetchReference(2025);
		const clp = result!.currencies.CLP;
		expect(clp).toBeDefined();
		const rates = clp!.rates.perUsd!;
		expect(rates.length).toBeGreaterThan(0);
		for (const rate of rates) {
			expect(rate.tts).toBe(rate.ttb);
		}
	});

	test('monthlySummary has entries with high/low/average', async () => {
		const result = await fetchReference(2025);
		const twd = result!.currencies.TWD;
		expect(twd!.monthlySummary.length).toBeGreaterThan(0);
		const entry = twd!.monthlySummary[0]!;
		expect(entry.month).toBeGreaterThanOrEqual(1);
		expect(entry.month).toBeLessThanOrEqual(12);
		expect(entry.high).not.toBeNull();
		expect(entry.low).not.toBeNull();
		expect(entry.average).not.toBeNull();
	});

	test('sourceJa is a non-empty string on each currency', async () => {
		const result = await fetchReference(2025);
		for (const [, currency] of Object.entries(result!.currencies)) {
			expect(typeof currency.sourceJa).toBe('string');
			expect(currency.sourceJa.length).toBeGreaterThan(0);
		}
	});

	test('fetchReference(2021) returns CNY/TWD/MYR with non-empty rates', async () => {
		const result = await fetchReference(2021);
		expect(Object.keys(result!.currencies).length).toBe(8);

		const cny = result!.currencies.CNY!;
		expect(cny.rates.perUsd!.length).toBeGreaterThan(0);
		expect(cny.rates.perUsd![0].tts).toBeGreaterThan(0);

		const twd = result!.currencies.TWD!;
		expect(twd.rates.perUsd!.length).toBeGreaterThan(0);
		expect(twd.rates.perJpy!.length).toBeGreaterThan(0);

		const myr = result!.currencies.MYR!;
		expect(myr.rates.perUsd!.length).toBeGreaterThan(0);
	});

	test('fetchReference(2022) returns all 8 currencies with data', async () => {
		const result = await fetchReference(2022);
		expect(Object.keys(result!.currencies).length).toBe(8);
		expect(result!.currencies.CNY!.rates.perUsd!.length).toBeGreaterThan(0);
		expect(result!.currencies.TWD!.rates.perJpy!.length).toBeGreaterThan(0);
	});

	test('fetchReference(2023) returns all 8 currencies with data', async () => {
		const result = await fetchReference(2023);
		expect(Object.keys(result!.currencies).length).toBe(8);
		expect(result!.currencies.MYR!.rates.perUsd!.length).toBeGreaterThan(0);
	});

	test('fetchReference(2005) returns null for unsupported year', async () => {
		const result = await fetchReference(2005);
		expect(result).toBeNull();
	});

	test('daily rate dates are valid YYYY-MM-DD strings', async () => {
		const result = await fetchReference(2025);
		const twd = result!.currencies.TWD;
		const datePattern = /^\d{4}-\d{2}-\d{2}$/;
		for (const rate of twd!.rates.perUsd!) {
			expect(datePattern.test(rate.date)).toBe(true);
		}
	});
});
