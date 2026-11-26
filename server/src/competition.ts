import { randomUUID } from 'node:crypto';
import type { Db, Entry, Member, Poll } from './store';

/** An error with an HTTP status, turned into a JSON response by the app. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const now = (): string => new Date().toISOString();

function getPoll(db: Db, pollId: string): Poll {
  const poll = db.polls.find((p) => p.id === pollId);
  if (!poll) throw new HttpError(404, 'Poll not found');
  return poll;
}

function entriesOf(db: Db, pollId: string): Entry[] {
  return db.entries.filter((e) => e.pollId === pollId);
}

// ---------------------------------------------------------------- members

export function addMember(db: Db, rawName: string): Member {
  const name = rawName.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 40) throw new HttpError(400, 'Name must be 1–40 characters');
  const existing = db.members.find((m) => m.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const member: Member = { id: randomUUID(), name, createdAt: now() };
  db.members.push(member);
  return member;
}

export function getMember(db: Db, memberId: string | undefined): Member {
  const member = memberId ? db.members.find((m) => m.id === memberId) : undefined;
  if (!member) throw new HttpError(401, 'Pick your name first');
  return member;
}

// ---------------------------------------------------------------- weekly

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function weekLabel(weekOf: string): string {
  const d = new Date(`${weekOf}T00:00:00Z`);
  return `Weekend of ${d.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}`;
}

export function createWeekly(db: Db, weekOf: string, theme?: string): Poll {
  if (!DATE_RE.test(weekOf) || Number.isNaN(Date.parse(weekOf))) {
    throw new HttpError(400, 'weekOf must be a date (YYYY-MM-DD)');
  }
  if (db.polls.some((p) => p.kind === 'weekly' && p.weekOf === weekOf)) {
    throw new HttpError(409, 'There is already a competition for that weekend');
  }
  if (db.polls.some((p) => p.kind === 'monthly' && p.month === weekOf.slice(0, 7))) {
    throw new HttpError(409, `${monthLabel(weekOf.slice(0, 7))}'s final has already started`);
  }
  const cleanTheme = theme?.trim();
  const poll: Poll = {
    id: randomUUID(),
    kind: 'weekly',
    title: cleanTheme ? `${weekLabel(weekOf)} · ${cleanTheme}` : weekLabel(weekOf),
    month: weekOf.slice(0, 7),
    weekOf,
    status: 'submissions',
    createdAt: now(),
  };
  db.polls.push(poll);
  return poll;
}

/** Adds the member's photo, replacing their earlier one. Returns the replaced photo file, if any. */
export function submitEntry(
  db: Db,
  pollId: string,
  memberId: string,
  photo: string,
  caption: string,
): { entry: Entry; replacedPhoto?: string } {
  const poll = getPoll(db, pollId);
  if (poll.kind !== 'weekly' || poll.status !== 'submissions') {
    throw new HttpError(409, 'Submissions are closed for this poll');
  }
  const old = db.entries.find((e) => e.pollId === pollId && e.memberId === memberId);
  if (old) db.entries.splice(db.entries.indexOf(old), 1);
  const entry: Entry = {
    id: randomUUID(),
    pollId,
    memberId,
    photo,
    caption: caption.trim().slice(0, 200),
    createdAt: now(),
  };
  db.entries.push(entry);
  return { entry, replacedPhoto: old?.photo };
}

/** Admin removal of an entry while submissions are open. Returns the photo file to delete. */
export function removeEntry(db: Db, entryId: string): string {
  const entry = db.entries.find((e) => e.id === entryId);
  if (!entry) throw new HttpError(404, 'Entry not found');
  if (getPoll(db, entry.pollId).status !== 'submissions') {
    throw new HttpError(409, 'Entries can only be removed while submissions are open');
  }
  db.entries.splice(db.entries.indexOf(entry), 1);
  return entry.photo;
}

export function openVoting(db: Db, pollId: string): Poll {
  const poll = getPoll(db, pollId);
  if (poll.status !== 'submissions') throw new HttpError(409, 'Voting is already open or finished');
  if (entriesOf(db, pollId).length < 2)
    throw new HttpError(409, 'Need at least 2 photos to vote on');
  poll.status = 'voting';
  return poll;
}

