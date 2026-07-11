import { Client, type ClientConfig } from 'pg';
import {
	ConnectionFormData,
	DEFAULT_CONNECTION_FORM,
	PostgresConnection,
	SslMode,
	isValidSslMode,
} from '../types/connection';

export interface ConnectionTestResult {
	success: boolean;
	message: string;
}

const CLUSTER_NAME_MAX_LENGTH = 30;

export function getClusterName(connection: PostgresConnection): string {
	return connection.name.trim() || connection.host;
}

export function getTruncatedClusterName(connection: PostgresConnection): string {
	const clusterName = getClusterName(connection);
	if (clusterName.length <= CLUSTER_NAME_MAX_LENGTH) {
		return clusterName;
	}
	return `${clusterName.slice(0, CLUSTER_NAME_MAX_LENGTH)}...`;
}

export function getConnectionLabel(connection: PostgresConnection): string {
	return `${getClusterName(connection)} / ${connection.database}`;
}

export function getConnectionHeaderLabel(connection: PostgresConnection): {
	cluster: string;
	database: string;
} {
	return {
		cluster: getTruncatedClusterName(connection),
		database: connection.database,
	};
}

export function getConnectionSummary(connection: PostgresConnection): string {
	return `${connection.user}@${connection.host}:${connection.port}/${connection.database}`;
}

export function maskPassword(password: string): string {
	return password ? '••••••••' : '';
}

export function connectionsAreEqual(
	a: ConnectionFormData | PostgresConnection,
	b: ConnectionFormData | PostgresConnection,
): boolean {
	return (
		a.host === b.host &&
		a.port === b.port &&
		a.database === b.database &&
		a.user === b.user
	);
}

export function parseConnectionUrl(
	url: string,
	overrides?: Partial<Pick<PostgresConnection, 'id' | 'name' | 'createdAt'>>,
): PostgresConnection | null {
	const trimmed = url.trim();
	if (
		!trimmed.startsWith('postgresql://') &&
		!trimmed.startsWith('postgres://')
	) {
		return null;
	}

	try {
		const parsed = new URL(trimmed);
		const sslParam = parsed.searchParams.get('sslmode');
		const timeoutParam = parsed.searchParams.get('connect_timeout');

		return {
			id: overrides?.id ?? crypto.randomUUID(),
			name: overrides?.name ?? '',
			host: parsed.hostname,
			port: parsed.port ? Number.parseInt(parsed.port, 10) : 5432,
			database: parsed.pathname.replace(/^\//, '') || 'postgres',
			user: decodeURIComponent(parsed.username),
			password: decodeURIComponent(parsed.password),
			sslMode: isValidSslMode(sslParam) ? sslParam : 'require',
			connectionTimeoutMs: timeoutParam
				? Number.parseInt(timeoutParam, 10) * 1000
				: DEFAULT_CONNECTION_FORM.connectionTimeoutMs,
			createdAt: overrides?.createdAt ?? Date.now(),
		};
	} catch {
		return null;
	}
}

export function migrateLegacyConnection(
	raw: Record<string, unknown>,
): PostgresConnection | null {
	if (typeof raw.host === 'string' && typeof raw.database === 'string') {
		return {
			id: typeof raw.id === 'string' ? raw.id : crypto.randomUUID(),
			name:
				typeof raw.name === 'string'
					? raw.name
					: typeof raw.label === 'string'
						? raw.label
						: '',
			host: raw.host,
			port: typeof raw.port === 'number' ? raw.port : 5432,
			database: raw.database,
			user: typeof raw.user === 'string' ? raw.user : '',
			password: typeof raw.password === 'string' ? raw.password : '',
			sslMode: (() => {
				const mode =
					typeof raw.sslMode === 'string' ? raw.sslMode : null;
				return isValidSslMode(mode) ? mode : 'require';
			})(),
			connectionTimeoutMs:
				typeof raw.connectionTimeoutMs === 'number'
					? raw.connectionTimeoutMs
					: DEFAULT_CONNECTION_FORM.connectionTimeoutMs,
			createdAt:
				typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
		};
	}

	if (typeof raw.url === 'string') {
		return parseConnectionUrl(raw.url, {
			id: typeof raw.id === 'string' ? raw.id : undefined,
			name: typeof raw.label === 'string' ? raw.label : undefined,
			createdAt:
				typeof raw.createdAt === 'number' ? raw.createdAt : undefined,
		});
	}

	return null;
}

function getSslConfig(
	sslMode: SslMode,
): boolean | { rejectUnauthorized: boolean } | undefined {
	switch (sslMode) {
		case 'disable':
			return false;
		case 'allow':
			return undefined;
		case 'prefer':
		case 'require':
			return { rejectUnauthorized: false };
		case 'verify-ca':
		case 'verify-full':
			return { rejectUnauthorized: true };
	}
}

export function buildClientConfig(
	connection: ConnectionFormData | PostgresConnection,
): ClientConfig {
	return {
		host: connection.host.trim(),
		port: connection.port,
		database: connection.database.trim(),
		user: connection.user.trim(),
		password: connection.password,
		ssl: getSslConfig(connection.sslMode),
		connectionTimeoutMillis: connection.connectionTimeoutMs,
	};
}

export function validateConnectionForm(
	data: ConnectionFormData,
): string | null {
	if (!data.host.trim()) {
		return 'Host is required.';
	}
	if (!data.database.trim()) {
		return 'Database is required.';
	}
	if (!data.user.trim()) {
		return 'Username is required.';
	}
	if (!Number.isFinite(data.port) || data.port < 1 || data.port > 65535) {
		return 'Port must be between 1 and 65535.';
	}
	if (
		!Number.isFinite(data.connectionTimeoutMs) ||
		data.connectionTimeoutMs < 1000
	) {
		return 'Connection timeout must be at least 1000 ms.';
	}
	return null;
}

export async function testPostgresConnection(
	connection: ConnectionFormData | PostgresConnection,
): Promise<ConnectionTestResult> {
	const validationError = validateConnectionForm(connection);
	if (validationError) {
		return { success: false, message: validationError };
	}

	const client = new Client(buildClientConfig(connection));

	try {
		await client.connect();
		await client.query('SELECT 1');
		return { success: true, message: 'Connection successful.' };
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Connection failed.';
		return { success: false, message };
	} finally {
		await client.end().catch(() => undefined);
	}
}

export function formDataFromConnection(
	connection: PostgresConnection,
): ConnectionFormData {
	return {
		name: connection.name,
		host: connection.host,
		port: connection.port,
		database: connection.database,
		user: connection.user,
		password: connection.password,
		sslMode: connection.sslMode,
		connectionTimeoutMs: connection.connectionTimeoutMs,
	};
}

export function connectionFromFormData(
	data: ConnectionFormData,
	existing?: Pick<PostgresConnection, 'id' | 'createdAt'>,
): PostgresConnection {
	return {
		id: existing?.id ?? crypto.randomUUID(),
		name: data.name.trim(),
		host: data.host.trim(),
		port: data.port,
		database: data.database.trim(),
		user: data.user.trim(),
		password: data.password,
		sslMode: data.sslMode,
		connectionTimeoutMs: data.connectionTimeoutMs,
		createdAt: existing?.createdAt ?? Date.now(),
	};
}
