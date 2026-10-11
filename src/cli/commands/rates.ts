import { cli } from 'cleye';
import { fetchRates } from '../../api/fetch-rates.ts';
import { currencyFlag, jsonFlag } from '../flags.ts';
import { formatRates } from '../format.ts';
import {
	exitOnError, filterCurrency, requireResult, style,
} from '../shared.ts';

const argv = cli({
	parameters: ['<date>'],
	flags: {
		currency: currencyFlag,
		json: jsonFlag,
	},
});

const result = requireResult(
	await exitOnError(fetchRates(argv._.date)),
	'No rates found for this date (non-business day or out of range)',
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
	console.log(formatRates(filtered, style));
}
