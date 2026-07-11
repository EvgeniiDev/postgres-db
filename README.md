# Postgres DB

Run PostgreSQL queries directly from your Obsidian notes. Connect to one or more databases, write SQL in fenced code blocks, execute queries in place, and browse results in a side panel — all without leaving your vault.

**Postgres DB** is a desktop-only Obsidian community plugin by [Arghyahub](https://github.com/Arghyahub).

## Features

- **Connection management** — Save multiple PostgreSQL connections with host, port, database, credentials, SSL mode, and timeout settings.
- **URL import** — Paste a `postgresql://` connection string to fill the connection form automatically.
- **Connection testing** — Verify credentials before saving.
- **SQL code blocks** — Fenced `sql` blocks get syntax highlighting, a run button, copy button, and a connection picker.
- **Schema-aware autocomplete** — While editing SQL, get suggestions for tables, columns (including `alias.column`), and SQL keywords based on the active database schema.
- **Query execution** — Run queries from any SQL block; results open in a dedicated **SQL results** panel.
- **Result table** — Browse rows in a scrollable table; click a cell to view its full value in a popup.
- **CSV export** — Save query results to your Downloads folder as a timestamped CSV file.
- **Resilient connections** — Automatic retry on transient connection failures (up to 3 attempts).

## Requirements

- Obsidian **1.7.2** or later
- **Desktop only** (Windows, macOS, or Linux) — the plugin uses the Node.js `pg` client and Electron APIs not available on mobile

## Installation

### From Obsidian Community Plugins

1. Open **Settings → Community plugins**.
2. Turn off **Restricted mode** if prompted.
3. Select **Browse**, search for **Pg**, and install it.
4. Enable the plugin.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Arghyahub/obsidian-postgres-plugin/releases).
2. Copy them into your vault:

   ```
   <Vault>/.obsidian/plugins/pg/
   ```

3. Reload Obsidian and enable **Pg** under **Settings → Community plugins**.

## Quick start

### 1. Add a connection

Open the PostgreSQL connections view using either:

- The **PostgreSQL** ribbon icon in the left sidebar, or
- **Command palette → Open PostgreSQL connections**

Fill in your connection details (or paste a `postgresql://` URL and select **Fill from URL**), then select **Test connection** and **Save**.

The first saved connection becomes the default automatically. You can change the default from the saved connections list or from any SQL block's database picker.

### 2. Write and run SQL

Create a fenced SQL code block in any note:

````markdown
```sql
SELECT id, title, created_at
FROM posts
ORDER BY created_at DESC
LIMIT 10;
```
````

In **Reading view** or **Live Preview**, the block shows a toolbar with:

| Control | Action |
| --- | --- |
| Database button | Switch the default connection for this vault session |
| Refresh | Reload table/column schema for autocomplete |
| Copy | Copy the SQL to your clipboard |
| Play | Execute the query |

Results appear in the **SQL results** panel on the right. Use the download icon to export rows as CSV.

### 3. Autocomplete while editing

In **Source mode** or when editing a SQL block in Live Preview, start typing to get suggestions:

- **Tables** — from the cached schema of the default connection
- **Columns** — after a table name or alias (e.g. `users.` or `u.`)
- **SQL keywords** — standard PostgreSQL keywords

Schema is loaded automatically when you set a default connection. Select the refresh icon on a SQL block to reload it after schema changes.

## Connection settings

Each connection supports:

| Field | Description |
| --- | --- |
| Name | Optional display label |
| Host | Server hostname or IP |
| Port | Default `5432` |
| Database | Database name |
| Username / Password | Credentials (stored locally in plugin data) |
| SSL mode | `disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full` |
| Timeout | Connection timeout in milliseconds (default `10000`) |

Connection credentials are saved in Obsidian's plugin data store on your machine. They are not sent anywhere except to the PostgreSQL server you configure.

## Query results

The **SQL results** panel shows:

- The executed SQL
- Execution time, row count, and command type
- A table of up to **1,000 rows** (larger result sets are truncated with a notice)
- Error details with connection attempt info when a query fails

Click any non-null cell to open a popup with the full value. Use the download button to save results as `<note-name>-result-<timestamp>.csv` in your Downloads folder.

## Commands

| Command | Description |
| --- | --- |
| **Open PostgreSQL connections** | Open the connection management view |

## Development

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm

### Setup

```bash
git clone https://github.com/Arghyahub/obsidian-postgres-plugin.git
cd obsidian-postgres-plugin
npm install
```

For local testing, place the project folder inside your vault:

```
<Vault>/.obsidian/plugins/pg/
```

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Build in watch mode (recompiles on save) |
| `npm run build` | Production build (type-check + bundle) |
| `npm run lint` | Run ESLint |

After building, reload Obsidian to pick up changes.

### Project structure

```
src/
  main.ts              # Plugin entry point
  settings.ts          # Settings interface and tab
  views/               # Connection manager and query result panels
  editor/              # SQL code blocks, autocomplete, editor extensions
  ui/                  # Dropdowns and popups
  utils/               # Connection, query, schema, and export helpers
  types/               # TypeScript interfaces
```

## Releasing

1. Update `minAppVersion` in `manifest.json` if needed.
2. Bump the version:

   ```bash
   npm version patch   # or minor / major
   ```

   This updates `manifest.json`, `package.json`, and `versions.json`.

3. Push the tag — the GitHub Action builds `main.js` and creates a draft release with the required assets.

## Privacy and security

- All database communication goes directly from your machine to the PostgreSQL server you configure.
- No telemetry or third-party services are used.
- Credentials are stored locally in Obsidian plugin data.
- Only install this plugin if you trust it with your database credentials and network access.

## License

0-BSD — see [LICENSE](LICENSE).
