import { Buffer } from 'node:buffer';
import {
	describe, test, expect, skip,
} from 'manten';
import * as XLSX from 'xlsx';
import {
	fetchXls, getSheet, sheetToRows, excelDateToIso,
	_setOfficeCryptoForTests, _resetOfficeCryptoForTests,
} from '../src/api/parse-xls.ts';

const createDecryptedWorkbook = () => {
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(
		workbook,
		XLSX.utils.aoa_to_sheet([['marker'], ['decrypted']]),
		'decrypted',
	);
	return XLSX.write(workbook, {
		type: 'buffer',
		bookType: 'biff8',
	}) as Buffer;
};

describe('parse-xls', () => {
	test('fetchXls reads synthetic archive workbook', async () => {
		const workbook = await fetchXls('https://www.murc-kawasesouba.jp/fx/xls/murc_2025.xls');
		const names = workbook.SheetNames;
		expect(names).toContain('data');
		expect(names).toContain('月毎');
	});

	test('reads cell values as numbers from data sheet', async () => {
		const workbook = await fetchXls('https://www.murc-kawasesouba.jp/fx/xls/murc_2025.xls');
		const sheet = getSheet(workbook, 'data');
		const rows = sheetToRows(sheet);
		expect(rows.length).toBeGreaterThan(0);

		// First synthetic data row (row index 3) has serial 45663 = Jan 6, 2025.
		const firstDataRow = rows[3]!;
		expect(typeof firstDataRow[0]).toBe('number');
		const isoDate = excelDateToIso(firstDataRow[0] as number);
		if (process.env.MUFG_LIVE) {
			expect(isoDate).toMatch(/^2025-\d{2}-\d{2}$/);
		} else {
			expect(firstDataRow[0]).toBe(45_663);
			expect(isoDate).toBe('2025-01-06');
		}
	});

	test('getSheet throws on missing sheet', async () => {
		const workbook = await fetchXls('https://www.murc-kawasesouba.jp/fx/xls/murc_2025.xls');
		expect(() => getSheet(workbook, 'nonexistent')).toThrow("Sheet 'nonexistent' not found");
	});

	test('fetchXls reads reference workbook', async () => {
		const workbook = await fetchXls('https://www.murc-kawasesouba.jp/fx/ref_rate/a_2021.xls');
		const names = workbook.SheetNames;
		expect(names).toContain('1月');
		expect(names).toContain('12月');

		const sheet = getSheet(workbook, '1月');
		const rows = sheetToRows(sheet);
		expect(rows.length).toBeGreaterThan(0);
	});

	test('fetchXls delegates CryptoAPI-encrypted BIFF8 workbooks to officecrypto-tool', async () => {
		if (process.env.MUFG_LIVE) {
			skip('Live reference workbook coverage exercises the real CryptoAPI decrypt path');
		}

		let decryptCalls = 0;
		_setOfficeCryptoForTests({
			decrypt: async (buffer, options) => {
				decryptCalls += 1;
				expect(Buffer.isBuffer(buffer)).toBe(true);
				expect(options.password).toBe('VelvetSweatshop');
				return createDecryptedWorkbook();
			},
		});

		try {
			const workbook = await fetchXls('https://synthetic.local/cryptoapi.xls');
			expect(workbook.SheetNames).toContain('decrypted');
			expect(decryptCalls).toBe(1);
		} finally {
			_resetOfficeCryptoForTests();
		}
	});
});

describe('excelDateToIso', () => {
	test('serial 1 = 1900-01-01', () => {
		expect(excelDateToIso(1)).toBe('1900-01-01');
	});

	test('serial 45663 = 2025-01-06', () => {
		expect(excelDateToIso(45_663)).toBe('2025-01-06');
	});

	test('serial 60 = 1900-02-28 (Lotus 1-2-3 bug)', () => {
		// Serial 60 is Feb 29, 1900 in Excel (which doesn't exist)
		// Standard practice: treat as Feb 28, 1900
		expect(excelDateToIso(60)).toBe('1900-02-28');
	});
});
