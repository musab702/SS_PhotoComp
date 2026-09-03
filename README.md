# SS_PhotoComp

Daily photo competition app — npm-workspaces monorepo.

| Workspace | Stack                       | Dev port |
| --------- | --------------------------- | -------- |
| `server/` | Express 5 + TypeScript      | 3000     |
| `client/` | Angular 22 (standalone)     | 4200     |

## Setup

```bash
npm install
```

## Run both (recommended)

```bash
npm run dev
```

Starts the API on http://localhost:3000 and the Angular dev server on
http://localhost:4200. Open **http://localhost:4200** — the home page calls
`/api/health` on load and shows the result.

`ng serve` proxies `/api/*` to the Express server (see `client/proxy.conf.json`),
so the browser only ever talks to port 4200 and there is no CORS setup in dev.

## Run individually

```bash
npm run dev:server   # ts-node-dev, restarts on change
npm run dev:client   # ng serve
```

## Other scripts

```bash
npm run build        # build server (tsc) then client (ng build)
npm run lint         # eslint the server
npm run test         # client unit tests
npm run format       # prettier --write .
```

## API

| Method | Path          | Response          |
| ------ | ------------- | ----------------- |
| GET    | `/api/health` | `{"status":"ok"}` |

Override the API port with `PORT` (update `client/proxy.conf.json` to match).
