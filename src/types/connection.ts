export type SslMode =
	| 'disable'
	| 'allow'
	| 'prefer'
	| 'require'
	| 'verify-ca'
	| 'verify-full';

export const SSL_MODE_OPTIONS: { value: SslMode; label: string; desc: string }[] =
	[
		{
			value: 'disable',
			label: 'Disable',
			desc: 'No SSL (local dev only)',
		},
		{
			value: 'allow',
			label: 'Allow',
			desc: 'Try non-SSL first, then SSL',
		},
		{
			value: 'prefer',
			label: 'Prefer',
			desc: 'Try SSL first, fall back to non-SSL',
		},
		{
			value: 'require',
			label: 'Require',
			desc: 'SSL required, certificate not verified',
		},
		{
			value: 'verify-ca',
			label: 'Verify CA',
			desc: 'SSL required, verify certificate authority',
		},
		{
			value: 'verify-full',
			label: 'Verify full',
			desc: 'SSL required, verify CA and hostname',
		},
	];

export interface PostgresConnection {
	id: string;
	name: string;
	host: string;
	port: number;
	database: string;
	user: string;
	password: string;
	sslMode: SslMode;
	connectionTimeoutMs: number;
	createdAt: number;
}

export interface ConnectionFormData {
	name: string;
	host: string;
	port: number;
	database: string;
	user: string;
	password: string;
	sslMode: SslMode;
	connectionTimeoutMs: number;
}

export const DEFAULT_CONNECTION_FORM: ConnectionFormData = {
	name: '',
	host: '',
	port: 5432,
	database: '',
	user: '',
	password: '',
	sslMode: 'require',
	connectionTimeoutMs: 10000,
};

export function isValidSslMode(value: string | null): value is SslMode {
	return SSL_MODE_OPTIONS.some((opt) => opt.value === value);
}
