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
const defaultPassword = 'VelvetSweatshop';
const passwordMismatchMessage = "Cannot open encrypted workbook: Excel's default password did not match.";
const malformedFilePassMessage = 'Cannot open encrypted workbook: malformed FilePass metadata';

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
		const key = biff8Rc4DeriveKey(defaultPassword, salt, block);
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
	encryptedVerifier: Uint8Array;
	encryptedVerifierHash: Uint8Array;
} | {
	type: 'cryptoapi';
};

const validateCryptoApiAlgorithms = (metadata: DataView): void => {
	const flags = metadata.getUint32(14, true);
	const algorithm = metadata.getUint32(22, true);
	const hashAlgorithm = metadata.getUint32(26, true);
	const keySize = metadata.getUint32(30, true);
	const providerType = metadata.getUint32(34, true);
	if ((flags & 0x34) !== 0x04 || algorithm !== 0x68_01 || hashAlgorithm !== 0x80_04
		|| providerType !== 1) {
		throw new Error(`Cannot open encrypted workbook: unsupported CryptoAPI algorithms (flags 0x${flags.toString(16)}, cipher 0x${algorithm.toString(16)}, hash 0x${hashAlgorithm.toString(16)}, provider ${providerType}).`);
	}
	// officecrypto-tool does not interpret KeySize=0 as the specification's 40-bit default.
	if (keySize < 40 || keySize > 128 || keySize % 8 !== 0) {
		throw new Error(`Cannot open encrypted workbook: unsupported RC4 CryptoAPI key size ${keySize}.`);
	}
};

const parseCryptoApiMetadata = (metadata: DataView): FilePassInfo => {
	// MS-OFFCRYPTO 2.3.5.1: version, flags, header size, header, then verifier.
	if (metadata.byteLength < 14) {
		throw new Error(`${malformedFilePassMessage}: truncated CryptoAPI header.`);
	}
	const headerSize = metadata.getUint32(10, true);
	const verifierOffset = 14 + headerSize;
	if (headerSize < 34 || headerSize % 2 !== 0 || verifierOffset + 60 !== metadata.byteLength) {
		throw new Error(`${malformedFilePassMessage}: invalid CryptoAPI header or verifier size.`);
	}
	if (metadata.getUint32(6, true) !== metadata.getUint32(14, true)
		|| metadata.getUint32(18, true) !== 0
		|| metadata.getUint16(verifierOffset - 2, true) !== 0) {
		throw new Error(`${malformedFilePassMessage}: invalid CryptoAPI header fields.`);
	}
	if (metadata.getUint32(verifierOffset, true) !== 16
		|| metadata.getUint32(verifierOffset + 36, true) !== 20) {
		throw new Error(`${malformedFilePassMessage}: invalid CryptoAPI salt or verifier hash size.`);
	}
	validateCryptoApiAlgorithms(metadata);
	return { type: 'cryptoapi' };
};

const parseFilePass = (bytes: Uint8Array): FilePassInfo => {
	const metadata = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (bytes.length < 2) {
		throw new Error(`${malformedFilePassMessage}: missing encryption type.`);
	}
	const encryptionType = metadata.getUint16(0, true);
	if (encryptionType === 0) {
		if (bytes.length !== 6) {
			throw new Error(`${malformedFilePassMessage}: invalid XOR metadata size.`);
		}
		throw new Error('Cannot open encrypted workbook: unsupported encryption type 0 (XOR obfuscation).');
	}
	if (encryptionType !== 1) {
		throw new Error(`Cannot open encrypted workbook: unsupported encryption type ${encryptionType}.`);
	}
	if (bytes.length < 6) {
		throw new Error(`${malformedFilePassMessage}: truncated encryption version.`);
	}
	const major = metadata.getUint16(2, true);
	const minor = metadata.getUint16(4, true);
	const version = `${major}.${minor}`;
	if (version === '1.1') {
		if (bytes.length !== 54) {
			throw new Error(`${malformedFilePassMessage}: standard RC4 requires a 16-byte salt, verifier, and verifier hash.`);
		}
		return {
			type: 'rc4',
			salt: bytes.subarray(6, 22),
			encryptedVerifier: bytes.subarray(22, 38),
			encryptedVerifierHash: bytes.subarray(38, 54),
		};
	}
	if (['2.2', '3.2', '4.2'].includes(version)) {
		return parseCryptoApiMetadata(metadata);
	}
	throw new Error(`Cannot open encrypted workbook: unsupported encryption version ${major}.${minor} (type ${encryptionType}).`);
};

