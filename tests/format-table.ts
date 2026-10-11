import { describe, test, expect } from 'manten';
import ansis, { Ansis } from 'ansis';
import { formatTable } from '../src/cli/format-table.ts';

describe('formatTable', () => {
	const noColor = new Ansis(0);

	test('aligns left-aligned columns', () => {
		const result = formatTable(
			[{ header: 'Name' }, { header: 'Value' }],
			[['Alice', '100'], ['Bob', '2']],
			noColor,
		);
		const lines = result.split('\n');
		expect(lines.length).toBe(3); // header + 2 rows
		expect(lines[0]).toContain('Name');
		expect(lines[1]).toContain('Alice');
	});

	test('right-aligns numeric columns', () => {
		const result = formatTable(
			[{ header: 'Code' }, {
				header: 'Rate',
				align: 'right' as const,
			}],
			[['USD', '105.00'], ['EUR', '3.96']],
			noColor,
		);
		const lines = result.split('\n');
		// Right-aligned: both values should end at the same column position
		const usdEnd = lines[1].indexOf('105.00') + '105.00'.length;
		const eurEnd = lines[2].indexOf('3.96') + '3.96'.length;
		expect(usdEnd).toBe(eurEnd);
	});

	test('handles ANSI-styled strings for width calculation', () => {
		const color = new Ansis(1);
		const result = formatTable(
			[{ header: 'Code' }, { header: 'Name' }],
			[[color.bold('USD'), 'US Dollar'], [color.bold('EUR'), 'Euro']],
			noColor,
		);
		const lines = result.split('\n');
		// Despite ANSI codes in 'USD', alignment should be based on visual width (3)
		// Second column should start at the same position for header and data
		// Strip ANSI codes to compare visual positions via indexOf
		const headerNameStart = ansis.strip(lines[0]).indexOf('Name');
		const dataNameStart = ansis.strip(lines[1]).indexOf('US Dollar');
		expect(headerNameStart).toBe(dataNameStart);
	});

	test('empty rows returns header only', () => {
		const result = formatTable(
			[{ header: 'A' }, { header: 'B' }],
			[],
			noColor,
		);
		expect(result).toContain('A');
		expect(result.split('\n').length).toBe(1);
	});

	test('aligns Hangul clusters and Indic spacing marks', () => {
		const result = formatTable(
			[{ header: 'Name' }, {
				header: 'Rate',
				align: 'right',
			}],
			[['ᄀᄀ', '1'], ['का', '2'], ['USD', '3']],
			noColor,
		);
		expect(result).toBe('Name  Rate\nᄀᄀ     1\nका       2\nUSD      3');
	});
});
