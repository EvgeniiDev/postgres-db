import type PgPlugin from '../main';
import { getConnectionHeaderLabel } from '../utils/connection';
import { getDefaultConnection } from '../utils/settings-helpers';

export function updateDbButton(
	plugin: PgPlugin,
	btn: HTMLButtonElement,
): void {
	const connection = getDefaultConnection(plugin);
	btn.empty();

	if (!connection) {
		btn.setText('No database');
		btn.toggleAttribute('disabled', true);
		return;
	}

	btn.toggleAttribute('disabled', false);
	const { cluster, database } = getConnectionHeaderLabel(connection);
	btn.createSpan({ cls: 'pg-sql-cluster', text: cluster });
	btn.createSpan({ cls: 'pg-sql-sep', text: ' / ' });
	btn.createSpan({ cls: 'pg-sql-database', text: database });
}

export function refreshSqlBlockLabels(plugin: PgPlugin): void {
	const connection = getDefaultConnection(plugin);

	activeDocument.querySelectorAll('.pg-sql-db-btn').forEach((btn) => {
		if (btn.instanceOf(HTMLButtonElement)) {
			updateDbButton(plugin, btn);
		}
	});

	activeDocument
		.querySelectorAll('.pg-sql-refresh-btn')
		.forEach((btn) => {
			btn.toggleAttribute('disabled', !connection);
		});
}
