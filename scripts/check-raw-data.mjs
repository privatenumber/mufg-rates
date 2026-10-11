import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import spawn from 'nano-spawn';

const { stdout: trackedFilesOutput } = await spawn('git', ['ls-files', '-z']);

const trackedFiles = trackedFilesOutput
	.split('\0')
	.filter(Boolean);

const blockedPathPatterns = [
	{
		pattern: /^tests\/fixtures\//,
		reason: 'tracked fixture snapshots must not be published',
	},
	{
		pattern: /^RESEARCH\.md$/,
		reason: 'source research belongs in ignored local notes, not the package repo',
	},
];

const blockedDataExtensions = new Set([
	'.csv',
	'.xls',
	'.xlsx',
]);

const blockedContentPatterns = [
	{
		pattern: new RegExp(String.raw`${'MUFG Bank, Ltd'}\. ${'Exchange Quotations'}`, 'i'),
		reason: 'copied exchange-rate page text',
	},
	{
		pattern: new RegExp(['Final official quotation', 'by MUFG'].join(' '), 'i'),
		reason: 'copied exchange-rate page text',
	},
	{
		pattern: new RegExp(['Foreign Central Banks,', 'The MUFG Bank'].join(' '), 'i'),
		reason: 'copied world-rate CSV text',
	},
	{
		pattern: new RegExp(['Mitsubishi UFJ', 'Research and Consulting'].join(' '), 'i'),
		reason: 'copied source-page attribution text',
	},
	{
		pattern: /\u4E09\u83F1UFJ\u9280\u884C\u516C\u8868\u76F8\u5834/u,
		reason: 'copied source-page heading',
	},
	{
		pattern: /\u4E2D\u56FD\u5916\u8CA8\u53D6\u5F15\u30BB\u30F3\u30BF\u30FC/u,
		reason: 'copied reference-rate source label',
	},
];

const violations = [];

for (const file of trackedFiles) {
	if (!existsSync(file)) {
		continue;
	}

	for (const { pattern, reason } of blockedPathPatterns) {
		if (pattern.test(file)) {
			violations.push(`${file}: ${reason}`);
		}
	}

	const extension = path.extname(file).toLowerCase();
	if (blockedDataExtensions.has(extension)) {
		violations.push(`${file}: tracked raw data file extension ${extension}`);
	}
	if (/(?:^|\/)(?:fixtures?|snapshots?)\/.*\.html?$/i.test(file)) {
		violations.push(`${file}: tracked HTML fixture snapshot`);
	}

	const bytes = readFileSync(file);
	if (bytes.includes(0)) {
		continue;
	}

	const text = bytes.toString('utf8');
	for (const { pattern, reason } of blockedContentPatterns) {
		if (pattern.test(text)) {
			violations.push(`${file}: ${reason}`);
		}
	}
}

if (violations.length > 0) {
	console.error('Raw-data audit failed:');
	for (const violation of violations) {
		console.error(`- ${violation}`);
	}
	process.exit(1);
}

console.log('Raw-data audit passed.');
