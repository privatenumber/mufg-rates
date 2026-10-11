import { cli } from 'cleye';
import { fetchYearly } from '../../api/fetch-yearly.ts';
import { currencyFlag, jsonFlag } from '../flags.ts';
import { formatYearly } from '../format.ts';
import {
	exitOnError, filterCurrency, requireResult, style,
} from '../shared.ts';

const argv = cli({
	parameters: ['<year>'],
	flags: {
		currency: currencyFlag,
		json: jsonFlag,
	},
});

const result = requireResult(
	await exitOnError(fetchYearly(Number(argv._.year))),
	'No yearly rates found for this year',
);
const filtered = argv.flags.currency
	? {
		...result,
		rates: filterCurrency(result.rates, argv.flags.currency),
	}
	: result;
if (argv.flags.json) {
	console.log(JSON.stringify(filtered));
} else {
	console.log(formatYearly(filtered, style));
}
