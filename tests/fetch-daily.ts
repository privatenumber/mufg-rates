import { describe, test, expect } from 'manten';
import { fetchDaily } from '../src/api/fetch-daily.ts';

describe('fetchDaily', () => {
	test('fetches rates for a known date', async () => {
		const result = await fetchDaily('2025-01-06');
		expect(result).not.toBeNull();
		expect(result!.date).toBe('2025-01-06');
		expect(result!.rates.USD).toBeDefined();
		expect(result!.rates.USD.tts).toBeGreaterThan(0);
		expect(result!.rates.USD.ttb).toBeGreaterThan(0);
		expect(result!.rates.USD.ttm).toBe(
			(result!.rates.USD.tts! + result!.rates.USD.ttb!) / 2,
		);
		expect(result!.rates.USD.unit).toBe(1);
		expect(result!.rates.KRW.unit).toBe(100);
	});

	test('cash rates present with wider spread', async () => {
		const result = await fetchDaily('2025-01-06');
		expect(result).not.toBeNull();
		expect(result!.cashRates.USD).toBeDefined();
		expect(result!.cashRates.USD.selling).toBeGreaterThan(0);
		expect(result!.cashRates.USD.buying).toBeGreaterThan(0);
		expect(result!.cashRates.USD.selling).toBeGreaterThan(result!.rates.USD.tts!);
	});

	test('cash rates include EUR', async () => {
		const result = await fetchDaily('2025-01-06');
		expect(result).not.toBeNull();
		expect(result!.cashRates.EUR).toBeDefined();
		expect(result!.cashRates.EUR.selling).toBeGreaterThan(0);
		expect(result!.cashRates.EUR.buying).toBeGreaterThan(0);
	});

	test('non-business day walks back to preceding business day', async () => {
		// Jan 4, 2025 = Saturday, Jan 3 = bank holiday (年始休暇)
		// Walks back to Dec 30, 2024 (last business day)
		const result = await fetchDaily('2025-01-04');
		expect(result).not.toBeNull();
		expect(result!.date).toBe('2024-12-30');
		expect(result!.rates.USD.tts).toBeGreaterThan(0);
	});

	test('no-argument call returns today rates', async () => {
		const result = await fetchDaily();
		expect(result).not.toBeNull();
		expect(result!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(result!.rates.USD).toBeDefined();
	});

	test('date before Sep 2009 has empty cashRates', async () => {
		const result = await fetchDaily('2006-01-04');
		expect(result).not.toBeNull();
		expect(result!.rates.USD).toBeDefined();
		expect(result!.rates.USD.tts).toBeGreaterThan(0);
		expect(Object.keys(result!.cashRates)).toHaveLength(0);
	});
});
