import { ItemView, Notice, WorkspaceLeaf, setIcon } from 'obsidian';
import { VIEW_TYPE_POSTGRES } from '../constants';
import { refreshSqlBlockLabels } from '../editor/sql-block-labels';
import type PgPlugin from '../main';
import {
	ConnectionFormData,
	DEFAULT_CONNECTION_FORM,
	PostgresConnection,
	SSL_MODE_OPTIONS,
} from '../types/connection';
import {
	setDefaultConnection as applyDefaultConnection,
} from '../utils/settings-helpers';
import { onDefaultConnectionChanged } from '../utils/schema-store';
import {
	connectionsAreEqual,
	connectionFromFormData,
	formDataFromConnection,
	getConnectionLabel,
	getConnectionSummary,
	maskPassword,
	parseConnectionUrl,
	testPostgresConnection,
	validateConnectionForm,
} from '../utils/connection';

export class PostgresView extends ItemView {
	plugin: PgPlugin;
	private formFields!: Record<keyof ConnectionFormData, HTMLInputElement | HTMLSelectElement>;
	private urlImportInput!: HTMLTextAreaElement;
	private passwordInput!: HTMLInputElement;
	private connectionsListEl!: HTMLElement;
	private visiblePasswords = new Set<string>();
	private showFormPassword = false;

	constructor(leaf: WorkspaceLeaf, plugin: PgPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_POSTGRES;
	}

	getDisplayText(): string {
		return 'PostgreSQL';
	}

	getIcon(): string {
		return 'postgres';
	}

	async onOpen(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('pg-connections-root');

		const scrollEl = containerEl.createDiv({ cls: 'pg-connections-scroll' });

		const header = scrollEl.createDiv({ cls: 'pg-header' });
		header.createEl('h2', { text: 'PostgreSQL connections' });

		this.renderImportSection(scrollEl);
		this.renderConnectionForm(scrollEl);

		const savedSection = scrollEl.createDiv({ cls: 'pg-saved-section' });
		savedSection.createEl('h3', { text: 'Saved connections' });

		this.connectionsListEl = savedSection.createDiv({
			cls: 'pg-connections-list',
		});

		this.renderConnectionsList();
	}

	async onClose(): Promise<void> {
		this.containerEl.empty();
	}

	private renderImportSection(containerEl: HTMLElement): void {
		const importSection = containerEl.createDiv({ cls: 'pg-import-section' });
		importSection.createEl('label', {
			cls: 'pg-label',
			text: 'Import from URL',
			attr: { for: 'pg-import-url' },
		});
		importSection.createEl('p', {
			cls: 'pg-hint',
			text: 'Paste a postgresql:// URL to fill the form below.',
		});

		this.urlImportInput = importSection.createEl('textarea', {
			cls: 'pg-url-input',
			attr: {
				id: 'pg-import-url',
				placeholder: 'postgresql://user:password@host:5432/database?sslmode=require',
				rows: '2',
				spellcheck: 'false',
			},
		});

		const importBtn = importSection.createEl('button', {
			text: 'Fill from URL',
		});
		importBtn.addEventListener('click', () => this.handleImportUrl());
	}

