import { Notice } from 'obsidian';
import { buildQueryResultCsv } from './csv-export';
import type { QueryResult } from './query';

declare const require: (module: string) => unknown;

function formatTimestamp(date: Date): string {
	const pad = (value: number): string => String(value).padStart(2, '0');
	return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function getDownloadsPath(): string {
	try {
		const electron = require('electron') as {
			app?: { getPath: (name: string) => string };
		};
		if (electron.app) {
			return electron.app.getPath('downloads');
		}
	} catch {
		// Fall back to a home-directory Downloads folder.
	}

	const os = require('os') as typeof import('os');
	const path = require('path') as typeof import('path');
	return path.join(os.homedir(), 'Downloads');
}

async function resolveAvailableCsvPath(
	directory: string,
	baseName: string,
): Promise<string> {
	const fs = require('fs') as typeof import('fs');
	const path = require('path') as typeof import('path');
	const timestamp = formatTimestamp(new Date());
	let candidate = path.join(directory, `${baseName}-result-${timestamp}.csv`);

	if (!fs.existsSync(candidate)) {
		return candidate;
	}

	for (let index = 2; index < 100; index++) {
		candidate = path.join(
			directory,
			`${baseName}-result-${timestamp}-${index}.csv`,
		);
		if (!fs.existsSync(candidate)) {
			return candidate;
		}
	}

	throw new Error('Could not find an available file name for the CSV export.');
}

export async function saveQueryResultCsv(
	result: QueryResult,
	baseName = 'query-result',
): Promise<string> {
	if (!result.success || result.rows.length === 0) {
		throw new Error('There are no rows to save.');
	}

	const downloadsDir = getDownloadsPath();
	const fs = require('fs') as typeof import('fs');
	const filePath = await resolveAvailableCsvPath(downloadsDir, baseName);
	const csv = buildQueryResultCsv(result);

	await fs.promises.writeFile(filePath, csv, 'utf8');
	new Notice(`Results saved to Downloads/${filePath.split(/[/\\]/).pop()}.`);
	return filePath;
}
