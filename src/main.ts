import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_POSTGRES, VIEW_TYPE_QUERY_RESULT } from './constants';
import { registerSqlCodeBlock } from './editor/sql-code-block';
import { registerPostgresIcon } from './icons';
import {
	PgPluginSettings,
	PgSettingTab,
	normalizeSettings,
} from './settings';
import type { SchemaCache } from './types/schema';
import { getDefaultConnection } from './utils/settings-helpers';
import { onDefaultConnectionChanged } from './utils/schema-store';
import { PostgresView } from './views/postgres-view';
import { QueryResultView } from './views/query-result-view';

export default class PgPlugin extends Plugin {
	settings!: PgPluginSettings;
	schemaCache: SchemaCache | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		registerPostgresIcon();

		this.registerView(
			VIEW_TYPE_POSTGRES,
			(leaf) => new PostgresView(leaf, this),
		);

		this.registerView(
			VIEW_TYPE_QUERY_RESULT,
			(leaf) => new QueryResultView(leaf, this),
		);

		registerSqlCodeBlock(this);

		this.addRibbonIcon('postgres', 'PostgreSQL connections', () => {
			void this.activatePostgresView();
		});

		this.addCommand({
			id: 'open-postgres-connections',
			name: 'Open PostgreSQL connections',
			callback: () => {
				void this.activatePostgresView();
			},
		});

		this.addSettingTab(new PgSettingTab(this.app, this));

		if (getDefaultConnection(this)) {
			void onDefaultConnectionChanged(this);
		}
	}

	onunload(): void {}

	async loadSettings(): Promise<void> {
		const raw: unknown = await this.loadData();
		this.settings = normalizeSettings(raw);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async activatePostgresView(): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_POSTGRES);

		if (leaves.length > 0 && leaves[0]) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getLeaf('tab');
			await leaf.setViewState({
				type: VIEW_TYPE_POSTGRES,
				active: true,
			});
		}

		if (leaf) {
			void workspace.revealLeaf(leaf);
		} else {
			new Notice('Could not open PostgreSQL connections view.');
		}
	}
}
