export function isInsideSqlBlockFromLines(
	getLine: (index: number) => string,
	currentLineIndex: number,
): boolean {
	let inSqlBlock = false;

	for (let lineIndex = 0; lineIndex <= currentLineIndex; lineIndex++) {
		const text = getLine(lineIndex).trim();
		if (!text.startsWith('```')) {
			continue;
		}
		if (/^```\s*$/.test(text)) {
			inSqlBlock = false;
			continue;
		}
		inSqlBlock = /^```sql\b/i.test(text);
	}

	const currentLine = getLine(currentLineIndex).trim();
	if (/^```/.test(currentLine)) {
		return false;
	}

	return inSqlBlock;
}

export function isInsideFencedCodeBlockFromLines(
	getLine: (index: number) => string,
	currentLineIndex: number,
): boolean {
	let inCodeBlock = false;

	for (let lineIndex = 0; lineIndex <= currentLineIndex; lineIndex++) {
		const text = getLine(lineIndex).trim();
		if (!text.startsWith('```')) {
			continue;
		}
		if (/^```\s*$/.test(text)) {
			inCodeBlock = false;
			continue;
		}
		inCodeBlock = true;
	}

	const currentLine = getLine(currentLineIndex).trim();
	if (/^```/.test(currentLine)) {
		return false;
	}

	return inCodeBlock;
}
