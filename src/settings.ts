import { App, PluginSettingTab, Setting } from 'obsidian';
import type PgPlugin from './main';
import { PostgresConnection } from './types/connection';
import { migrateLegacyConnection } from './utils/connection';

export interface PgPluginSettings {
	connections: PostgresConnection[];
	defaultConnectionId: string | null;
	planFontSize: number;
}

export const DEFAULT_SETTINGS: PgPluginSettings = {
	connections: [],
	defaultConnectionId: null,
	planFontSize: 0,
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

	const planFontSize =
		typeof data.planFontSize === 'number' &&
		Number.isFinite(data.planFontSize) &&
		data.planFontSize >= 0 &&
		data.planFontSize <= 18
			? data.planFontSize
			: 0;

	return {
		connections,
		defaultConnectionId,
		planFontSize,
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

		new Setting(containerEl)
			.setName('EXPLAIN plan font size')
			.setDesc(
				'Font size in px for EXPLAIN output in the results panel. 0 = theme default. Applies to new results.',
			)
			.addSlider((slider) =>
				slider
					.setLimits(0, 18, 1)
					.setValue(this.plugin.settings.planFontSize)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.planFontSize = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
