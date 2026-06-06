# telegram-uploader

Cloudflare Pages project with Functions runtime + D1 SQLite database.

## Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | `wrangler pages dev public` — local dev server with D1 + secrets |
| `npm run deploy` | `wrangler pages deploy public` — deploy to Cloudflare |
| `npm run migrate` | `wrangler d1 migrations apply telegram-uploader-db --remote` |

No test, lint, or typecheck infrastructure exists.

## Key architecture

- **Pages Functions** (ES modules, `export async function onRequest(context)`) — routes map to file paths under `functions/`
- **D1 database** bound as `env.DB` in `wrangler.toml`
- **Secrets**: `BOT_TOKEN` (Telegram bot) — set via `.dev.vars` file locally (copy from `.dev.vars.example`), or via `wrangler secret put` for production
- **Auth**: Bearer token with `tk_` prefix, validated in `functions/api/_middleware.js`; first user auto-grants admin
- **Admin middleware** at `functions/api/admin/_middleware.js` checks `data.user.is_admin`
- **`.cas` file uploads**: base64-encoded JSON envelope with a `size` field; decoded and forwarded to Telegram via `sendDocument`

## Database

- D1 DB name: `telegram-uploader-db` (remote only bindings in dev)
- Migrations in `migrations/` — run `npm run migrate` to apply to remote; local dev applies them automatically via `wrangler pages dev`
- Tables: `users` (api_key, upload_count, total_size, is_admin), `uploads` (file_name, file_size, caption, file_path, status), `reg_codes` (code, used_by, created_by)

## Static files

Served from `public/` directory. Cache headers set in `public/_headers` (all no-cache).

## 语言规范
- 所有对话和文档都使用中文
- 文档使用 markdown 格式