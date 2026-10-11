import { cli } from 'cleye';
import { convertCurrency } from '../../api/convert-currency.ts';
import type { ConversionRateType } from '../../api/types.ts';
import { jsonFlag } from '../flags.ts';
import { formatConversion } from '../format.ts';
import {
	exitOnError, requireResult, style,
} from '../shared.ts';

const fail = (message: string): never => {
	console.error(message);
	process.exit(1);
	throw new Error(message);
};

const requireFlag = <T>(
	value: T,
	name: string,
): Exclude<T, undefined> => {
	if (value === undefined) {
		fail(`Missing required flag: --${name}`);
	}
	if (typeof value === 'string' && value === '') {
		fail(`Missing required flag: --${name}`);
	}
	return value as Exclude<T, undefined>;
};

const parseConversionRate = (rate: string | undefined): ConversionRateType | undefined => {
	if (rate === undefined) {
		return undefined;
	}

	const normalized = rate.toLowerCase();
	if (normalized === 'tts' || normalized === 'ttb' || normalized === 'ttm') {
		return normalized;
	}

	return fail(`Invalid rate: ${rate} (expected tts, ttb, or ttm)`);
};

const argv = cli({
	flags: {
		amount: {
			type: Number,
			alias: 'a',
			description: 'Amount to convert',
		},
		from: {
			type: String,
			alias: 'f',
			description: 'Source currency code',
		},
		to: {
			type: String,
			alias: 't',
			description: 'Target currency code',
		},
		date: {
			type: String,
			alias: 'd',
			description: 'Conversion date (YYYY-MM-DD)',
		},
		rate: {
			type: String,
			alias: 'r',
			description: 'Rate type: tts, ttb, or ttm',
		},
		json: jsonFlag,
	},
});

const result = requireResult(
	await exitOnError(convertCurrency({
		amount: requireFlag(argv.flags.amount, 'amount'),
		from: requireFlag(argv.flags.from, 'from'),
		to: requireFlag(argv.flags.to, 'to'),
		date: requireFlag(argv.flags.date, 'date'),
		rate: parseConversionRate(argv.flags.rate),
	})),
	'No rates found for this date (non-business day or out of range)',
);
if (argv.flags.json) {
	console.log(JSON.stringify(result));
} else {
	console.log(formatConversion(result, style));
}
