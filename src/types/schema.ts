export interface SchemaColumn {
	name: string;
	dataType: string;
}

export interface SchemaTable {
	schema: string;
	name: string;
	columns: SchemaColumn[];
}

export interface SchemaCache {
	connectionId: string;
	tables: SchemaTable[];
	fetchedAt: number;
}
