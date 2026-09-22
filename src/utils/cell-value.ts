export const MAX_CELL_DISPLAY_LENGTH = 120;

export function formatCellValue(value: unknown): string {
	if (value === null || value === undefined) {
		return '';
	}
	if (typeof value === 'string') {
		return value;
	}
	if (
		typeof value === 'number' ||
		typeof value === 'boolean' ||
		typeof value === 'bigint'
	) {
		return String(value);
	}
	return JSON.stringify(value);
}

export function truncateCellDisplay(text: string): string {
	if (text.length <= MAX_CELL_DISPLAY_LENGTH) {
		return text;
	}
	return `${text.slice(0, MAX_CELL_DISPLAY_LENGTH)}...`;
}

export function isJsonLikeValue(value: unknown): boolean {
	if (value === null || value === undefined) {
		return false;
	}

	if (typeof value === 'object') {
		return true;
	}

	if (typeof value !== 'string') {
		return false;
	}

	const trimmed = value.trim();
	if (!trimmed) {
		return false;
	}

	if (
		(trimmed.startsWith('{') && trimmed.endsWith('}')) ||
		(trimmed.startsWith('[') && trimmed.endsWith(']'))
	) {
		try {
			JSON.parse(trimmed);
			return true;
		} catch {
			return false;
		}
	}

	return false;
}

export function formatValueForPopup(value: unknown): string {
	if (value === null || value === undefined) {
		return 'NULL';
	}

	if (typeof value === 'object') {
		return JSON.stringify(value, null, 2);
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (isJsonLikeValue(value)) {
			try {
				return JSON.stringify(JSON.parse(trimmed), null, 2);
			} catch {
				return value;
			}
		}
		return value;
	}

	if (
		typeof value === 'number' ||
		typeof value === 'boolean' ||
		typeof value === 'bigint'
	) {
		return String(value);
	}

	return JSON.stringify(value, null, 2);
}
