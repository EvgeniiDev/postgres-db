const SQL_KEYWORD_LIST = [
	'select',
	'from',
	'where',
	'join',
	'inner',
	'left',
	'right',
	'outer',
	'on',
	'as',
	'and',
	'or',
	'not',
	'in',
	'is',
	'null',
	'order',
	'by',
	'group',
	'having',
	'limit',
	'offset',
	'insert',
	'into',
	'values',
	'update',
	'set',
	'delete',
	'create',
	'table',
	'index',
	'drop',
	'alter',
	'add',
	'primary',
	'key',
	'foreign',
	'references',
	'distinct',
	'union',
	'all',
	'case',
	'when',
	'then',
	'else',
	'end',
	'exists',
	'between',
	'like',
	'ilike',
	'returning',
	'with',
	'cascade',
	'constraint',
	'default',
	'true',
	'false',
	'asc',
	'desc',
	'full',
	'cross',
	'natural',
	'using',
	'explain',
	'analyze',
	'cast',
	'coalesce',
	'count',
	'sum',
	'avg',
	'min',
	'max',
	'over',
	'partition',
	'window',
	'fetch',
	'next',
	'only',
	'rows',
	'range',
	'intersect',
	'except',
	'grant',
	'revoke',
	'truncate',
	'view',
	'replace',
	'if',
	'begin',
	'commit',
	'rollback',
	'transaction',
	'conflict',
	'do',
	'nothing',
] as const;

export { SQL_KEYWORD_LIST };

const SQL_KEYWORDS = new Set<string>(SQL_KEYWORD_LIST);

function appendToken(
	container: HTMLElement,
	className: string,
	text: string,
): void {
	container.createSpan({ cls: `token ${className}`, text });
}

function renderSqlTokens(container: HTMLElement, source: string): void {
	let i = 0;

	while (i < source.length) {
		const rest = source.slice(i);

		const lineComment = rest.match(/^--[^\n]*/);
		if (lineComment) {
			appendToken(container, 'comment', lineComment[0]);
			i += lineComment[0].length;
			continue;
		}

		const blockComment = rest.match(/^\/\*[\s\S]*?\*\//);
		if (blockComment) {
			appendToken(container, 'comment', blockComment[0]);
			i += blockComment[0].length;
			continue;
		}

		const stringMatch = rest.match(/^'(?:''|[^'])*'/);
		if (stringMatch) {
			appendToken(container, 'string', stringMatch[0]);
			i += stringMatch[0].length;
			continue;
		}

		const dblStringMatch = rest.match(/^"(?:""|[^"])*"/);
		if (dblStringMatch) {
			appendToken(container, 'string', dblStringMatch[0]);
			i += dblStringMatch[0].length;
			continue;
		}

		const numberMatch = rest.match(/^\b\d+(?:\.\d+)?\b/);
		if (numberMatch) {
			appendToken(container, 'number', numberMatch[0]);
			i += numberMatch[0].length;
			continue;
		}

		const wordMatch = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/);
		if (wordMatch) {
			const word = wordMatch[0];
			if (SQL_KEYWORDS.has(word.toLowerCase())) {
				appendToken(container, 'keyword', word);
			} else {
				container.appendText(word);
			}
			i += word.length;
			continue;
		}

		container.appendText(source[i] ?? '');
		i += 1;
	}
}

export function applySqlSyntaxHighlighting(
	code: HTMLElement,
	source: string,
): void {
	if (code.querySelector('span')) {
		return;
	}

	code.empty();
	renderSqlTokens(code, source);
}
