import { describe, test, expect } from 'manten';
import spawn from 'nano-spawn';
import {
	formatDate, formatDateId, parseDate, computeTtm,
} from '../src/api/utils.ts';

// Run a JS expression in an isolated Node process with a specific timezone.
// Returns stdout trimmed.
const evalInTz = async (timezone: string, code: string) => {
	const result = await spawn(
		process.execPath,
		['--input-type=module', '-e', code],
		{
			env: {
				...process.env,
				TZ: timezone,
			},
		},
	);
	return result.stdout.trim();
};

describe('utils', () => {
	test('formatDate converts Date to YYYY-MM-DD', () => {
		expect(formatDate(new Date(2025, 0, 6))).toBe('2025-01-06');
	});

	test('formatDateId converts Date to YYMMDD', () => {
		expect(formatDateId(new Date(2025, 0, 6))).toBe('250106');
	});

	test('parseDate accepts YYYY-MM-DD string', () => {
		const date = parseDate('2025-01-06');
		expect(date.getFullYear()).toBe(2025);
		expect(date.getMonth()).toBe(0);
		expect(date.getDate()).toBe(6);
	});

	test('parseDate accepts Date object and preserves calendar fields', () => {
		const input = new Date(2025, 0, 6);
		const result = parseDate(input);
		expect(result.getFullYear()).toBe(2025);
		expect(result.getMonth()).toBe(0);
		expect(result.getDate()).toBe(6);
	});

	test('parseDate throws on invalid string', () => {
		expect(() => parseDate('not-a-date')).toThrow();
	});

	test('computeTtm returns midpoint', () => {
		expect(computeTtm(105.25, 103.75)).toBe(104.5);
	});

	test('computeTtm returns null when either input is null', () => {
		expect(computeTtm(null, 103.75)).toBeNull();
		expect(computeTtm(105.25, null)).toBeNull();
	});

	test('computeTtm rounds to 2 decimal places', () => {
		// (115.9 + 112.7) / 2 = 114.3 but JS gives 114.30000000000001
		const result = computeTtm(115.9, 112.7);
		expect(result).toBe(114.3);
		// (15.9 + 15.3) / 2 = 15.6 but JS gives 15.600000000000001
		const result2 = computeTtm(15.9, 15.3);
		expect(result2).toBe(15.6);
	});

	test('local-midnight Date works in America/New_York', async () => {
		const date = await evalInTz('America/New_York', `
			import { parseDate, formatDate } from './src/api/utils.ts';
			console.log(formatDate(parseDate(new Date(2025, 0, 6))));
		`);
		expect(date).toBe('2025-01-06');
	});

	test('local-midnight Date works in Asia/Tokyo', async () => {
		const date = await evalInTz('Asia/Tokyo', `
			import { parseDate, formatDate } from './src/api/utils.ts';
			console.log(formatDate(parseDate(new Date(2025, 0, 6))));
		`);
		expect(date).toBe('2025-01-06');
	});

	test('UTC-midnight Date works in America/New_York', async () => {
		const date = await evalInTz('America/New_York', `
			import { parseDate, formatDate } from './src/api/utils.ts';
			console.log(formatDate(parseDate(new Date('2025-01-06'))));
		`);
		expect(date).toBe('2025-01-06');
	});

	test('UTC-midnight Date works in Asia/Tokyo', async () => {
		const date = await evalInTz('Asia/Tokyo', `
			import { parseDate, formatDate } from './src/api/utils.ts';
			console.log(formatDate(parseDate(new Date('2025-01-06'))));
		`);
		expect(date).toBe('2025-01-06');
	});

	test('string date works in America/New_York', async () => {
		const date = await evalInTz('America/New_York', `
			import { parseDate, formatDate } from './src/api/utils.ts';
			console.log(formatDate(parseDate('2025-01-06')));
		`);
		expect(date).toBe('2025-01-06');
	});

	test('arbitrary datetime throws', () => {
		expect(() => parseDate(new Date('2025-01-06T12:34:56Z'))).toThrow('Ambiguous');
	});

	test('invalid Date throws', () => {
		expect(() => parseDate(new Date('garbage'))).toThrow('Invalid');
	});
});