const validateFilePassPosition = (records: DataView, offset: number): void => {
	if (records.getUint16(0, true) !== 0x08_09 || records.getUint16(2, true) < 4) {
		throw new Error(`${malformedFilePassMessage}: missing workbook BOF.`);
	}
	const biffVersion = records.getUint16(4, true);
	if (biffVersion !== 0x06_00) {
		throw new Error(`Cannot open encrypted workbook: unsupported BIFF version 0x${biffVersion.toString(16)}.`);
	}
	// MS-XLS Globals Substream grammar: FilePass follows BOF and optional WriteProtect.
	// https://learn.microsoft.com/en-us/openspecs/office_file_formats/ms-xls/ca4c1748-8729-4a93-abb9-4602b3a01fb1
	let expectedOffset = 4 + records.getUint16(2, true);
	if (records.getUint16(expectedOffset, true) === 0x00_86) {
		expectedOffset += 4 + records.getUint16(expectedOffset + 2, true);
	}
	if (offset !== expectedOffset) {
		throw new Error(`${malformedFilePassMessage}: misplaced FilePass record.`);
	}
};

const findFilePass = (data: Uint8Array): FilePassInfo | null => {
	const records = new DataView(data.buffer, data.byteOffset, data.byteLength);
	let offset = 0;
	while (offset < data.length) {
		if (offset + 4 > data.length) {
			throw new Error('Malformed XLS workbook: truncated BIFF record header.');
		}
		const recordType = records.getUint16(offset, true);
		const recordSize = records.getUint16(offset + 2, true);
		const recordEnd = offset + 4 + recordSize;
		if (recordEnd > data.length) {
			throw new Error(recordType === FILEPASS_RECORD
				? `${malformedFilePassMessage}: truncated FilePass record.`
				: 'Malformed XLS workbook: truncated BIFF record.');
		}
		if (recordType === FILEPASS_RECORD) {
			validateFilePassPosition(records, offset);
			return parseFilePass(data.subarray(offset + 4, recordEnd));
		}
		if (recordType === 0x00_0A) {
			return null;
		}
		offset = recordEnd;
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

// Test hook for CryptoAPI error-propagation coverage.
// Not exported from the package root.
export const _setOfficeCryptoForTests = (officeCryptoImplementation: OfficeCrypto) => {
	officeCrypto = officeCryptoImplementation;
};

export const _resetOfficeCryptoForTests = () => {
	officeCrypto = undefined;
};

const decryptCryptoApiWorkbook = async (bytes: Uint8Array): Promise<Buffer> => {
	const oc = await getOfficeCrypto();
	try {
		return await oc.decrypt(Buffer.from(bytes), { password: defaultPassword });
	} catch (error) {
		// officecrypto-tool's XLS verifier throws this exact message before stream decryption.
		if (error instanceof Error && error.message === 'The password is incorrect') {
			throw new Error(passwordMismatchMessage, { cause: error });
		}
		throw error;
	}
};

export type XlsInput = ArrayBuffer | ArrayBufferView;

export const parseXlsBuffer = async (input: XlsInput): Promise<XLSX.WorkBook> => {
	const xlsBuffer = input instanceof ArrayBuffer
		? new Uint8Array(input)
		: new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
	// Check if the Workbook stream is RC4-encrypted (BIFF8 with FILEPASS record)
	const cfb = XLSX.CFB.read(xlsBuffer, { type: 'array' });
	const workbookEntry = cfb.FileIndex.find((entry: { name: string }) => entry.name === 'Workbook' || entry.name === 'Book');
	if (!workbookEntry) {
		if (cfb.FileIndex.some((entry: { name: string }) => entry.name === 'EncryptionInfo' || entry.name === 'EncryptedPackage')) {
			throw new Error('Cannot open encrypted workbook: unsupported encrypted container (expected a BIFF8 Workbook stream).');
		}
		return XLSX.read(xlsBuffer, { type: 'array' });
	}

	const data = new Uint8Array(workbookEntry.content);
	const filePass = findFilePass(data);
	if (!filePass) {
		return XLSX.read(xlsBuffer, { type: 'array' });
	}

	if (filePass.type === 'rc4') {
		// MS-OFFCRYPTO 2.3.6.4: one continuous block-0 RC4 stream for both fields.
		// https://learn.microsoft.com/en-us/openspecs/office_file_formats/ms-offcrypto/d07d501d-ae3a-48f7-8dfc-f1710eff4099
		const key = biff8Rc4DeriveKey(defaultPassword, filePass.salt, 0);
		const verifierBytes = rc4Transform(key, Buffer.concat([
			filePass.encryptedVerifier,
			filePass.encryptedVerifierHash,
		]));
		const verifierHash = crypto.createHash('md5').update(verifierBytes.subarray(0, 16)).digest();
		if (!crypto.timingSafeEqual(verifierHash, verifierBytes.subarray(16))) {
			throw new Error(passwordMismatchMessage);
		}
		workbookEntry.content = decryptBiff8Rc4(data, filePass.salt);
		return XLSX.read(XLSX.CFB.write(cfb), { type: 'array' });
	}

	// RC4 CryptoAPI — use officecrypto-tool (handles CryptoAPI decryption)
	const decrypted = await decryptCryptoApiWorkbook(xlsBuffer);
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
