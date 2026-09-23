import { ItemView, Notice, WorkspaceLeaf, setIcon } from 'obsidian';
import { MAX_CONNECT_ATTEMPTS, VIEW_TYPE_QUERY_RESULT } from '../constants';
import type PgPlugin from '../main';
import { closeCellValuePopup, openCellValuePopup } from '../ui/cell-value-popup';
import { formatCellValue } from '../utils/cell-value';
import { QueryResult } from '../utils/query';
import { saveQueryResultCsv } from '../utils/save-query-result';

export class QueryResultView extends ItemView {
	plugin: PgPlugin;
	private bodyEl!: HTMLElement;
	private metaEl!: HTMLElement;
	private saveBtn!: HTMLButtonElement;
	private currentResult: QueryResult | null = null;
	private exportBaseName = 'query-result';

	constructor(leaf: WorkspaceLeaf, plugin: PgPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_QUERY_RESULT;
	}

	getDisplayText(): string {
		return 'SQL results';
	}

	getIcon(): string {
		return 'postgres';
	}

	async onOpen(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('pg-query-result-root');

		const header = containerEl.createDiv({ cls: 'pg-query-result-header' });
		header.createEl('h4', { text: 'SQL results' });

		const headerActions = header.createDiv({
			cls: 'pg-query-result-header-actions',
		});

		this.saveBtn = headerActions.createEl('button', {
			cls: 'clickable-icon pg-query-result-save',
			attr: {
				type: 'button',
				'aria-label': 'Save results as CSV',
				title: 'Save results to Downloads',
			},
		});
		setIcon(this.saveBtn, 'download');
		this.saveBtn.toggleAttribute('disabled', true);
		this.saveBtn.addClass('is-disabled');
		this.saveBtn.addEventListener('click', () => {
			void this.handleSaveResult();
		});

		const closeBtn = headerActions.createEl('button', {
			cls: 'clickable-icon',
			attr: { 'aria-label': 'Close', type: 'button' },
		});
		setIcon(closeBtn, 'x');
		closeBtn.addEventListener('click', () => {
			void this.leaf.detach();
		});

		this.metaEl = containerEl.createDiv({ cls: 'pg-query-result-meta' });
		this.bodyEl = containerEl.createDiv({ cls: 'pg-query-result-body' });
		this.renderEmptyState();
	}

	async onClose(): Promise<void> {
		closeCellValuePopup();
		this.containerEl.empty();
	}

	setConnecting(
		sql: string,
		attempt: number,
		maxAttempts: number = MAX_CONNECT_ATTEMPTS,
	): void {
		closeCellValuePopup();
		this.currentResult = null;
		this.updateSaveButton(false);
		this.renderSqlMeta(sql);

		const stats = this.metaEl.createDiv({ cls: 'pg-query-result-stats' });
		stats.setText(`Connecting… attempt ${attempt} of ${maxAttempts}`);

		this.bodyEl.empty();
		const loader = this.bodyEl.createDiv({ cls: 'pg-query-result-loading' });
		loader.createDiv({ cls: 'pg-query-result-spinner' });
		loader.createDiv({
			cls: 'pg-query-result-loading-text',
			text: 'Trying to connect to the database…',
		});
	}

	setResult(sql: string, result: QueryResult): void {
		closeCellValuePopup();
		this.currentResult = result;
		this.exportBaseName =
			this.app.workspace.getActiveFile()?.basename ?? 'query-result';
		this.updateSaveButton(
			result.success && result.rows.length > 0,
		);
		this.renderSqlMeta(sql);

		const stats = this.metaEl.createDiv({ cls: 'pg-query-result-stats' });
		if (result.success) {
			const parts = [`${result.durationMs} ms`];
			if (result.connectionAttempts && result.connectionAttempts > 1) {
				parts.push(`connected on attempt ${result.connectionAttempts}`);
			}
			if (result.command) {
				parts.push(result.command);
			}
			if (result.rowCount > 0) {
				parts.push(`${result.rowCount} row(s)`);
			}
			if (result.truncated) {
				parts.push(`showing first ${result.rows.length}`);
			}
			stats.setText(parts.join(' · '));
		} else {
			const parts = [`${result.durationMs} ms`, 'Error'];
			if (result.connectionAttempts) {
				parts.push(
					`failed after ${result.connectionAttempts} connection attempt(s)`,
				);
			}
			stats.setText(parts.join(' · '));
		}

		this.bodyEl.empty();

		if (!result.success) {
			this.bodyEl.createEl('pre', {
				cls: 'pg-query-result-error',
				text: result.error ?? 'Query failed.',
			});
			return;
		}

		if (result.rows.length === 0) {
			this.bodyEl.createDiv({
				cls: 'pg-query-result-empty',
				text: 'Query executed successfully. No rows returned.',
			});
			return;
		}

		if (this.isTextResult(result)) {
			this.renderTextResult(result);
			return;
		}

		this.renderTable(result);
	}