// ---------------------------------------------------------------- monthly

export function createMonthly(db: Db, month: string): Poll {
  if (!MONTH_RE.test(month)) throw new HttpError(400, 'month must be YYYY-MM');
  if (db.polls.some((p) => p.kind === 'monthly' && p.month === month)) {
    throw new HttpError(409, 'That month already has a final');
  }
  const weeklies = db.polls.filter((p) => p.kind === 'weekly' && p.month === month);
  const unfinished = weeklies.filter((p) => p.status !== 'closed');
  if (unfinished.length) {
    throw new HttpError(409, `Finish these first: ${unfinished.map((p) => p.title).join(', ')}`);
  }
  const winners = weeklies
    .sort((a, b) => (a.weekOf ?? '').localeCompare(b.weekOf ?? ''))
    .map((p) => db.entries.find((e) => e.id === p.winnerEntryId))
    .filter((e): e is Entry => !!e);
  if (winners.length < 2) throw new HttpError(409, 'Need at least 2 weekly winners in that month');

  const poll: Poll = {
    id: randomUUID(),
    kind: 'monthly',
    title: `${monthLabel(month)} · Photo of the Month`,
    month,
    status: 'voting',
    createdAt: now(),
  };
  db.polls.push(poll);
  for (const w of winners) db.entries.push(copyEntry(w, poll.id));
  return poll;
}

function copyEntry(from: Entry, pollId: string): Entry {
  return {
    id: randomUUID(),
    pollId,
    memberId: from.memberId,
    photo: from.photo,
    caption: from.caption,
    fromEntryId: from.id,
    createdAt: now(),
  };
}

// ---------------------------------------------------------------- voting

export function castVote(db: Db, pollId: string, voterId: string, entryId: string): void {
  const poll = getPoll(db, pollId);
  if (poll.status !== 'voting') throw new HttpError(409, 'This poll is not open for voting');
  const entry = db.entries.find((e) => e.id === entryId && e.pollId === pollId);
  if (!entry) throw new HttpError(404, 'Entry not found in this poll');
  if (entry.memberId === voterId) throw new HttpError(403, "You can't vote for your own photo");

  // One vote per person per poll; voting again changes your vote.
  const existing = db.votes.find((v) => v.pollId === pollId && v.voterId === voterId);
  if (existing) {
    existing.entryId = entryId;
    existing.createdAt = now();
  } else {
    db.votes.push({ pollId, voterId, entryId, createdAt: now() });
  }
}

