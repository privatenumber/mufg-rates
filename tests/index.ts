import { describe } from 'manten';
import { createFixtureFetch } from './helpers/fixture-source-fetch.ts';

// Default: offline fixture-backed tests. Set MUFG_LIVE=1 for network tests.
if (!process.env.MUFG_LIVE) {
	globalThis.fetch = createFixtureFetch();
}

describe('murc-rates', () => {
	import('./utils.ts');
	import('./convert-currency.ts');
	import('./fetch-rates.ts');
	import('./fetch-daily.ts');
	import('./fetch-monthly.ts');
	import('./fetch-yearly.ts');
	import('./fetch-world.ts');
	import('./parse-xls.ts');
	import('./fetch-reference.ts');
	import('./archive.ts');
	import('./format-table.ts');
	import('./format.ts');
	import('./cli.ts');
});
