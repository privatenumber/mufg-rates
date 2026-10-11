import { fetchRates } from './fetch-rates.ts';
import { formatDate, parseDate } from './utils.ts';
import type {
	ConvertCurrencyOptions, ConvertCurrencyResult, ConversionRateType,
} from './types.ts';

const supportedRateTypes = new Set<ConversionRateType>(['tts', 'ttb', 'ttm']);

export const convertCurrency = async (
	options: ConvertCurrencyOptions,
): Promise<ConvertCurrencyResult | null> => {
	if (!Number.isFinite(options.amount)) {
		throw new TypeError(`Invalid amount: ${options.amount}`);
	}

	const from = options.from.trim().toUpperCase();
	const to = options.to.trim().toUpperCase();
	const rate = options.rate ?? 'ttm';
	if (!supportedRateTypes.has(rate)) {
		throw new Error(`Invalid rate: ${rate} (expected tts, ttb, or ttm)`);
	}

	const convertsFromJpy = from === 'JPY';
	const jpyCurrencyCount = Number(convertsFromJpy) + Number(to === 'JPY');
	if (jpyCurrencyCount !== 1) {
		throw new Error('convertCurrency only supports conversions between JPY and one foreign currency');
	}

	const requestedDate = parseDate(options.date);
	const ratesResult = await fetchRates(requestedDate);
	if (!ratesResult) {
		return null;
	}

	const currency = convertsFromJpy
		? to
		: from;
	const quote = ratesResult.rates[currency];
	if (!quote) {
		throw new Error(`Currency ${currency} not found in rates for ${ratesResult.date}`);
	}

	const rateValue = quote[rate];
	if (rateValue === null) {
		throw new Error(`Currency ${currency} has no ${rate.toUpperCase()} rate for ${ratesResult.date}`);
	}

	const convertedAmount = convertsFromJpy
		? (options.amount / rateValue) * quote.unit
		: (options.amount * rateValue) / quote.unit;

	return {
		source: ratesResult.source,
		requestedDate: formatDate(requestedDate),
		sourceDate: ratesResult.date,
		amount: options.amount,
		from,
		to,
		rate,
		rateValue,
		unit: quote.unit,
		convertedAmount,
	};
};
