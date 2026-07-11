import { Notice } from 'obsidian';
import type PgPlugin from '../main';
import type { SchemaCache } from '../types/schema';
import { fetchSchema } from './schema';
import { getDefaultConnection } from './settings-helpers';

let introspectPromise: Promise<void> | null = null;

export function getActiveSchemaCache(plugin: PgPlugin): SchemaCache | null {
	const connection = getDefaultConnection(plugin);
	if (!connection || !plugin.schemaCache) {
		return null;
	}
	if (plugin.schemaCache.connectionId !== connection.id) {
		return null;
	}
	return plugin.schemaCache;
}

export function clearSchemaCache(plugin: PgPlugin): void {
	plugin.schemaCache = null;
}

export function setSchemaRefreshLoading(loading: boolean): void {
	activeDocument
		.querySelectorAll('.pg-sql-refresh-btn')
		.forEach((btn) => {
			btn.toggleAttribute('disabled', loading);
			btn.classList.toggle('is-loading', loading);
		});
}

export async function refreshSchemaCache(
	plugin: PgPlugin,
	options?: { silent?: boolean },
): Promise<void> {
	const connection = getDefaultConnection(plugin);
	if (!connection) {
		clearSchemaCache(plugin);
		return;
	}

	if (introspectPromise) {
		await introspectPromise;
		return;
	}

	introspectPromise = (async () => {
		clearSchemaCache(plugin);
		setSchemaRefreshLoading(true);

		try {
			const { tables } = await fetchSchema(connection);
			plugin.schemaCache = {
				connectionId: connection.id,
				tables,
				fetchedAt: Date.now(),
			};
			if (!options?.silent) {
				new Notice(
					`Schema loaded: ${tables.length} table${tables.length === 1 ? '' : 's'}.`,
				);
			}
		} catch (error) {
			clearSchemaCache(plugin);
			const message =
				error instanceof Error
					? error.message
					: 'Schema introspection failed.';
			if (!options?.silent) {
				new Notice(message);
			}
			throw error;
		} finally {
			setSchemaRefreshLoading(false);
			introspectPromise = null;
		}
	})();

	await introspectPromise;
}

export async function onDefaultConnectionChanged(
	plugin: PgPlugin,
): Promise<void> {
	clearSchemaCache(plugin);
	const connection = getDefaultConnection(plugin);
	if (!connection) {
		return;
	}
	await refreshSchemaCache(plugin, { silent: true });
}
