import type { SchemaTable } from '../types/schema';
import { getTableDisplayName } from './schema';

export type SqlSuggestMode = 'keyword' | 'table' | 'column';

const TABLE_CONTEXT_PATTERN =
	/(?:FROM|JOIN|INTO|UPDATE|TABLE)\s*$/i;

const COLUMN_TRIGGER_PATTERN =
	/(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\.([A-Za-z0-9_]*)$/;

const TABLE_ALIAS_PATTERN =
	/\b(?:FROM|JOIN)\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_.]*))(?:\s+(?:AS\s+)?([A-Za-z_][A-Za-z0-9_]*))?/gi;

const SQL_KEYWORD_SET = new Set([
	'select', 'from', 'where', 'join', 'inner', 'left', 'right', 'outer', 'on',
	'as', 'and', 'or', 'not', 'in', 'is', 'null', 'order', 'by', 'group',
	'having', 'limit', 'offset', 'insert', 'into', 'values', 'update', 'set',
	'delete', 'create', 'table', 'index', 'drop', 'alter', 'add', 'primary',
	'key', 'foreign', 'references', 'distinct', 'union', 'all', 'case', 'when',
	'then', 'else', 'end', 'exists', 'between', 'like', 'ilike', 'returning',
	'with', 'recursive', 'using', 'natural', 'cross', 'full', 'lateral', 'true',
	'false', 'asc', 'desc', 'count', 'sum', 'avg', 'min', 'max', 'coalesce',
	'cast', 'over', 'partition', 'row', 'rows', 'fetch', 'next', 'only',
	'intersect', 'except', 'any', 'some', 'array', 'json', 'jsonb', 'text',
	'varchar', 'integer', 'bigint', 'boolean', 'timestamp', 'date', 'time',
	'interval', 'numeric', 'decimal', 'real', 'double', 'precision', 'serial',
	'bigserial', 'uuid', 'bytea', 'if', 'elseif', 'loop', 'while', 'for',
	'declare', 'begin', 'commit', 'rollback', 'transaction', 'savepoint',
	'grant', 'revoke', 'truncate', 'replace', 'view', 'materialized', 'schema',
	'database', 'role', 'user', 'session', 'local', 'global', 'temporary', 'temp',
]);

export function parseTableAliases(sql: string): Map<string, string> {
	const aliases = new Map<string, string>();
	let match: RegExpExecArray | null;

	TABLE_ALIAS_PATTERN.lastIndex = 0;
	while ((match = TABLE_ALIAS_PATTERN.exec(sql)) !== null) {
		const tableRef = match[1] ?? match[2];
		const alias = match[3];
		if (!tableRef) {
			continue;
		}

		const tableName = tableRef.includes('.')
			? tableRef.split('.').pop() ?? tableRef
			: tableRef;

		aliases.set(tableName.toLowerCase(), tableRef);

		if (alias && !SQL_KEYWORD_SET.has(alias.toLowerCase())) {
			aliases.set(alias.toLowerCase(), tableRef);
		}
	}

	return aliases;
}

export function detectSuggestMode(
	beforeCursor: string,
): {
	mode: SqlSuggestMode;
	query: string;
	qualifier?: string;
	includesLeadingQuote?: boolean;
} | null {
	const columnMatch = beforeCursor.match(COLUMN_TRIGGER_PATTERN);
	if (columnMatch) {
		const qualifier = columnMatch[1] ?? columnMatch[2];
		const query = columnMatch[3] ?? '';
		if (!qualifier) {
			return null;
		}
		return { mode: 'column', query, qualifier };
	}

	const quotedMatch = beforeCursor.match(/"([A-Za-z_]*)$/);
	if (quotedMatch) {
		const query = quotedMatch[1] ?? '';
		const beforeWord = beforeCursor.slice(
			0,
			beforeCursor.length - quotedMatch[0].length,
		);
		return {
			mode: isTableContext(beforeWord) ? 'table' : 'keyword',
			query,
			includesLeadingQuote: true,
		};
	}

	const wordMatch = beforeCursor.match(/[A-Za-z_][A-Za-z0-9_]*$/);
	if (!wordMatch) {
		return null;
	}

	const query = wordMatch[0];
	const beforeWord = beforeCursor.slice(
		0,
		beforeCursor.length - query.length,
	);

	return {
		mode: isTableContext(beforeWord) ? 'table' : 'keyword',
		query,
	};
}

function isTableContext(beforeWord: string): boolean {
	return TABLE_CONTEXT_PATTERN.test(beforeWord);
}

function hasUppercaseCharacter(name: string): boolean {
	return /[A-Z]/.test(name);
}

export function quoteIdentifierIfNeeded(name: string): string {
	return hasUppercaseCharacter(name) ? `"${name}"` : name;
}

export function formatQualifiedIdentifier(qualified: string): string {
	return qualified
		.split('.')
		.map(quoteIdentifierIfNeeded)
		.join('.');
}

function filterCompletedPrefixMatches(
	names: string[],
	query: string,
): string[] {
	const lower = query.toLowerCase();
	const matches = names.filter((name) =>
		name.toLowerCase().startsWith(lower),
	);

	// Exact complete token with no longer alternatives → dismiss popup.
	if (
		query.length > 0 &&
		matches.some((name) => name.toLowerCase() === lower) &&
		!matches.some((name) => name.toLowerCase() !== lower)
	) {
		return [];
	}

	return matches;
}

export function filterTableSuggestions(
	tables: SchemaTable[],
	query: string,
	limit: number,
): string[] {
	return filterCompletedPrefixMatches(
		tables.map(getTableDisplayName),
		query,
	)
		.map(formatQualifiedIdentifier)
		.slice(0, limit);
}

export function filterColumnSuggestions(
	columns: { name: string }[],
	query: string,
	limit: number,
): string[] {
	return filterCompletedPrefixMatches(
		columns.map((col) => col.name),
		query,
	)
		.map(quoteIdentifierIfNeeded)
		.slice(0, limit);
}
