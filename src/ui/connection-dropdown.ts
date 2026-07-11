import { Notice, setIcon } from 'obsidian';
import type PgPlugin from '../main';
import {
	getConnectionLabel,
	getConnectionSummary,
} from '../utils/connection';
import {
	getDefaultConnection,
	setDefaultConnection,
} from '../utils/settings-helpers';
import { refreshSqlBlockLabels } from '../editor/sql-block-labels';

let activeDropdown: HTMLElement | null = null;
let closeHandler: ((event: MouseEvent) => void) | null = null;

export function closeConnectionDropdown(): void {
	if (closeHandler) {
		activeDocument.removeEventListener('mousedown', closeHandler, true);
		closeHandler = null;
	}
	activeDropdown?.remove();
	activeDropdown = null;
}

export function openConnectionDropdown(
	plugin: PgPlugin,
	onChanged?: () => void,
): void {
	closeConnectionDropdown();

	const connections = plugin.settings.connections;
	if (connections.length === 0) {
		new Notice('No saved connections. Add one in PostgreSQL settings.');
		return;
	}

	const defaultId = getDefaultConnection(plugin)?.id ?? null;

	const backdrop = activeDocument.body.createDiv({
		cls: 'pg-connection-dropdown-backdrop',
	});
	activeDropdown = backdrop;

	const dropdown = backdrop.createDiv({ cls: 'pg-connection-dropdown' });
	dropdown.createEl('h4', { text: 'Select default database' });

	const list = dropdown.createDiv({ cls: 'pg-connection-dropdown-list' });

	for (const connection of connections) {
		const isDefault = connection.id === defaultId;
		const item = list.createDiv({
			cls: `pg-connection-dropdown-item${isDefault ? ' is-selected' : ''}`,
		});

		const labelCol = item.createDiv({ cls: 'pg-connection-dropdown-label' });
		labelCol.createDiv({
			cls: 'pg-connection-dropdown-name',
			text: getConnectionLabel(connection),
		});
		labelCol.createDiv({
			cls: 'pg-connection-dropdown-summary',
			text: getConnectionSummary(connection),
		});

		if (isDefault) {
			item.createSpan({
				cls: 'pg-connection-dropdown-check',
				text: 'Default',
			});
		}

		item.addEventListener('click', () => {
			void (async () => {
				await setDefaultConnection(plugin, connection.id);
				refreshSqlBlockLabels(plugin);
				onChanged?.();
				closeConnectionDropdown();
				new Notice(
					`Default database set to ${getConnectionLabel(connection)}.`,
				);
			})();
		});
	}

	const closeBtn = dropdown.createEl('button', {
		cls: 'pg-connection-dropdown-close clickable-icon',
		attr: { 'aria-label': 'Close', type: 'button' },
	});
	setIcon(closeBtn, 'x');
	closeBtn.addEventListener('click', () => closeConnectionDropdown());

	closeHandler = (event: MouseEvent) => {
		const target = event.target;
		if (!(target instanceof Node)) {
			return;
		}
		if (!backdrop.contains(target)) {
			closeConnectionDropdown();
		}
	};

	window.requestAnimationFrame(() => {
		if (closeHandler) {
			activeDocument.addEventListener('mousedown', closeHandler, true);
		}
	});
}
