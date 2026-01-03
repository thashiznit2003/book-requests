# Book Requests for Readarr

A lightweight request front-end for two Readarr instances (ebooks + audiobooks). Search once, then send the title to either instance with one click.

## Requirements

- Node.js 18+ for local development
- Docker + Docker Compose for containerized development/production

## Configuration

You can either configure Readarr in the UI (recommended) or via environment variables.

### Option A: Configure in the UI

Start the app, open the UI, and fill in the settings form. The settings are stored in `data/settings.json` and persisted with the Docker volume `settings-data`.

### Option B: Configure via .env

Copy `.env.example` to `.env` and fill in your Readarr settings:

```
READARR_EBOOKS_URL=http://readarr-ebooks:8787
READARR_EBOOKS_APIKEY=your_ebooks_key
READARR_AUDIO_URL=http://readarr-audio:8787
READARR_AUDIO_APIKEY=your_audio_key

EBOOKS_ROOT_FOLDER=/books/ebooks
EBOOKS_QUALITY_PROFILE_ID=1
AUDIO_ROOT_FOLDER=/books/audiobooks
AUDIO_QUALITY_PROFILE_ID=1

# Optional: increase lookup results returned by Readarr
READARR_LOOKUP_LIMIT=20

# Optional shared password for API requests
AUTH=
```

Optional frontend auth token for dev:

```
VITE_AUTH=your_shared_password
```

You can also enter the shared password in the UI (it is stored in browser local storage).

Quality profile IDs are not exposed in the UI; set them in `.env` only if you need to override the defaults.

Optional frontend API base override (useful for Docker dev):

```
VITE_API_BASE=http://localhost:3000
```

If `AUTH` is set on the server, supply it as one of:
- `Authorization: Bearer <AUTH>`
- `Authorization: Basic <base64(username:AUTH)>`
- `Authorization: <AUTH>` (raw token)

Tip: set `AUTH` before exposing the app, since the settings UI includes your API keys.

## Local development

1. Install dependencies:
   ```
   npm install
   ```
2. Start both services with hot reload:
   ```
   npm run dev
   ```
3. Open `http://localhost:5173`.

## Docker development (hot reload)

The override file runs the server and client in two containers with hot reload:

```
docker compose -f docker-compose.yml -f docker-compose.override.yml up
```

If you run `docker compose up` without `-f`, Docker will automatically apply the override file and start the dev stack.

- API: `http://localhost:3000`
- UI: `http://localhost:5173`

## Production (Docker)

```
docker compose -f docker-compose.yml up -d
```

Then visit `http://localhost:3000`.

## Example compose with bind mounts

If you prefer host bind mounts (instead of a named volume), use `docker-compose.example.yml`:

```
docker compose -f docker-compose.example.yml up -d --build
```

## Portainer-friendly compose

Build the image and use the Portainer compose file:

```
docker build -t book-requests:latest .
docker compose -f docker-compose.portainer.yml up -d
```

## API endpoints

- `GET /api/health` — health check
- `GET /api/settings` — get current settings
- `POST /api/settings` — save settings
- `POST /api/settings/test` — test connectivity
- `GET /api/search?term=` — search Readarr metadata
- `POST /api/request/ebook` — add to ebooks instance
- `POST /api/request/audiobook` — add to audiobooks instance

## Notes

- Search results are merged from both instances and de-duped before display.
- If a book already exists and is monitored with a file, the request button is disabled.
- Books that exist but are unmonitored or missing files can be re-requested (the app re-enables those buttons).
