import { Ansis } from 'ansis';

export const style = new Ansis(process.stdout.isTTY ? 1 : 0);

const fail = (message: string): never => {
	console.error(message);
	process.exit(1);
	throw new Error(message);
};

export const exitOnError = async <T>(operation: Promise<T>): Promise<T> => {
	try {
		return await operation;
	} catch (error) {
		return fail(error instanceof Error ? error.message : String(error));
	}
};

export const requireResult = <T>(
	value: T,
	message: string,
): NonNullable<T> => {
	if (value === null || value === undefined) {
		fail(message);
	}
	return value as NonNullable<T>;
};

export const filterCurrency = <T>(
	rates: Record<string, T>,
	currency: string,
): Record<string, T> => {
	const filtered = rates[currency];
	if (!filtered) {
		fail(`Currency ${currency} not found in results`);
	}
	return { [currency]: filtered };
};
