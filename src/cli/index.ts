import { cli } from 'cleye';

const argv = cli({
	name: 'murc-rates',
	commands: {
		rates: {
			description: 'Fetch exchange rates for a date',
			loader: () => import('./commands/rates.ts'),
		},
		daily: {
			description: 'Fetch daily exchange rates',
			loader: () => import('./commands/daily.ts'),
		},
		convert: {
			description: 'Convert between JPY and one foreign currency',
			loader: () => import('./commands/convert.ts'),
		},
		monthly: {
			description: 'Fetch monthly exchange rates',
			loader: () => import('./commands/monthly.ts'),
		},
		yearly: {
			description: 'Fetch yearly exchange rates',
			loader: () => import('./commands/yearly.ts'),
		},
		world: {
			description: 'Fetch world currency quotations',
			loader: () => import('./commands/world.ts'),
		},
		reference: {
			description: 'Fetch yearly reference rates',
			loader: () => import('./commands/reference.ts'),
		},
		'download-source': {
			description: 'Download the official archive XLS file',
			loader: () => import('./commands/download-source.ts'),
		},
		'parse-archive': {
			description: 'Parse a local archive XLS file',
			loader: () => import('./commands/parse-archive.ts'),
		},
	},
});

await argv.runCommand();
