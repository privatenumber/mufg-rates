import crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import { formatDate } from './utils.ts';
import { fetchSource } from './fetch-source.ts';

/* eslint-disable no-bitwise -- RC4 and BIFF8 record parsing require bitwise operations */
const rc4Transform = (key: Uint8Array, data: Uint8Array): Uint8Array => {
	const state = new Uint8Array(256);
	for (let i = 0; i < 256; i += 1) {
		state[i] = i;
	}
	let j = 0;
	for (let i = 0; i < 256; i += 1) {
		j = (j + state[i]! + key[i % key.length]!) & 0xFF;
		[state[i], state[j]] = [state[j]!, state[i]!];
	}
	const output = new Uint8Array(data.length);
	let si = 0;
	let sj = 0;
	for (let k = 0; k < data.length; k += 1) {
		si = (si + 1) & 0xFF;
		sj = (sj + state[si]!) & 0xFF;
		[state[si], state[sj]] = [state[sj]!, state[si]!];
		output[k] = data[k]! ^ state[(state[si]! + state[sj]!) & 0xFF]!;
	}
	return output;
};

const biff8Rc4DeriveKey = (password: string, salt: Uint8Array, block: number): Uint8Array => {
	const passwordBuffer = Buffer.from(password, 'utf16le');
	const h0 = crypto.createHash('md5').update(passwordBuffer).digest();
	const truncated = h0.subarray(0, 5);
	const unit = Buffer.concat([truncated, salt]);
	const parts: Buffer[] = [];
	for (let i = 0; i < 16; i += 1) {
		parts.push(unit);
	}
	const h1 = crypto.createHash('md5').update(Buffer.concat(parts)).digest();
	const blockBytes = Buffer.alloc(4);
	blockBytes.writeUInt32LE(block, 0);
	return crypto.createHash('md5').update(Buffer.concat([h1.subarray(0, 5), blockBytes])).digest();
};

// Records that MUST NOT be encrypted per [MS-OFFCRYPTO]
const NON_ENCRYPTED_RECORDS = new Set([
	0x08_09, // BOF
	0x00_2F, // FilePass
	0x01_94, // UsrExcl
	0x01_95, // FileLock
	0x00_E1, // InterfaceHdr
	0x01_96, // RRDInfo
	0x01_38, // RRDHead
]);

const FILEPASS_RECORD = 0x00_2F;
const BOUNDSHEET8_RECORD = 0x00_85;
const BLOCK_SIZE = 1024;

const decryptBiff8Rc4 = (data: Uint8Array, salt: Uint8Array): Uint8Array => {
	const plainBytes: number[] = [];
	const encryptedParts: Uint8Array[] = [];
	let offset = 0;

	while (offset < data.length - 3) {
		const recordType = data[offset]! | (data[offset + 1]! << 8);
		const recordSize = data[offset + 2]! | (data[offset + 3]! << 8);
		const recordEnd = offset + 4 + recordSize;

		if (recordType === FILEPASS_RECORD) {
			// Zero out FilePass to remove encryption marker
			plainBytes.push(0, 0, data[offset + 2]!, data[offset + 3]!);
			for (let i = 0; i < recordSize; i += 1) {
				plainBytes.push(0);
			}
			encryptedParts.push(new Uint8Array(4 + recordSize));
		} else if (NON_ENCRYPTED_RECORDS.has(recordType)) {
			for (let i = offset; i < recordEnd; i += 1) {
				plainBytes.push(data[i]!);
			}
			encryptedParts.push(new Uint8Array(4 + recordSize));
		} else if (recordType === BOUNDSHEET8_RECORD) {
			// Header + lbPlyPos (4 bytes) are plaintext; rest is encrypted
			for (let i = offset; i < offset + 8; i += 1) {
				plainBytes.push(data[i]!);
			}
			for (let i = 0; i < recordSize - 4; i += 1) {
				plainBytes.push(-2);
			}
			encryptedParts.push(
				new Uint8Array(8),
				data.slice(offset + 8, recordEnd),
			);
		} else {
			// Record header is plaintext, data is encrypted
			for (let i = offset; i < offset + 4; i += 1) {
				plainBytes.push(data[i]!);
			}
			for (let i = 0; i < recordSize; i += 1) {
				plainBytes.push(-1);
			}
			encryptedParts.push(
				new Uint8Array(4),
				data.slice(offset + 4, recordEnd),
			);
		}

		offset = recordEnd;
	}

	let totalLength = 0;
	for (const part of encryptedParts) {
		totalLength += part.length;
	}
	const encryptedBuffer = new Uint8Array(totalLength);
	let position = 0;
	for (const part of encryptedParts) {
		encryptedBuffer.set(part, position);
		position += part.length;
	}

	const decryptedBuffer = new Uint8Array(encryptedBuffer.length);
	let block = 0;
	for (let i = 0; i < encryptedBuffer.length; i += BLOCK_SIZE) {
		const key = biff8Rc4DeriveKey('VelvetSweatshop', salt, block);
		const chunk = encryptedBuffer.subarray(i, Math.min(i + BLOCK_SIZE, encryptedBuffer.length));
		decryptedBuffer.set(rc4Transform(key, chunk), i);
		block += 1;
	}

	const result = new Uint8Array(plainBytes.length);
	for (let i = 0; i < plainBytes.length; i += 1) {
		result[i] = plainBytes[i]! < 0 ? decryptedBuffer[i]! : plainBytes[i]!;
	}
	return result;
};

