import { App, PluginSettingTab, Setting } from 'obsidian';
import type PgPlugin from './main';
import { PostgresConnection } from './types/connection';
import { migrateLegacyConnection } from './utils/connection';

export interface PgPluginSettings {
	connections: PostgresConnection[];
	defaultConnectionId: string | null;
}

export const DEFAULT_SETTINGS: PgPluginSettings = {
	connections: [],
	defaultConnectionId: null,
};

export function normalizeSettings(raw: unknown): PgPluginSettings {
	const data =
		raw && typeof raw === 'object'
			? (raw as Partial<PgPluginSettings> & {
					connections?: unknown[];
				})
			: {};

	const connections = (data.connections ?? [])
		.map((item) =>
			migrateLegacyConnection(
				item && typeof item === 'object'
					? (item as unknown as Record<string, unknown>)
					: {},
			),
		)
		.filter((item): item is PostgresConnection => item !== null);

	const defaultConnectionId =
		typeof data.defaultConnectionId === 'string' &&
		connections.some((c) => c.id === data.defaultConnectionId)
			? data.defaultConnectionId
			: (connections[0]?.id ?? null);

	return {
		connections,
		defaultConnectionId,
	};
}

export class PgSettingTab extends PluginSettingTab {
	plugin: PgPlugin;

	constructor(app: App, plugin: PgPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('p', {
			text: 'Manage PostgreSQL connections from the ribbon icon or command palette.',
		});

		new Setting(containerEl)
			.setName('Saved connections')
			.setDesc(
				`${this.plugin.settings.connections.length} connection(s) saved`,
			);
	}
}
