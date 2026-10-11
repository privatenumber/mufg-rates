import { describe, test, expect } from 'manten';
import { fetchWorld } from '../src/api/fetch-world.ts';

describe('fetchWorld', () => {
	test('all 5 regions present', async () => {
		const result = await fetchWorld();
		expect(Array.isArray(result.asia)).toBe(true);
		expect(Array.isArray(result.africa)).toBe(true);
		expect(Array.isArray(result.europe)).toBe(true);
		expect(Array.isArray(result.mideast)).toBe(true);
		expect(Array.isArray(result.americas)).toBe(true);
	});

	test('asia has entries', async () => {
		const result = await fetchWorld();
		if (process.env.MUFG_LIVE) {
			expect(result.asia.length).toBeGreaterThanOrEqual(25);
		} else {
			expect(result.asia.length).toBeGreaterThan(0);
		}
	});

	test('asia entry fields are parsed', async () => {
		const result = await fetchWorld();
		if (process.env.MUFG_LIVE) {
			const australia = result.asia.find(entry => entry.country === 'Australia');
			expect(australia).toBeDefined();
			expect(australia!.currency.length).toBeGreaterThan(0);
			return;
		}

		const entry = result.asia.find(rate => rate.country === 'Fictional asia');
		expect(entry).toBeDefined();
		expect(entry!.currency).toBe('Synthetic Currency');
	});

	test('date is parsed from Shift_JIS world page text', async () => {
		const result = await fetchWorld();
		if (process.env.MUFG_LIVE) {
			expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			const year = Number(result.date.split('-')[0]);
			expect(year).toBeGreaterThanOrEqual(2025);
		} else {
			expect(result.date).toBe('2026-05-15');
		}
	});

	test('america entry fields are parsed', async () => {
		const result = await fetchWorld();
		if (process.env.MUFG_LIVE) {
			const us = result.americas.find(entry => entry.country === 'United States of America');
			expect(us).toBeDefined();
			expect(us!.currency.length).toBeGreaterThan(0);
			return;
		}

		const entry = result.americas.find(rate => rate.country === 'Fictional america');
		expect(entry).toBeDefined();
	});

	test('all regions have entries (not silently empty from failed CSVs)', async () => {
		const result = await fetchWorld();
		expect(result.asia.length).toBeGreaterThan(0);
		expect(result.africa.length).toBeGreaterThan(0);
		expect(result.europe.length).toBeGreaterThan(0);
		expect(result.mideast.length).toBeGreaterThan(0);
		expect(result.americas.length).toBeGreaterThan(0);
	});

	test('HTML entities are fully decoded in output', async () => {
		const result = await fetchWorld();
		const allEntries = [
			...result.asia,
			...result.africa,
			...result.europe,
			...result.mideast,
			...result.americas,
		];
		// No raw HTML entities should remain in any field
		for (const entry of allEntries) {
			const values = [
				entry.country,
				entry.countryJa,
				entry.currency,
				entry.code,
				entry.quotation,
				entry.marketLevel,
				entry.remarks,
			];
			for (const value of values) {
				expect(value).not.toMatch(/&[a-z]+;|&#\d+;/);
			}
		}
	});

	test('entry without rates has empty marketLevel', async () => {
		const result = await fetchWorld();
		const allEntries = [
			...result.asia,
			...result.africa,
			...result.europe,
			...result.mideast,
			...result.americas,
		];
		if (process.env.MUFG_LIVE) {
			const guam = allEntries.find(entry => entry.country === 'Guam');
			expect(guam).toBeDefined();
			expect(guam!.marketLevel).toBe('');
			return;
		}

		const noRate = allEntries.find(entry => entry.country === 'No Rate asia');
		expect(noRate).toBeDefined();
		expect(noRate!.marketLevel).toBe('');
	});
});
