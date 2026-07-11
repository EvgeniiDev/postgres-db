import type { QueryResult } from './query';

function escapeCsvCell(value: unknown): string {
	if (value === null || value === undefined) {
		return '';
	}

	let text: string;
	if (typeof value === 'string') {
		text = value;
	} else if (
		typeof value === 'number' ||
		typeof value === 'boolean' ||
		typeof value === 'bigint'
	) {
		text = String(value);
	} else {
		text = JSON.stringify(value);
	}

	if (/[",\n\r]/.test(text)) {
		return `"${text.replace(/"/g, '""')}"`;
	}

	return text;
}

export function buildQueryResultCsv(result: QueryResult): string {
	const lines: string[] = [];
	lines.push(result.columns.map(escapeCsvCell).join(','));

	for (const row of result.rows) {
		const cells = result.columns.map((column) =>
			escapeCsvCell(row[column]),
		);
		lines.push(cells.join(','));
	}

	return `${lines.join('\n')}\n`;
}