type FilePassInfo = {
	type: 'rc4';
	salt: Uint8Array;
} | {
	type: 'cryptoapi';
};

const findFilePass = (data: Uint8Array): FilePassInfo | null => {
	let offset = 0;
	while (offset < Math.min(data.length, 500)) {
		const recordType = data[offset]! | (data[offset + 1]! << 8);
		const recordSize = data[offset + 2]! | (data[offset + 3]! << 8);
		if (recordType === FILEPASS_RECORD) {
			const major = data[offset + 6]! | (data[offset + 7]! << 8);
			if (major === 1) {
				// Standard BIFF8 RC4 — decrypt with our custom implementation
				const salt = data.slice(offset + 4 + 6, offset + 4 + 6 + 16);
				return {
					type: 'rc4',
					salt,
				};
			}
			// RC4 CryptoAPI (major=2+) — defer to officecrypto-tool
			return { type: 'cryptoapi' };
		}
		offset += 4 + recordSize;
	}
	return null;
};
/* eslint-enable no-bitwise */

// Lazy-loaded when CryptoAPI encryption is encountered.
type OfficeCrypto = {
	decrypt: (buffer: Buffer, options: { password: string }) => Promise<Buffer>;
};

let officeCrypto: OfficeCrypto | undefined;

const getOfficeCrypto = async () => {
	if (!officeCrypto) {
		const module = await import('officecrypto-tool') as { default: OfficeCrypto };
		officeCrypto = module.default;
	}
	return officeCrypto;
};

// Test hook for offline CryptoAPI coverage after removing copied encrypted XLS fixtures.
// Not exported from the package root.
export const _setOfficeCryptoForTests = (officeCryptoImplementation: OfficeCrypto) => {
	officeCrypto = officeCryptoImplementation;
};

export const _resetOfficeCryptoForTests = () => {
	officeCrypto = undefined;
};

export type XlsInput = ArrayBuffer | ArrayBufferView;

export const parseXlsBuffer = async (input: XlsInput): Promise<XLSX.WorkBook> => {
	const xlsBuffer = input instanceof ArrayBuffer
		? new Uint8Array(input)
		: new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
	// Check if the Workbook stream is RC4-encrypted (BIFF8 with FILEPASS record)
	const cfb = XLSX.CFB.read(xlsBuffer, { type: 'array' });
	const workbookEntry = cfb.FileIndex.find((entry: { name: string }) => entry.name === 'Workbook');
	if (!workbookEntry) {
		return XLSX.read(xlsBuffer, { type: 'array' });
	}

	const data = new Uint8Array(workbookEntry.content);
	const filePass = findFilePass(data);
	if (!filePass) {
		return XLSX.read(xlsBuffer, { type: 'array' });
	}

	if (filePass.type === 'rc4') {
		// Standard BIFF8 RC4 — decrypt with our custom implementation
		workbookEntry.content = decryptBiff8Rc4(data, filePass.salt);
		return XLSX.read(XLSX.CFB.write(cfb), { type: 'array' });
	}

	// RC4 CryptoAPI — use officecrypto-tool (handles CryptoAPI decryption)
	const oc = await getOfficeCrypto();
	const decrypted = await oc.decrypt(Buffer.from(xlsBuffer), { password: 'VelvetSweatshop' });
	return XLSX.read(decrypted, { type: 'buffer' });
};

export const fetchXls = async (url: string): Promise<XLSX.WorkBook> => {
	const response = await fetchSource(url);
	if (response.status < 200 || response.status >= 300) {
		throw new Error(`HTTP ${response.status}: ${url}`);
	}
	const xlsBuffer = await response.arrayBuffer();
	return parseXlsBuffer(xlsBuffer);
};

export const getSheet = (workbook: XLSX.WorkBook, name: string): XLSX.WorkSheet => {
	const sheet = workbook.Sheets[name];
	if (!sheet) {
		throw new Error(`Sheet '${name}' not found. Available: ${workbook.SheetNames.join(', ')}`);
	}
	return sheet;
};

export type CellValue = string | number | null;
export type Row = CellValue[];

export const sheetToRows = (sheet: XLSX.WorkSheet): Row[] => (
	XLSX.utils.sheet_to_json(sheet, {
		header: 1,
		defval: null,
	})
);

export const excelDateToIso = (serial: number): string => {
	// Excel serial date: days since Jan 0, 1900 (with Lotus 1-2-3 bug at serial 60)
	// For dates after Feb 28, 1900 (serial > 59), subtract 1 to account for the phantom Feb 29
	const adjustedSerial = serial > 59 ? serial - 1 : serial;
	const epoch = new Date(1900, 0, 1); // Jan 1, 1900
	const date = new Date(epoch.getTime() + (adjustedSerial - 1) * 86_400_000);
	return formatDate(date);
};
