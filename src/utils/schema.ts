import { Client } from 'pg';
import type { PostgresConnection } from '../types/connection';
import type { SchemaColumn, SchemaTable } from '../types/schema';
import { buildClientConfig } from './connection';

interface ColumnRow {
	table_schema: string;
	table_name: string;
	column_name: string;
	data_type: string;
}

const SCHEMA_QUERY = `
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, ordinal_position
`;

export async function fetchSchema(
	connection: PostgresConnection,
): Promise<{ tables: SchemaTable[] }> {
	const client = new Client(buildClientConfig(connection));

	try {
		await client.connect();
		const result = await client.query<ColumnRow>(SCHEMA_QUERY);
		return { tables: buildTablesFromRows(result.rows) };
	} finally {
		await client.end().catch(() => undefined);
	}
}

function buildTablesFromRows(rows: ColumnRow[]): SchemaTable[] {
	const tableMap = new Map<string, SchemaTable>();

	for (const row of rows) {
		const key = `${row.table_schema}.${row.table_name}`;
		let table = tableMap.get(key);
		if (!table) {
			table = {
				schema: row.table_schema,
				name: row.table_name,
				columns: [],
			};
			tableMap.set(key, table);
		}

		table.columns.push({
			name: row.column_name,
			dataType: row.data_type,
		});
	}

	return Array.from(tableMap.values()).sort((a, b) => {
		const schemaCmp = a.schema.localeCompare(b.schema);
		if (schemaCmp !== 0) {
			return schemaCmp;
		}
		return a.name.localeCompare(b.name);
	});
}

export function getTableDisplayName(table: SchemaTable): string {
	return table.schema === 'public'
		? table.name
		: `${table.schema}.${table.name}`;
}

export function findTableByQualifier(
	tables: SchemaTable[],
	qualifier: string,
): SchemaTable | null {
	const lower = qualifier.toLowerCase();

	for (const table of tables) {
		if (table.name.toLowerCase() === lower) {
			return table;
		}
		if (getTableDisplayName(table).toLowerCase() === lower) {
			return table;
		}
		if (`${table.schema}.${table.name}`.toLowerCase() === lower) {
			return table;
		}
	}

	return null;
}

export function getColumnsForQualifier(
	tables: SchemaTable[],
	qualifier: string,
	aliasMap: Map<string, string>,
): SchemaColumn[] {
	const resolved =
		aliasMap.get(qualifier.toLowerCase()) ?? qualifier;
	const table = findTableByQualifier(tables, resolved);
	return table?.columns ?? [];
}
