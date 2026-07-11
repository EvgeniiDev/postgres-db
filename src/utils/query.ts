import { Client } from 'pg';
import {
	CONNECT_RETRY_DELAY_MS,
	MAX_CONNECT_ATTEMPTS,
	MAX_QUERY_ROWS,
} from '../constants';
import { PostgresConnection } from '../types/connection';
import { buildClientConfig } from './connection';

export interface QueryResult {
	success: boolean;
	columns: string[];
	rows: Record<string, unknown>[];
	rowCount: number;
	truncated: boolean;
	error?: string;
	durationMs: number;
	command?: string;
	connectionAttempts?: number;
}

export type QueryProgressCallback = (
	attempt: number,
	maxAttempts: number,
) => void;

const CONNECTION_ERROR_CODES = new Set([
	'ECONNRESET',
	'ECONNREFUSED',
	'ETIMEDOUT',
	'ENOTFOUND',
	'EPIPE',
	'EHOSTUNREACH',
	'ECONNABORTED',
]);

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, ms);
	});
}

export function formatFullError(error: unknown): string {
	if (!(error instanceof Error)) {
		return String(error);
	}

	const err = error as Error & {
		code?: string;
		errno?: number;
		syscall?: string;
		address?: string;
		port?: number;
	};

	const lines: string[] = [];

	if (err.code) {
		lines.push(`Code: ${err.code}`);
	}
	lines.push(err.message);

	if (err.syscall) {
		lines.push(`Syscall: ${err.syscall}`);
	}
	if (err.errno !== undefined) {
		lines.push(`Errno: ${err.errno}`);
	}
	if (err.address) {
		lines.push(`Address: ${err.address}`);
	}
	if (err.port !== undefined) {
		lines.push(`Port: ${err.port}`);
	}
	if (error.stack) {
		lines.push('', error.stack);
	}

	return lines.join('\n');
}

function isConnectionError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	const err = error as Error & { code?: string };
	if (err.code && CONNECTION_ERROR_CODES.has(err.code)) {
		return true;
	}

	const message = error.message.toLowerCase();
	return (
		message.includes('connect') ||
		message.includes('connection') ||
		message.includes('timeout') ||
		message.includes('econnreset')
	);
}

export async function executeQuery(
	connection: PostgresConnection,
	sql: string,
	onProgress?: QueryProgressCallback,
): Promise<QueryResult> {
	const trimmed = sql.trim();
	if (!trimmed) {
		return {
			success: false,
			columns: [],
			rows: [],
			rowCount: 0,
			truncated: false,
			error: 'Query is empty.',
			durationMs: 0,
		};
	}

	const start = Date.now();
	let lastError: unknown;
	let attemptsUsed = 0;

	for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
		attemptsUsed = attempt;
		onProgress?.(attempt, MAX_CONNECT_ATTEMPTS);

		const client = new Client(buildClientConfig(connection));

		try {
			await client.connect();
			const result = await client.query(trimmed);
			const durationMs = Date.now() - start;

			if (!Array.isArray(result.rows)) {
				return {
					success: true,
					columns: [],
					rows: [],
					rowCount: result.rowCount ?? 0,
					truncated: false,
					durationMs,
					command: result.command,
					connectionAttempts: attempt,
				};
			}

			const columns =
				result.fields?.map((field) => field.name) ??
				(result.rows[0] ? Object.keys(result.rows[0] as object) : []);

			const truncated = result.rows.length > MAX_QUERY_ROWS;
			const rows = (result.rows as Record<string, unknown>[]).slice(
				0,
				MAX_QUERY_ROWS,
			);

			return {
				success: true,
				columns,
				rows,
				rowCount: result.rowCount ?? rows.length,
				truncated,
				durationMs,
				command: result.command,
				connectionAttempts: attempt,
			};
		} catch (error) {
			lastError = error;
			await client.end().catch(() => undefined);

			const canRetry =
				attempt < MAX_CONNECT_ATTEMPTS && isConnectionError(error);
			if (canRetry) {
				await sleep(CONNECT_RETRY_DELAY_MS);
				continue;
			}

			return {
				success: false,
				columns: [],
				rows: [],
				rowCount: 0,
				truncated: false,
				error: formatFullError(error),
				durationMs: Date.now() - start,
				connectionAttempts: attemptsUsed,
			};
		}
	}

	return {
		success: false,
		columns: [],
		rows: [],
		rowCount: 0,
		truncated: false,
		error: formatFullError(lastError),
		durationMs: Date.now() - start,
		connectionAttempts: attemptsUsed,
	};
}