	private renderConnectionForm(containerEl: HTMLElement): void {
		const formSection = containerEl.createDiv({ cls: 'pg-form-section' });
		formSection.createEl('h3', { text: 'Connection details' });

		this.formFields = {} as Record<
			keyof ConnectionFormData,
			HTMLInputElement | HTMLSelectElement
		>;

		this.addTextField(formSection, 'name', 'Name (optional)', 'text', {
			placeholder: 'Production DB',
		});

		const grid = formSection.createDiv({ cls: 'pg-form-grid' });

		this.addTextField(grid, 'host', 'Host', 'text', {
			placeholder: 'localhost',
			required: true,
		});
		this.addTextField(grid, 'port', 'Port', 'number', {
			placeholder: '5432',
			value: String(DEFAULT_CONNECTION_FORM.port),
			required: true,
		});
		this.addTextField(grid, 'database', 'Database', 'text', {
			placeholder: 'mydb',
			required: true,
		});
		this.addTextField(grid, 'user', 'Username', 'text', {
			placeholder: 'postgres',
			required: true,
		});

		const passwordWrap = grid.createDiv({ cls: 'pg-field pg-field-password' });
		passwordWrap.createEl('label', {
			cls: 'pg-label',
			text: 'Password',
			attr: { for: 'pg-field-password' },
		});
		const passwordRow = passwordWrap.createDiv({ cls: 'pg-password-row' });
		this.passwordInput = passwordRow.createEl('input', {
			cls: 'pg-input',
			attr: {
				id: 'pg-field-password',
				type: 'password',
				placeholder: 'password',
				autocomplete: 'off',
			},
		});
		this.formFields.password = this.passwordInput;

		const eyeBtn = passwordRow.createEl('button', {
			cls: 'pg-eye-btn clickable-icon',
			attr: { 'aria-label': 'Show password', type: 'button' },
		});
		setIcon(eyeBtn, 'eye');
		eyeBtn.addEventListener('click', () => {
			this.showFormPassword = !this.showFormPassword;
			this.passwordInput.type = this.showFormPassword ? 'text' : 'password';
			setIcon(eyeBtn, this.showFormPassword ? 'eye-off' : 'eye');
			eyeBtn.setAttribute(
				'aria-label',
				this.showFormPassword ? 'Hide password' : 'Show password',
			);
		});

		const sslWrap = grid.createDiv({ cls: 'pg-field pg-field-ssl' });
		sslWrap.createEl('label', {
			cls: 'pg-label',
			text: 'SSL mode',
			attr: { for: 'pg-field-sslMode' },
		});
		const sslSelect = sslWrap.createEl('select', {
			cls: 'pg-input',
			attr: { id: 'pg-field-sslMode' },
		});
		for (const option of SSL_MODE_OPTIONS) {
			sslSelect.createEl('option', {
				value: option.value,
				text: `${option.label} — ${option.desc}`,
			});
		}
		sslSelect.value = DEFAULT_CONNECTION_FORM.sslMode;
		this.formFields.sslMode = sslSelect;

		this.addTextField(
			grid,
			'connectionTimeoutMs',
			'Timeout (ms)',
			'number',
			{
				placeholder: '10000',
				value: String(DEFAULT_CONNECTION_FORM.connectionTimeoutMs),
				required: true,
			},
		);

		const buttonRow = formSection.createDiv({ cls: 'pg-button-row' });

		const testBtn = buttonRow.createEl('button', {
			cls: 'mod-cta',
			text: 'Test connection',
		});
		testBtn.addEventListener('click', () => void this.handleTest());

		const saveBtn = buttonRow.createEl('button', {
			text: 'Save',
		});
		saveBtn.addEventListener('click', () => void this.handleSave());
	}

	private addTextField(
		parent: HTMLElement,
		key: keyof ConnectionFormData,
		label: string,
		type: 'text' | 'number',
		options: {
			placeholder?: string;
			value?: string;
			required?: boolean;
		} = {},
	): void {
		const field = parent.createDiv({ cls: 'pg-field' });
		field.createEl('label', {
			cls: 'pg-label',
			text: label,
			attr: { for: `pg-field-${key}` },
		});
		const input = field.createEl('input', {
			cls: 'pg-input',
			attr: {
				id: `pg-field-${key}`,
				type,
				placeholder: options.placeholder ?? '',
				spellcheck: 'false',
				...(options.required ? { required: 'true' } : {}),
			},
		});
		if (options.value !== undefined) {
			input.value = options.value;
		}
		this.formFields[key] = input;
	}

	private getFormData(): ConnectionFormData {
		return {
			name: this.formFields.name.value,
			host: this.formFields.host.value,
			port: Number.parseInt(this.formFields.port.value, 10) || 5432,
			database: this.formFields.database.value,
			user: this.formFields.user.value,
			password: this.formFields.password.value,
			sslMode: this.formFields.sslMode.value as ConnectionFormData['sslMode'],
			connectionTimeoutMs:
				Number.parseInt(this.formFields.connectionTimeoutMs.value, 10) ||
				DEFAULT_CONNECTION_FORM.connectionTimeoutMs,
		};
	}

	private setFormData(data: ConnectionFormData): void {
		this.formFields.name.value = data.name;
		this.formFields.host.value = data.host;
		this.formFields.port.value = String(data.port);
		this.formFields.database.value = data.database;
		this.formFields.user.value = data.user;
		this.formFields.password.value = data.password;
		this.formFields.sslMode.value = data.sslMode;
		this.formFields.connectionTimeoutMs.value = String(
			data.connectionTimeoutMs,
		);
	}

	private handleImportUrl(): void {
		const parsed = parseConnectionUrl(this.urlImportInput.value);
		if (!parsed) {
			new Notice(
				'Could not parse URL. Use postgresql://user:password@host:port/database',
			);
			return;
		}

		this.setFormData(formDataFromConnection(parsed));
		new Notice('Form filled from URL.');
	}

