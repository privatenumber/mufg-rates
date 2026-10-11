import { readFile } from 'node:fs/promises';
import { cli } from 'cleye';
import { parseArchiveWorkbook } from '../../api/archive.ts';
import { jsonFlag } from '../flags.ts';
import { formatArchive } from '../format.ts';
import { exitOnError, style } from '../shared.ts';

const argv = cli({
	parameters: ['<file>'],
	flags: {
		json: jsonFlag,
	},
});

const xlsBuffer = await exitOnError(readFile(argv._.file));
const result = await exitOnError(parseArchiveWorkbook(xlsBuffer));
if (argv.flags.json) {
	console.log(JSON.stringify(result));
} else {
	console.log(formatArchive(result, style));
}
