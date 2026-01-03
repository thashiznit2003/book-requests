# Book Requests for Readarr

A lightweight request front-end for two Readarr instances (ebooks + audiobooks). Search once, then send the title to either instance with one click.

## Requirements

- Node.js 18+ for local development
- Docker + Docker Compose for containerized development/production

## Configuration

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

# Optional shared password for API requests
AUTH=
```

Optional frontend auth token for dev:

```
VITE_AUTH=your_shared_password
```

Optional frontend API base override (useful for Docker dev):

```
VITE_API_BASE=http://localhost:3000
```

If `AUTH` is set on the server, supply it as one of:
- `Authorization: Bearer <AUTH>`
- `Authorization: Basic <base64(username:AUTH)>`
- `Authorization: <AUTH>` (raw token)

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

## Portainer-friendly compose

Build the image and use the Portainer compose file:

```
docker build -t book-requests:latest .
docker compose -f docker-compose.portainer.yml up -d
```

## API endpoints

- `GET /api/health` — health check
- `GET /api/search?term=` — search Readarr metadata
- `POST /api/request/ebook` — add to ebooks instance
- `POST /api/request/audiobook` — add to audiobooks instance

## Notes

- Search results are merged from both instances and de-duped before display.
- If a book already exists in an instance, the request button is disabled.
