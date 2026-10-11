import { cli } from 'cleye';
import { fetchMonthly } from '../../api/fetch-monthly.ts';
import { currencyFlag, jsonFlag } from '../flags.ts';
import { formatMonthly } from '../format.ts';
import {
	exitOnError, filterCurrency, requireResult, style,
} from '../shared.ts';

const argv = cli({
	parameters: ['<year>', '<month>'],
	flags: {
		currency: currencyFlag,
		json: jsonFlag,
	},
});

const result = requireResult(
	await exitOnError(fetchMonthly(Number(argv._.year), Number(argv._.month))),
	'No monthly rates found for this period',
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
	console.log(formatMonthly(filtered, style));
}
