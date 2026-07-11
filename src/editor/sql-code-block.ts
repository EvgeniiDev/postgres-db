import { Notice, setIcon } from 'obsidian';
import type PgPlugin from '../main';
import {
	closeConnectionDropdown,
	openConnectionDropdown,
} from '../ui/connection-dropdown';
import { MAX_CONNECT_ATTEMPTS } from '../constants';
import { executeQuery } from '../utils/query';
import { refreshSchemaCache } from '../utils/schema-store';
import { applySqlSyntaxHighlighting } from '../utils/sql-highlight';
import { getDefaultConnection } from '../utils/settings-helpers';
import {
	ensureQueryResultPanel,
	openQueryResultPanel,
} from '../views/query-result-view';
import { registerSqlCodeEditExtension } from './sql-code-edit';
import { registerSqlKeywordSuggest } from './sql-keyword-suggest';
import { updateDbButton } from './sql-block-labels';

export function registerSqlCodeBlock(plugin: PgPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor(
		'sql',
		(source, el) => {
			renderSqlCodeBlock(plugin, source, el);
		},
		-10,
	);

	registerSqlCodeEditExtension(plugin);
	plugin.registerEditorSuggest(registerSqlKeywordSuggest(plugin));
	plugin.register(() => closeConnectionDropdown());
}

function renderSqlCodeBlock(
	plugin: PgPlugin,
	source: string,
	el: HTMLElement,
): void {
	el.empty();
	el.addClass('pg-sql-block');

	const header = el.createDiv({ cls: 'pg-sql-header' });

	const dbGroup = header.createDiv({ cls: 'pg-sql-db-group' });

	const dbBtn = dbGroup.createEl('button', {
		cls: 'pg-sql-db-btn',
		attr: { type: 'button' },
	});
	updateDbButton(plugin, dbBtn);

	dbBtn.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		openConnectionDropdown(plugin, () => updateDbButton(plugin, dbBtn));
	});

	const refreshBtn = dbGroup.createEl('button', {
		cls: 'pg-sql-refresh-btn clickable-icon',
		attr: {
			type: 'button',
			'aria-label': 'Refresh schema',
			title: 'Refresh schema',
		},
	});
	setIcon(refreshBtn, 'refresh-cw');
	refreshBtn.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		void handleSchemaRefresh(plugin);
	});

	const actions = header.createDiv({ cls: 'pg-sql-header-actions' });

	const copyBtn = actions.createEl('button', {
		cls: 'pg-sql-copy-btn clickable-icon',
		attr: {
			type: 'button',
			'aria-label': 'Copy SQL',
			title: 'Copy SQL',
		},
	});
	setIcon(copyBtn, 'copy');
	copyBtn.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		void copySql(source);
	});

	const runBtn = actions.createEl('button', {
		cls: 'pg-sql-run-btn clickable-icon',
		attr: {
			type: 'button',
			'aria-label': 'Run query',
			title: 'Run query',
		},
	});
	setIcon(runBtn, 'play');
	runBtn.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		void runSqlQuery(plugin, source, runBtn);
	});

	const codeEl = el.createEl('pre', { cls: 'pg-sql-code language-sql' });
	const codeInner = codeEl.createEl('code', { cls: 'language-sql' });
	applySqlSyntaxHighlighting(codeInner, source);
}

async function handleSchemaRefresh(plugin: PgPlugin): Promise<void> {
	const connection = getDefaultConnection(plugin);
	if (!connection) {
		new Notice('No database configured.');
		return;
	}

	try {
		await refreshSchemaCache(plugin);
	} catch {
		// Notice is shown in refreshSchemaCache.
	}
}

async function copySql(source: string): Promise<void> {
	const sql = source.trim();
	if (!sql) {
		new Notice('No SQL to copy.');
		return;
	}

	try {
		await navigator.clipboard.writeText(sql);
		new Notice('SQL copied to clipboard.');
	} catch {
		new Notice('Could not copy SQL to clipboard.');
	}
}

async function runSqlQuery(
	plugin: PgPlugin,
	source: string,
	runBtn: HTMLButtonElement,
): Promise<void> {
	const connection = getDefaultConnection(plugin);
	if (!connection) {
		new Notice(
			'No database configured. Add a connection in PostgreSQL settings.',
		);
		return;
	}

	runBtn.addClass('is-loading');
	runBtn.setAttribute('disabled', 'true');

	const resultView = await ensureQueryResultPanel(plugin);
	resultView?.setConnecting(source, 1, MAX_CONNECT_ATTEMPTS);

	try {
		const result = await executeQuery(connection, source, (attempt) => {
			resultView?.setConnecting(source, attempt, MAX_CONNECT_ATTEMPTS);
		});
		if (resultView) {
			resultView.setResult(source, result);
		} else {
			await openQueryResultPanel(plugin, source, result);
		}
	} finally {
		runBtn.removeClass('is-loading');
		runBtn.removeAttribute('disabled');
	}
}