	private isTextResult(result: QueryResult): boolean {
		// EXPLAIN returns a single "QUERY PLAN" text column — a table with
		// truncated cells is unreadable for it, render as plain text.
		return (
			result.columns.length === 1 &&
			result.columns[0]?.trim().toLowerCase() === 'query plan'
		);
	}

	private renderTextResult(result: QueryResult): void {
		const column = result.columns[0] as string;
		const text = result.rows
			.map((row) => formatCellValue(row[column]))
			.join('\n');
		const planEl = this.bodyEl.createEl('pre', {
			cls: 'pg-query-plan',
			text,
		});
		const planFontSize = this.plugin.settings.planFontSize;
		if (planFontSize > 0) {
			planEl.style.fontSize = `${planFontSize}px`;
		}
	}

	private updateSaveButton(enabled: boolean): void {
		this.saveBtn.toggleAttribute('disabled', !enabled);
		this.saveBtn.toggleClass('is-disabled', !enabled);
	}

	private async handleSaveResult(): Promise<void> {
		if (
			!this.currentResult?.success ||
			this.currentResult.rows.length === 0
		) {
			new Notice('No results to save.');
			return;
		}

		this.saveBtn.addClass('is-loading');
		this.saveBtn.toggleAttribute('disabled', true);

		try {
			await saveQueryResultCsv(this.currentResult, this.exportBaseName);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: 'Could not save results.';
			new Notice(message);
		} finally {
			this.saveBtn.removeClass('is-loading');
			this.updateSaveButton(
				this.currentResult?.success === true &&
					(this.currentResult?.rows.length ?? 0) > 0,
			);
		}
	}

	private renderSqlMeta(sql: string): void {
		this.metaEl.empty();
		this.metaEl.createEl('pre', {
			cls: 'pg-query-result-sql',
			text: sql.trim(),
		});
	}

	private renderEmptyState(): void {
		this.metaEl.empty();
		this.bodyEl.empty();
		this.bodyEl.createDiv({
			cls: 'pg-query-result-empty',
			text: 'Run a SQL query to see results here.',
		});
	}

	private renderTable(result: QueryResult): void {
		const tableWrap = this.bodyEl.createDiv({ cls: 'pg-query-table-wrap' });
		const table = tableWrap.createEl('table', { cls: 'pg-query-table' });
		const thead = table.createEl('thead');
		const headRow = thead.createEl('tr');

		for (const column of result.columns) {
			headRow.createEl('th', { text: column });
		}

		const tbody = table.createEl('tbody');
		for (const row of result.rows) {
			const tr = tbody.createEl('tr');
			for (const column of result.columns) {
				const value = row[column];
				const cell = tr.createEl('td');
				if (value === null || value === undefined) {
					cell.createSpan({ cls: 'pg-query-null', text: 'NULL' });
				} else {
					const fullText = formatCellValue(value);
					cell.setText(fullText);
					cell.addClass('pg-query-cell-expandable');
					cell.setAttr('title', 'Click to view full value');
					cell.addEventListener('click', (event) => {
						event.preventDefault();
						event.stopPropagation();
						openCellValuePopup(cell, value);
					});
				}
			}
		}
	}
}

export async function ensureQueryResultPanel(
	plugin: PgPlugin,
): Promise<QueryResultView | null> {
	const { workspace } = plugin.app;
	let leaf = workspace.getLeavesOfType(VIEW_TYPE_QUERY_RESULT)[0];

	if (!leaf) {
		const rightLeaf = workspace.getRightLeaf(false);
		if (!rightLeaf) {
			return null;
		}
		leaf = rightLeaf;
		await leaf.setViewState({
			type: VIEW_TYPE_QUERY_RESULT,
			active: true,
		});
	}

	const view = leaf.view;
	if (!(view instanceof QueryResultView)) {
		return null;
	}

	void workspace.revealLeaf(leaf);
	return view;
}

export async function openQueryResultPanel(
	plugin: PgPlugin,
	sql: string,
	result: QueryResult,
): Promise<void> {
	const view = await ensureQueryResultPanel(plugin);
	view?.setResult(sql, result);
}
