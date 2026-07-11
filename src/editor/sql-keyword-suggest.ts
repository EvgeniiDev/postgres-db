import {
	Editor,
	EditorPosition,
	EditorSuggest,
	type EditorSuggestContext,
	type EditorSuggestTriggerInfo,
	type TFile,
} from 'obsidian';
import type PgPlugin from '../main';
import type { SchemaCache } from '../types/schema';
import { getColumnsForQualifier } from '../utils/schema';
import { getActiveSchemaCache } from '../utils/schema-store';
import { SQL_KEYWORD_LIST } from '../utils/sql-highlight';
import {
	detectSuggestMode,
	filterColumnSuggestions,
	filterTableSuggestions,
	parseTableAliases,
	type SqlSuggestMode,
} from '../utils/sql-suggest-context';
import { isInsideSqlCodeBlockEditor } from './sql-editor-context';

export class SqlKeywordSuggest extends EditorSuggest<string> {
	private plugin: PgPlugin;
	private suggestMode: SqlSuggestMode = 'keyword';
	private columnQualifier = '';
	private includesLeadingQuote = false;
	private suppressTriggerUntil = 0;

	constructor(plugin: PgPlugin) {
		super(plugin.app);
		this.plugin = plugin;
		this.limit = 20;
	}

	onTrigger(
		cursor: EditorPosition,
		editor: Editor,
		_file: TFile | null,
	): EditorSuggestTriggerInfo | null {
		if (Date.now() < this.suppressTriggerUntil) {
			return null;
		}

		if (!isInsideSqlCodeBlockEditor(editor, cursor)) {
			return null;
		}

		const line = editor.getLine(cursor.line);
		const before = line.slice(0, cursor.ch);
		const detected = detectSuggestMode(before);
		if (!detected) {
			return null;
		}

		this.suggestMode = detected.mode;
		this.columnQualifier = detected.qualifier ?? '';
		this.includesLeadingQuote = detected.includesLeadingQuote ?? false;

		const query = detected.query;
		if (!query && detected.mode !== 'column') {
			return null;
		}

		let startCh = cursor.ch - query.length;
		if (this.includesLeadingQuote) {
			startCh -= 1;
		}

		return {
			start: { line: cursor.line, ch: startCh },
			end: cursor,
			query,
		};
	}

	getSuggestions(context: EditorSuggestContext): string[] {
		const query = context.query;
		const schemaCache = getActiveSchemaCache(this.plugin);
		const sql = context.editor.getValue();

		if (this.suggestMode === 'column' && schemaCache) {
			const aliasMap = parseTableAliases(sql);
			const columns = getColumnsForQualifier(
				schemaCache.tables,
				this.columnQualifier,
				aliasMap,
			);
			return filterColumnSuggestions(columns, query, this.limit);
		}

		return this.mergeSchemaAndKeywordSuggestions(schemaCache, query);
	}

	private mergeSchemaAndKeywordSuggestions(
		schemaCache: SchemaCache | null,
		query: string,
	): string[] {
		const lowerQuery = query.toLowerCase();
		const results: string[] = [];
		const seen = new Set<string>();

		const add = (items: string[]): void => {
			for (const item of items) {
				const key = item.toLowerCase();
				if (seen.has(key)) {
					continue;
				}
				seen.add(key);
				results.push(item);
				if (results.length >= this.limit) {
					return;
				}
			}
		};

		if (schemaCache) {
			add(
				filterTableSuggestions(
					schemaCache.tables,
					query,
					this.limit,
				),
			);
		}

		add(
			SQL_KEYWORD_LIST.filter((keyword) =>
				keyword.startsWith(lowerQuery),
			).map((keyword) => keyword.toUpperCase()),
		);

		return results.slice(0, this.limit);
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.setText(value);
	}

	selectSuggestion(value: string, _evt: MouseEvent | KeyboardEvent): void {
		const context = this.context;
		if (!context) {
			return;
		}

		// Trailing space ends the token so the popup does not reopen on the
		// same identifier (especially for alias.column completions).
		const insertText = `${value} `;
		context.editor.replaceRange(
			insertText,
			context.start,
			context.end,
		);
		context.editor.setCursor({
			line: context.start.line,
			ch: context.start.ch + insertText.length,
		});
		this.suppressTriggerUntil = Date.now() + 150;
		this.close();
	}
}

export function registerSqlKeywordSuggest(
	plugin: PgPlugin,
): SqlKeywordSuggest {
	return new SqlKeywordSuggest(plugin);
}
