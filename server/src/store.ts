import fs from 'node:fs';
import path from 'node:path';

/** A person in the creatives chat. Identified by name only (no passwords). */
export interface Member {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * - `weekly`: the weekend competition; members submit one photo each.
 * - `monthly`: the end-of-month final between that month's weekly winners.
 * - `tiebreak`: a re-vote between photos that tied in another poll.
 */
export type PollKind = 'weekly' | 'monthly' | 'tiebreak';

/**
 * - `submissions`: weekly only, members are uploading photos.
 * - `voting`: the poll is open.
 * - `tied`: voting ended in a tie; a tie-break poll (`tiebreakId`) decides it.
 * - `closed`: a winner has been decided and results are revealed.
 */
export type PollStatus = 'submissions' | 'voting' | 'tied' | 'closed';

export interface Poll {
  id: string;
  kind: PollKind;
  title: string;
  /** Calendar month the poll belongs to, `YYYY-MM`. */
  month: string;
  /** Weekly only: the date of the weekend, `YYYY-MM-DD`. */
  weekOf?: string;
  status: PollStatus;
  /** Tie-break only: the poll whose tie this one settles. */
  parentId?: string;
  /** Set while `status === 'tied'` (and kept afterwards): the tie-break poll. */
  tiebreakId?: string;
  winnerEntryId?: string;
  createdAt: string;
  closedAt?: string;
}

export interface Entry {
  id: string;
  pollId: string;
  memberId: string;
  /** Stored file name inside the uploads folder. */
  photo: string;
  caption: string;
  /**
   * For monthly and tie-break entries, which are copies: the entry they were
   * copied from (the weekly winner, or the entry in the tied poll).
   */
  fromEntryId?: string;
  createdAt: string;
}

export interface Vote {
  pollId: string;
  voterId: string;
  entryId: string;
  createdAt: string;
}

export interface Db {
  members: Member[];
  polls: Poll[];
  entries: Entry[];
  votes: Vote[];
}

export function emptyDb(): Db {
  return { members: [], polls: [], entries: [], votes: [] };
}

/** Keeps the whole database in memory and writes it to one JSON file. */
export class JsonStore {
  readonly db: Db;

  constructor(private readonly file: string) {
    this.db = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Db) : emptyDb();
  }

  /** Writes to a temp file then renames, so a crash never leaves half a file. */
  save(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2));
    fs.renameSync(tmp, this.file);
  }
}