export function tally(db: Db, pollId: string): Map<string, number> {
  const counts = new Map(entriesOf(db, pollId).map((e) => [e.id, 0]));
  for (const v of db.votes) {
    if (v.pollId === pollId) counts.set(v.entryId, (counts.get(v.entryId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Ends voting. A single leader wins; a tie starts a tie-break poll with only
 * the tied photos. Returns the poll, and the tie-break poll if one was made.
 */
export function closePoll(db: Db, pollId: string): { poll: Poll; tiebreak?: Poll } {
  const poll = getPoll(db, pollId);
  if (poll.status !== 'voting') throw new HttpError(409, 'This poll is not open for voting');
  const counts = tally(db, pollId);
  const top = Math.max(...counts.values());
  if (top === 0) throw new HttpError(409, 'Nobody has voted yet');
  const leaders = [...counts].filter(([, n]) => n === top).map(([id]) => id);

  if (leaders.length === 1) {
    decide(db, poll, leaders[0]);
    return { poll };
  }

  const tiebreak: Poll = {
    id: randomUUID(),
    kind: 'tiebreak',
    title: `Tie-break · ${rootPoll(db, poll).title}`,
    month: poll.month,
    status: 'voting',
    parentId: poll.id,
    createdAt: now(),
  };
  db.polls.push(tiebreak);
  for (const id of leaders)
    db.entries.push(
      copyEntry(
        db.entries.find((e) => e.id === id)!,
        tiebreak.id,
      ),
    );
  poll.status = 'tied';
  poll.tiebreakId = tiebreak.id;
  return { poll, tiebreak };
}

/** Closes a poll with a winner, and settles any tied polls this tie-break was for. */
function decide(db: Db, poll: Poll, winnerEntryId: string): void {
  poll.status = 'closed';
  poll.winnerEntryId = winnerEntryId;
  poll.closedAt = now();
  if (poll.kind === 'tiebreak' && poll.parentId) {
    const parent = getPoll(db, poll.parentId);
    const winner = db.entries.find((e) => e.id === winnerEntryId)!;
    decide(db, parent, winner.fromEntryId!);
  }
}

/** Follows tie-break parents up to the weekly or monthly poll. */
export function rootPoll(db: Db, poll: Poll): Poll {
  return poll.parentId ? rootPoll(db, getPoll(db, poll.parentId)) : poll;
}

// ---------------------------------------------------------------- views

export interface EntryView {
  id: string;
  photoUrl: string;
  caption: string;
  mine: boolean;
  /** Only once the poll is closed (anonymous until then). */
  member?: { id: string; name: string };
  votes?: number;
  isWinner: boolean;
}

export interface PollView {
  id: string;
  kind: Poll['kind'];
  title: string;
  month: string;
  weekOf?: string;
  status: Poll['status'];
  parentId?: string;
  tiebreakId?: string;
  createdAt: string;
  closedAt?: string;
  entryCount: number;
  /** Number of people who have voted. Shown during voting; the split is not. */
  voterCount: number;
  winner?: {
    entryId: string;
    photoUrl: string;
    caption: string;
    member: { id: string; name: string };
  };
}

export interface PollDetailView extends PollView {
  entries: EntryView[];
  myVoteEntryId?: string;
  hasSubmitted: boolean;
}

export const photoUrl = (file: string): string => `/api/photos/${file}`;

function memberRef(db: Db, memberId: string): { id: string; name: string } {
  const m = db.members.find((x) => x.id === memberId);
  return { id: memberId, name: m?.name ?? 'Unknown' };
}

export function viewPoll(db: Db, poll: Poll): PollView {
  const winner = poll.winnerEntryId
    ? db.entries.find((e) => e.id === poll.winnerEntryId)
    : undefined;
  return {
    id: poll.id,
    kind: poll.kind,
    title: poll.title,
    month: poll.month,
    weekOf: poll.weekOf,
    status: poll.status,
    parentId: poll.parentId,
    tiebreakId: poll.tiebreakId,
    createdAt: poll.createdAt,
    closedAt: poll.closedAt,
    entryCount: entriesOf(db, poll.id).length,
    voterCount: db.votes.filter((v) => v.pollId === poll.id).length,
    winner: winner && {
      entryId: winner.id,
      photoUrl: photoUrl(winner.photo),
      caption: winner.caption,
      member: memberRef(db, winner.memberId),
    },
  };
}

export function viewPollDetail(db: Db, pollId: string, viewerId?: string): PollDetailView {
  const poll = getPoll(db, pollId);
  const revealed = poll.status === 'closed';
  const counts = revealed ? tally(db, pollId) : undefined;
  const entries = entriesOf(db, pollId).map((e): EntryView => ({
    id: e.id,
    photoUrl: photoUrl(e.photo),
    caption: e.caption,
    mine: e.memberId === viewerId,
    member: revealed ? memberRef(db, e.memberId) : undefined,
    votes: counts?.get(e.id),
    isWinner: e.id === poll.winnerEntryId,
  }));
  if (revealed) {
    // Winner first (it may have won a tie-break), then by votes.
    entries.sort(
      (a, b) => Number(b.isWinner) - Number(a.isWinner) || (b.votes ?? 0) - (a.votes ?? 0),
    );
  } else {
    // Before results, order by random id so the order gives no hint of who posted when.
    entries.sort((a, b) => a.id.localeCompare(b.id));
  }

  return {
    ...viewPoll(db, poll),
    entries,
    myVoteEntryId: viewerId
      ? db.votes.find((v) => v.pollId === pollId && v.voterId === viewerId)?.entryId
      : undefined,
    hasSubmitted: entries.some((e) => e.mine),
  };
}
