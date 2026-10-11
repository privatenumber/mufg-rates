import { writeFile } from 'node:fs/promises';
import { cli } from 'cleye';
import { downloadArchiveSource, getArchiveSourceUrl } from '../../api/archive.ts';
import { exitOnError } from '../shared.ts';

const argv = cli({
	parameters: ['<year>'],
	flags: {
		output: {
			type: String,
			alias: 'o',
			description: 'Output XLS path',
		},
	},
});

const year = Number(argv._.year);
const outputPath = argv.flags.output ?? `murc_${year}.xls`;
const xlsBuffer = await exitOnError(downloadArchiveSource(year));
await exitOnError(writeFile(outputPath, new Uint8Array(xlsBuffer)));
console.log(`Downloaded ${getArchiveSourceUrl(year)} to ${outputPath}`);
