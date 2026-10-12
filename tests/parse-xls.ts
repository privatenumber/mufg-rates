import { Buffer } from 'node:buffer';
import {
	describe, test, expect,
} from 'manten';
import * as XLSX from 'xlsx';
import {
	fetchXls, getSheet, sheetToRows, excelDateToIso, parseXlsBuffer,
	_setOfficeCryptoForTests, _resetOfficeCryptoForTests,
} from '../src/api/parse-xls.ts';
import { parseArchiveWorkbook } from '../src/api/archive.ts';
import { encryptedXls } from './helpers/encrypted-xls.ts';

const wrapWorkbookStream = (stream: Uint8Array): Buffer => {
	const cfb = XLSX.CFB.utils.cfb_new();
	XLSX.CFB.utils.cfb_add(cfb, 'Workbook', Buffer.from(stream));
	return Buffer.from(XLSX.CFB.write(cfb) as Uint8Array);
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
});

describe('encrypted XLS', () => {
	const expectedRates = {
		source: 'https://synthetic.local/archive',
		year: 2025,
		currencies: {
			USD: {
				daily: [
					{
						date: '2025-01-06',
						tts: 105,
						ttb: 103,
						ttm: 104,
					},
					{
						date: '2025-01-07',
						tts: 107,
						ttb: 105,
						ttm: 106,
					},
				],
				monthly: [{
					month: 1,
					high: 107,
					low: 103,
					average: 105,
				}],
				annual: {
					high: 109,
					low: 101,
					average: 105,
				},
			},
		},
	};

	for (const name of ['plain', 'rc4', 'cryptoapi40', 'cryptoapi128'] as const) {
		test(`${name} parses complete rates without modifying caller bytes`, async () => {
			const bytes = wrapWorkbookStream(Buffer.from(encryptedXls[name], 'base64'));
			const before = Buffer.from(bytes);
			const result = await parseArchiveWorkbook(bytes, { sourceUrl: expectedRates.source });
			expect(result).toStrictEqual(expectedRates);
			expect(bytes).toStrictEqual(before);
		});
	}

	for (const name of ['rc4OtherPassword', 'cryptoapi40OtherPassword', 'cryptoapi128OtherPassword'] as const) {
		test(`${name} rejects the password before workbook parsing`, async () => {
			const bytes = wrapWorkbookStream(Buffer.from(encryptedXls[name], 'base64'));
			const before = Buffer.from(bytes);
			await expect(parseXlsBuffer(bytes)).rejects.toThrow("Cannot open encrypted workbook: Excel's default password did not match.");
			expect(bytes).toStrictEqual(before);
		});
	}

	for (const major of [2, 3, 4]) {
		test(`CryptoAPI version ${major}.2 accepts verified default-password data`, async () => {
			const stream = Buffer.from(encryptedXls.cryptoapi128, 'base64');
			const filePassOffset = 4 + stream.readUInt16LE(2);
			stream.writeUInt16LE(major, filePassOffset + 6);
			const result = await parseArchiveWorkbook(wrapWorkbookStream(stream), {
				sourceUrl: expectedRates.source,
			});
			expect(result).toStrictEqual(expectedRates);
		});
	}

	test('standard RC4 checks the verifier hash as well as the verifier', async () => {
		const stream = Buffer.from(encryptedXls.rc4, 'base64');
		const filePassOffset = 4 + stream.readUInt16LE(2);
		stream[filePassOffset + 4 + 38] = (stream[filePassOffset + 4 + 38]! + 1) % 256;
		await expect(parseXlsBuffer(wrapWorkbookStream(stream))).rejects.toThrow("Excel's default password did not match.");
	});

	test('ArrayBuffer and nonzero-offset views preserve encrypted input', async () => {
		const bytes = wrapWorkbookStream(Buffer.from(encryptedXls.rc4, 'base64'));
		const padded = new Uint8Array(bytes.length + 16);
		padded.set(bytes, 8);
		const before = padded.slice();
		for (const input of [
			new DataView(padded.buffer, 8, bytes.length),
			new Uint8Array(bytes).buffer,
		]) {
			const result = await parseArchiveWorkbook(input, { sourceUrl: expectedRates.source });
			expect(result).toStrictEqual(expectedRates);
		}
		expect(padded).toStrictEqual(before);
	});

	for (const [major, minor] of [[1, 2], [2, 1], [4, 4], [5, 2], [0, 0]]) {
		test(`rejects unsupported encryption version ${major}.${minor}`, async () => {
			const stream = Buffer.from(encryptedXls.rc4, 'base64');
			const filePassOffset = 4 + stream.readUInt16LE(2);
			stream.writeUInt16LE(major!, filePassOffset + 6);
			stream.writeUInt16LE(minor!, filePassOffset + 8);
			await expect(parseXlsBuffer(wrapWorkbookStream(stream))).rejects.toThrow(`unsupported encryption version ${major}.${minor}`);
		});
	}

	for (const type of [0, 2]) {
		test(`rejects unsupported encryption type ${type}`, async () => {
			const stream = Buffer.from(encryptedXls.rc4, 'base64');
			const filePassOffset = 4 + stream.readUInt16LE(2);
			stream.writeUInt16LE(type, filePassOffset + 4);
			if (type === 0) {
				stream.writeUInt16LE(6, filePassOffset + 2);
			}
			await expect(parseXlsBuffer(wrapWorkbookStream(stream))).rejects.toThrow(`unsupported encryption type ${type}`);
		});
	}

	for (const name of ['rc4', 'cryptoapi128'] as const) {
		test(`${name} rejects every truncated FilePass prefix`, async () => {
			const stream = Buffer.from(encryptedXls[name], 'base64');
			const filePassOffset = 4 + stream.readUInt16LE(2);
			const metadataSize = stream.readUInt16LE(filePassOffset + 2);
			for (let size = 0; size < metadataSize; size += 1) {
				const truncated = Buffer.from(stream.subarray(0, filePassOffset + 4 + size));
				// Test both a short payload with a matching length and a truncated declared length.
				for (const declaredSize of [size, metadataSize]) {
					truncated.writeUInt16LE(declaredSize, filePassOffset + 2);
					await expect(parseXlsBuffer(wrapWorkbookStream(truncated))).rejects.toThrow('malformed FilePass metadata');
				}
			}
		});
	}

	const malformedCryptoApiFields = [
		{
			name: 'header size',
			offset: 10,
			value: 32,
		},
		{
			name: 'odd header size',
			offset: 10,
			value: 35,
		},
		{
			name: 'oversized header',
			offset: 10,
			value: 0xFF_FF_FF_FF,
		},
		{
			name: 'copied flags',
			offset: 6,
			value: 4,
		},
		{
			name: 'SizeExtra',
			offset: 18,
			value: 1,
		},
	];
	for (const { name, offset, value } of malformedCryptoApiFields) {
		test(`rejects malformed CryptoAPI ${name}`, async () => {
			const stream = Buffer.from(encryptedXls.cryptoapi128, 'base64');
			const metadataOffset = 8 + stream.readUInt16LE(2);
			stream.writeUInt32LE(value, metadataOffset + offset);
			await expect(parseXlsBuffer(wrapWorkbookStream(stream))).rejects.toThrow('malformed FilePass metadata');
		});
	}

	for (const [name, fieldOffset, value] of [['salt size', 0, 15], ['hash size', 36, 16]] as const) {
		test(`rejects malformed CryptoAPI verifier ${name}`, async () => {
			const stream = Buffer.from(encryptedXls.cryptoapi128, 'base64');
			const metadataOffset = 8 + stream.readUInt16LE(2);
			const verifierOffset = metadataOffset + 14 + stream.readUInt32LE(metadataOffset + 10);
			stream.writeUInt32LE(value, verifierOffset + fieldOffset);
			await expect(parseXlsBuffer(wrapWorkbookStream(stream))).rejects.toThrow('malformed FilePass metadata');
		});
	}

	test('rejects a non-terminated CryptoAPI provider name', async () => {
		const stream = Buffer.from(encryptedXls.cryptoapi128, 'base64');
		const metadataOffset = 8 + stream.readUInt16LE(2);
		const headerEnd = metadataOffset + 14 + stream.readUInt32LE(metadataOffset + 10);
		stream.writeUInt16LE(65, headerEnd - 2);
		await expect(parseXlsBuffer(wrapWorkbookStream(stream))).rejects.toThrow('malformed FilePass metadata');
	});

	test('rejects encrypted BIFF5 even in a legacy Book stream', async () => {
		const stream = Buffer.from(encryptedXls.rc4, 'base64');
		stream.writeUInt16LE(0x05_00, 4);
		const cfb = XLSX.CFB.utils.cfb_new();
		XLSX.CFB.utils.cfb_add(cfb, 'Book', stream);
		await expect(parseXlsBuffer(Buffer.from(XLSX.CFB.write(cfb) as Uint8Array))).rejects.toThrow('unsupported BIFF version 0x500');
	});

	test('rejects a misplaced FilePass instead of bypassing CryptoAPI verification', async () => {
		const stream = Buffer.from(encryptedXls.cryptoapi128, 'base64');
		const filePassOffset = 4 + stream.readUInt16LE(2);
		const misplaced = Buffer.concat([
			stream.subarray(0, filePassOffset),
			Buffer.from([0, 0, 0, 0]),
			stream.subarray(filePassOffset),
		]);
		await expect(parseXlsBuffer(wrapWorkbookStream(misplaced))).rejects.toThrow('malformed FilePass metadata: misplaced');
	});

	test('rejects an unsupported encrypted OOXML container', async () => {
		const cfb = XLSX.CFB.utils.cfb_new();
		XLSX.CFB.utils.cfb_add(cfb, 'EncryptionInfo', Buffer.from([4, 0, 4, 0]));
		await expect(parseXlsBuffer(Buffer.from(XLSX.CFB.write(cfb) as Uint8Array))).rejects.toThrow('unsupported encrypted container');
	});

	for (const [name, offset, value] of [['cipher', 22, 0x66_0E], ['hash', 26, 0x80_03], ['provider', 34, 24], ['key size', 30, 0]] as const) {
		test(`rejects unsupported CryptoAPI ${name}`, async () => {
			const stream = Buffer.from(encryptedXls.cryptoapi128, 'base64');
			const metadataOffset = 8 + stream.readUInt16LE(2);
			stream.writeUInt32LE(value, metadataOffset + offset);
			await expect(parseXlsBuffer(wrapWorkbookStream(stream))).rejects.toThrow('unsupported');
		});
	}

	test('preserves unrelated CryptoAPI failures without mislabeling them', async () => {
		const failure = new Error('Synthetic decryption failure');
		_setOfficeCryptoForTests({
			decrypt: async () => { throw failure; },
		});
		try {
			const bytes = wrapWorkbookStream(Buffer.from(encryptedXls.cryptoapi128, 'base64'));
			await expect(parseXlsBuffer(bytes)).rejects.toBe(failure);
		} finally {
			_resetOfficeCryptoForTests();
		}
	});
}, { parallel: false });

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
