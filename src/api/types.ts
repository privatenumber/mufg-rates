export type RateValues = {
	tts: number | null;
	ttb: number | null;
	ttm: number | null;
};

// fetchRates
export type Rate = RateValues & {
	name: string;
	nameJa: string;
	unit: number;
};

export type RatesResult = {
	source: string;
	date: string;
	rates: Record<string, Rate>;
};

// convertCurrency
export type ConversionRateType = 'tts' | 'ttb' | 'ttm';

export type ConvertCurrencyOptions = {
	amount: number;
	from: string;
	to: string;
	date: string | Date;
	rate?: ConversionRateType;
};

export type ConvertCurrencyResult = {
	source: string;
	requestedDate: string;
	sourceDate: string;
	amount: number;
	from: string;
	to: string;
	rate: ConversionRateType;
	rateValue: number;
	unit: number;
	convertedAmount: number;
};

// fetchDaily
export type DailyRate = Rate;

export type CashRate = {
	selling: number;
	buying: number;
};

export type DailyResult = {
	source: string;
	date: string;
	rates: Record<string, DailyRate>;
	cashRates: Record<string, CashRate>;
};

// fetchMonthly
export type MonthlyRate = {
	name: string;
	nameJa: string;
	unit: number;
	monthEnd: RateValues;
	monthlyAverage: RateValues;
};

export type LocalMarketRate = {
	nameJa: string;
	name: string;
	selling: number | null;
	buying: number | null;
	sourceJa: string;
	source: string;
};

export type MonthlyResult = {
	source: string;
	year: number;
	month: number;
	rates: Record<string, MonthlyRate>;
	localMarketRates: Record<string, LocalMarketRate>;
};

// fetchYearly
export type YearlyRate = {
	name: string;
	nameJa: string;
	unit: number;
	yearEnd: RateValues;
	yearlyAverage: RateValues;
};

export type YearlyResult = {
	source: string;
	year: number;
	rates: Record<string, YearlyRate>;
};

// fetchWorld
export type WorldRate = {
	country: string;
	countryJa: string;
	currency: string;
	code: string;
	quotation: string;
	marketLevel: string;
	remarks: string;
};

export type WorldResult = {
	source: string;
	date: string;
	asia: WorldRate[];
	africa: WorldRate[];
	europe: WorldRate[];
	mideast: WorldRate[];
	americas: WorldRate[];
};

// fetchReference
export type ReferenceDailyRate = {
	date: string;
	tts: number | null;
	ttb: number | null;
};

export type ReferenceMonthlySummary = {
	month: number;
	high: number | null;
	low: number | null;
	average: number | null;
};

export type ReferenceCurrency = {
	sourceJa: string;
	rates: {
		perUsd?: ReferenceDailyRate[];
		perJpy?: ReferenceDailyRate[];
	};
	monthlySummary: ReferenceMonthlySummary[];
};

export type ReferenceResult = {
	source: string[];
	year: number;
	currencies: Record<string, ReferenceCurrency>;
};

// archive workbook
export type ArchiveDailyRate = {
	date: string;
	tts: number;
	ttb: number;
	ttm: number;
};

export type ArchiveMonthlySummary = {
	month: number;
	high: number;
	low: number;
	average: number;
};

export type ArchiveAnnualSummary = {
	high: number;
	low: number;
	average: number;
};

export type ArchiveCurrency = {
	daily: ArchiveDailyRate[];
	monthly: ArchiveMonthlySummary[];
	annual: ArchiveAnnualSummary;
};

export type ArchiveResult = {
	source: string;
	year: number;
	currencies: Record<string, ArchiveCurrency>;
};
