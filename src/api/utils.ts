export const parseUnit = (text: string): number => {
	const trimmed = text.trim();
	if (trimmed === '100unit') { return 100; }
	return 1;
};

export const cleanCellText = (text: string): string => text.replace(/[*＊\s]+$/u, '').trim();

export const formatDate = (date: Date): string => {
	const y = date.getFullYear();
	const m = (date.getMonth() + 1).toString().padStart(2, '0');
	const d = date.getDate().toString().padStart(2, '0');
	return `${y}-${m}-${d}`;
};

export const formatDateId = (date: Date): string => {
	const y = date.getFullYear().toString().slice(-2);
	const m = (date.getMonth() + 1).toString().padStart(2, '0');
	const d = date.getDate().toString().padStart(2, '0');
	return `${y}${m}${d}`;
};

const isMidnightLocal = (date: Date) => date.getHours() === 0
	&& date.getMinutes() === 0
	&& date.getSeconds() === 0
	&& date.getMilliseconds() === 0;

const isMidnightUtc = (date: Date) => date.getUTCHours() === 0
	&& date.getUTCMinutes() === 0
	&& date.getUTCSeconds() === 0
	&& date.getUTCMilliseconds() === 0;

// Returns a local-midnight Date representing the calendar date.
//
// Date in JS is an instant, not a calendar date. Two common constructors
// produce different instants for the same calendar date:
//   new Date(2025, 0, 6)   → local midnight Jan 6
//   new Date('2025-01-06') → UTC midnight Jan 6
//
// We detect which one the caller used:
//   local midnight → read local fields (getFullYear/getMonth/getDate)
//   UTC midnight   → read UTC fields (getUTCFullYear/getUTCMonth/getUTCDate)
//   neither        → reject as ambiguous
export const parseDate = (input: string | Date): Date => {
	if (input instanceof Date) {
		if (Number.isNaN(input.getTime())) {
			throw new TypeError('Invalid Date');
		}

		if (isMidnightLocal(input)) {
			return new Date(input.getFullYear(), input.getMonth(), input.getDate());
		}

		if (isMidnightUtc(input)) {
			return new Date(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate());
		}

		throw new Error(
			'Ambiguous Date input — cannot determine calendar date. '
			+ 'Pass a YYYY-MM-DD string, new Date(year, month, day), or new Date(\'YYYY-MM-DD\').',
		);
	}

	const match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) { throw new Error(`Invalid date format: ${input} (expected YYYY-MM-DD)`); }
	const [, ys, ms, ds] = match;
	const date = new Date(Number(ys), Number(ms) - 1, Number(ds));
	const isInvalid = (
		date.getFullYear() !== Number(ys)
		|| date.getMonth() !== Number(ms) - 1
		|| date.getDate() !== Number(ds)
	);
	if (isInvalid) {
		throw new Error(`Invalid date: ${input}`);
	}
	return date;
};

export const computeTtm = (tts: number | null, ttb: number | null): number | null => {
	if (tts === null || ttb === null) { return null; }
	return Math.round(((tts + ttb) / 2) * 100) / 100;
};

export const parseRate = (text: string): number | null => {
	const trimmed = text.trim();
	if (!trimmed || trimmed === 'unquoted') { return null; }
	const value = Number.parseFloat(trimmed);
	return Number.isNaN(value) ? null : value;
};
