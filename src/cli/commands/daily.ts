import { cli } from 'cleye';
import { fetchDaily } from '../../api/fetch-daily.ts';
import { currencyFlag, jsonFlag } from '../flags.ts';
import { formatDaily } from '../format.ts';
import {
	exitOnError, filterCurrency, requireResult, style,
} from '../shared.ts';

const argv = cli({
	parameters: ['[date]'],
	flags: {
		currency: currencyFlag,
		json: jsonFlag,
	},
});

const result = requireResult(
	await exitOnError(fetchDaily(argv._.date)),
	'No daily rates found for this date (non-business day or out of range)',
);
const filtered = argv.flags.currency
	? {
		...result,
		rates: filterCurrency(result.rates, argv.flags.currency),
		cashRates: result.cashRates[argv.flags.currency]
			? { [argv.flags.currency]: result.cashRates[argv.flags.currency] }
			: {},
	}
	: result;
if (argv.flags.json) {
	console.log(JSON.stringify(filtered));
} else {
	console.log(formatDaily(filtered, style));
}
