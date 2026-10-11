const historicalHundredUnitCurrencies = new Set(['BEF', 'ESP', 'ITL']);

export const normalizeDailyRateCode = (
	code: string,
	name: string,
	nameJa: string,
): string => {
	if (
		code === '\u30B3\u30DE\u30FC\u30B7\u30E3\u30EB'
		&& (name === 'Belgian Franc' || nameJa === '\u30D9\u30EB\u30AE\u30FC\u30FB\u30D5\u30E9\u30F3')
	) {
		return 'BEF';
	}

	return code;
};

export const getDailyRateUnit = (code: string, year: number): number => {
	if (code === 'IDR' || code === 'KRW') {
		return 100;
	}

	if (historicalHundredUnitCurrencies.has(code) && year <= 2001) {
		return 100;
	}

	if (code === 'MXP' && year <= 1992) {
		return 100;
	}

	return 1;
};