	private async handleTest(): Promise<void> {
		const data = this.getFormData();
		const validationError = validateConnectionForm(data);
		if (validationError) {
			new Notice(validationError);
			return;
		}

		const testBtn = this.containerEl.querySelector<HTMLButtonElement>(
			'.pg-button-row .mod-cta',
		);
		if (testBtn) {
			testBtn.disabled = true;
			testBtn.setText('Testing…');
		}

		try {
			const result = await testPostgresConnection(data);
			new Notice(result.message, result.success ? 3000 : 8000);
		} finally {
			if (testBtn) {
				testBtn.disabled = false;
				testBtn.setText('Test connection');
			}
		}
	}

	private async handleSave(): Promise<void> {
		const data = this.getFormData();
		const validationError = validateConnectionForm(data);
		if (validationError) {
			new Notice(validationError);
			return;
		}

		const isDuplicate = this.plugin.settings.connections.some((c) =>
			connectionsAreEqual(c, data),
		);
		if (isDuplicate) {
			new Notice('A connection with the same host, database, and user already exists.');
			return;
		}

		const connection = connectionFromFormData(data);
		this.plugin.settings.connections.push(connection);

		if (this.plugin.settings.connections.length === 1) {
			this.plugin.settings.defaultConnectionId = connection.id;
		}

		await this.plugin.saveSettings();
		if (this.plugin.settings.defaultConnectionId === connection.id) {
			await onDefaultConnectionChanged(this.plugin);
			refreshSqlBlockLabels(this.plugin);
		}
		this.setFormData({ ...DEFAULT_CONNECTION_FORM });
		this.urlImportInput.value = '';
		this.renderConnectionsList();
		new Notice('Connection saved.');
	}

	private async setDefaultConnection(id: string): Promise<void> {
		await applyDefaultConnection(this.plugin, id);
		this.renderConnectionsList();
		refreshSqlBlockLabels(this.plugin);
		new Notice('Default connection updated.');
	}

	private togglePasswordVisibility(id: string): void {
		if (this.visiblePasswords.has(id)) {
			this.visiblePasswords.delete(id);
		} else {
			this.visiblePasswords.add(id);
		}
		this.renderConnectionsList();
	}

	private renderConnectionsList(): void {
		this.connectionsListEl.empty();

		const connections = this.plugin.settings.connections;
		if (connections.length === 0) {
			this.connectionsListEl.createEl('p', {
				cls: 'pg-empty-state',
				text: 'No saved connections yet.',
			});
			return;
		}

		for (const connection of connections) {
			this.renderConnectionItem(connection);
		}
	}

	private renderConnectionItem(connection: PostgresConnection): void {
		const isDefault =
			this.plugin.settings.defaultConnectionId === connection.id;
		const showPassword = this.visiblePasswords.has(connection.id);
		const sslLabel =
			SSL_MODE_OPTIONS.find((opt) => opt.value === connection.sslMode)
				?.label ?? connection.sslMode;

		const item = this.connectionsListEl.createDiv({
			cls: `pg-connection-item${isDefault ? ' is-default' : ''}`,
		});

		const defaultCol = item.createDiv({ cls: 'pg-connection-default' });
		const radio = defaultCol.createEl('input', {
			type: 'radio',
			attr: {
				name: 'pg-default-connection',
				'aria-label': `Set ${getConnectionLabel(connection)} as default`,
			},
		});
		radio.checked = isDefault;
		radio.addEventListener('change', () => {
			if (radio.checked) {
				void this.setDefaultConnection(connection.id);
			}
		});

		const infoCol = item.createDiv({ cls: 'pg-connection-info' });
		infoCol.createDiv({
			cls: 'pg-connection-label',
			text: getConnectionLabel(connection),
		});

		const metaRow = infoCol.createDiv({ cls: 'pg-connection-meta' });
		metaRow.createSpan({
			cls: 'pg-connection-summary',
			text: getConnectionSummary(connection),
		});
		metaRow.createSpan({
			cls: 'pg-ssl-badge',
			text: `SSL: ${sslLabel}`,
		});

		const passwordRow = infoCol.createDiv({ cls: 'pg-connection-url-row' });
		passwordRow.createEl('code', {
			cls: 'pg-connection-url',
			text: showPassword
				? connection.password || '(no password)'
				: maskPassword(connection.password) || '(no password)',
		});

		const eyeBtn = passwordRow.createEl('button', {
			cls: 'pg-eye-btn clickable-icon',
			attr: {
				'aria-label': showPassword ? 'Hide password' : 'Show password',
				type: 'button',
			},
		});
		setIcon(eyeBtn, showPassword ? 'eye-off' : 'eye');
		eyeBtn.addEventListener('click', () => {
			this.togglePasswordVisibility(connection.id);
		});

		if (isDefault) {
			item.createSpan({
				cls: 'pg-default-badge',
				text: 'Default',
			});
		}
	}
}
