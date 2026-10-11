import { describe, test, expect } from 'manten';
import { convertCurrency } from '../src/api/convert-currency.ts';
import { fetchRates } from '../src/api/fetch-rates.ts';

describe('convertCurrency', () => {
	test('converts foreign currency to JPY with TTM by default', async () => {
		const rates = await fetchRates('2025-01-06');
		const result = await convertCurrency({
			amount: 100,
			from: 'USD',
			to: 'JPY',
			date: '2025-01-06',
		});

		expect(result).not.toBeNull();
		expect(result!.convertedAmount).toBe(100 * rates!.rates.USD.ttm!);
		expect(result!.rate).toBe('ttm');
		expect(result!.rateValue).toBe(rates!.rates.USD.ttm);
		expect(result!.unit).toBe(1);
		expect(result!.sourceDate).toBe('2025-01-06');
	});

	test('converts JPY to foreign currency', async () => {
		const rates = await fetchRates('2025-01-06');
		const result = await convertCurrency({
			amount: 10_000,
			from: 'JPY',
			to: 'USD',
			date: '2025-01-06',
		});

		expect(result).not.toBeNull();
		expect(result!.convertedAmount).toBe(10_000 / rates!.rates.USD.ttm!);
		expect(result!.from).toBe('JPY');
		expect(result!.to).toBe('USD');
	});

	test('uses selected rate type', async () => {
		const rates = await fetchRates('2025-01-06');
		const result = await convertCurrency({
			amount: 100,
			from: 'USD',
			to: 'JPY',
			date: '2025-01-06',
			rate: 'tts',
		});

		expect(result).not.toBeNull();
		expect(result!.convertedAmount).toBe(100 * rates!.rates.USD.tts!);
		expect(result!.rate).toBe('tts');
		expect(result!.rateValue).toBe(rates!.rates.USD.tts);
	});

	test('applies per-100 quote units', async () => {
		const rates = await fetchRates('2025-01-06');
		const result = await convertCurrency({
			amount: 10_000,
			from: 'KRW',
			to: 'JPY',
			date: '2025-01-06',
		});

		expect(result).not.toBeNull();
		expect(result!.convertedAmount).toBe((10_000 * rates!.rates.KRW.ttm!) / 100);
		expect(result!.unit).toBe(100);
	});

	test('converts legacy Belgian Franc commercial rows per 100 units', async () => {
		const result = await convertCurrency({
			amount: 1000,
			from: 'BEF',
			to: 'JPY',
			date: '1994-01-05',
		});

		expect(result).not.toBeNull();
		expect(result!.convertedAmount).toBe(3100);
		expect(result!.unit).toBe(100);
	});

	test('reports requested and source dates when walking back', async () => {
		const result = await convertCurrency({
			amount: 100,
			from: 'USD',
			to: 'JPY',
			date: '2025-01-04',
		});

		expect(result).not.toBeNull();
		expect(result!.requestedDate).toBe('2025-01-04');
		expect(result!.sourceDate).toBe('2024-12-30');
	});

	test('normalizes currency codes', async () => {
		const result = await convertCurrency({
			amount: 100,
			from: 'usd',
			to: 'jpy',
			date: '2025-01-06',
		});

		expect(result).not.toBeNull();
		expect(result!.from).toBe('USD');
		expect(result!.to).toBe('JPY');
	});

	test('throws for unquoted currency rates', async () => {
		await expect(async () => convertCurrency({
			amount: 100,
			from: 'MYR',
			to: 'JPY',
			date: '2025-01-06',
		})).rejects.toThrow('Currency MYR has no TTM rate');
	});

	test('throws for foreign-to-foreign conversion', async () => {
		await expect(async () => convertCurrency({
			amount: 100,
			from: 'USD',
			to: 'EUR',
			date: '2025-01-06',
		})).rejects.toThrow('only supports conversions between JPY and one foreign currency');
	});
});
