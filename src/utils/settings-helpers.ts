import type PgPlugin from '../main';
import { PostgresConnection } from '../types/connection';
import { onDefaultConnectionChanged } from './schema-store';

export function getDefaultConnection(
	plugin: PgPlugin,
): PostgresConnection | null {
	const { connections, defaultConnectionId } = plugin.settings;
	if (connections.length === 0) {
		return null;
	}
	if (defaultConnectionId) {
		const match = connections.find((c) => c.id === defaultConnectionId);
		if (match) {
			return match;
		}
	}
	return connections[0] ?? null;
}

export async function setDefaultConnection(
	plugin: PgPlugin,
	connectionId: string,
): Promise<void> {
	const exists = plugin.settings.connections.some(
		(c) => c.id === connectionId,
	);
	if (!exists) {
		return;
	}
	plugin.settings.defaultConnectionId = connectionId;
	await plugin.saveSettings();
	await onDefaultConnectionChanged(plugin);
}
