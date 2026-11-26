# SS_PhotoComp

Photo competition app for the creatives chat — npm-workspaces monorepo.

## How the competition works

1. **Every weekend** an admin opens a competition. Each member submits one photo
   (they can replace it until voting opens).
2. The admin **opens voting**. Everyone gets one vote, can't vote for their own
   photo, and can change their vote until it closes. Photos stay anonymous and
   vote counts stay hidden until the poll closes.
3. The admin **closes voting** and the winner is revealed. If the top photos tie,
   a **tie-break re-vote** with only the tied photos opens automatically (and
   repeats if that ties too).
4. At the end of the month the admin starts the **monthly final** between all of
   that calendar month's weekly winners (usually 4, sometimes 5), which runs the
   same way and crowns the Photo of the Month.

Members identify themselves by picking their name (no passwords). Admin tools
are unlocked with a shared passcode.

| Workspace | Stack                   | Dev port |
| --------- | ----------------------- | -------- |
| `server/` | Express 5 + TypeScript  | 3000     |
| `client/` | Angular 22 (standalone) | 4200     |

## Setup

```bash
npm install
```

## Run both (recommended)

```bash
npm run dev
```

Starts the API on http://localhost:3000 and the Angular dev server on
http://localhost:4200. Open **http://localhost:4200**.

Angular 22 needs Node 22.22+, 24.15+ or 26+.

## Configuration

| Env var          | Default       | What it does                                    |
| ---------------- | ------------- | ----------------------------------------------- |
| `ADMIN_PASSCODE` | `admin`       | Passcode for admin tools. Set it before sharing |
| `DATA_DIR`       | `server/data` | Holds `db.json` and the `uploads/` photos       |
| `PORT`           | `3000`        | API port                                        |

All data lives in `DATA_DIR` (git-ignored); back up that folder to keep history.

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

Members send `x-member-id`; admin routes need `x-admin-passcode`.

| Method | Path                         | Who    | What                                       |
| ------ | ---------------------------- | ------ | ------------------------------------------ |
| GET    | `/api/health`                | anyone | `{"status":"ok"}`                          |
| GET    | `/api/members`               | anyone | List names                                 |
| POST   | `/api/members`               | anyone | Add a name `{ name }`                      |
| GET    | `/api/polls`                 | anyone | All polls with winners                     |
| GET    | `/api/polls/:id`             | anyone | Poll with entries (anonymous until closed) |
| POST   | `/api/polls/:id/entries`     | member | Multipart `photo` + `caption`              |
| POST   | `/api/polls/:id/vote`        | member | `{ entryId }`                              |
| POST   | `/api/polls/weekly`          | admin  | `{ weekOf: "YYYY-MM-DD", theme? }`         |
| POST   | `/api/polls/monthly`         | admin  | `{ month: "YYYY-MM" }`                     |
| POST   | `/api/polls/:id/open-voting` | admin  | Close submissions, open voting             |
| POST   | `/api/polls/:id/close`       | admin  | Pick winner, or start a tie-break          |
| DELETE | `/api/entries/:id`           | admin  | Remove a photo during submissions          |

Override the API port with `PORT` (update `client/proxy.conf.json` to match).
