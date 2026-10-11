import type { Ansis } from 'ansis';
import stringWidth from 'string-width';

export type Column = {
	header: string;
	align?: 'left' | 'right';
};

const padCell = (text: string, width: number, align: 'left' | 'right'): string => {
	const padding = width - stringWidth(text);
	if (padding <= 0) { return text; }
	const spaces = ' '.repeat(padding);
	return align === 'right' ? spaces + text : text + spaces;
};

// Accepts an Ansis instance for TTY-aware header styling.
export const formatTable = (columns: Column[], rows: string[][], style: Ansis): string => {
	const columnWidths = columns.map((column, index) => {
		const headerWidth = column.header.length;
		const dataWidth = Math.max(0, ...rows.map(row => stringWidth(row[index] ?? '')));
		return Math.max(headerWidth, dataWidth);
	});

	const gap = '  ';

	const buildLine = (cells: string[]) => columns
		.map((column, index) => padCell(
			cells[index] ?? '',
			columnWidths[index],
			column.align ?? 'left',
		))
		.join(gap)
		.trimEnd();

	const headerLine = buildLine(
		columns.map(column => style.dim(column.header)),
	);

	const dataLines = rows.map(row => buildLine(row));

	return [headerLine, ...dataLines].join('\n');
};
