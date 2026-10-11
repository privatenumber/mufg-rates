import { cli } from 'cleye';
import { fetchWorld } from '../../api/fetch-world.ts';
import { jsonFlag } from '../flags.ts';
import { formatWorld } from '../format.ts';
import { exitOnError, style } from '../shared.ts';

const argv = cli({
	flags: {
		json: jsonFlag,
	},
});

const result = await exitOnError(fetchWorld());
if (argv.flags.json) {
	console.log(JSON.stringify(result));
} else {
	console.log(formatWorld(result, style));
}
