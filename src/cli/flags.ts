export const currencyFlag = {
	type: String,
	alias: 'c',
	description: 'Filter output to a single currency code',
} as const;

export const jsonFlag = {
	type: Boolean,
	description: 'Output as compact JSON',
} as const;
