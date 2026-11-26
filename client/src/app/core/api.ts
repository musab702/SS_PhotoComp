import { HttpClient } from '@angular/common/http';
import type { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

// These mirror the views in server/src/competition.ts.

export interface Member {
  id: string;
  name: string;
}

export type PollKind = 'weekly' | 'monthly' | 'tiebreak';
export type PollStatus = 'submissions' | 'voting' | 'tied' | 'closed';

export interface Poll {
  id: string;
  kind: PollKind;
  title: string;
  month: string;
  weekOf?: string;
  status: PollStatus;
  parentId?: string;
  tiebreakId?: string;
  createdAt: string;
  closedAt?: string;
  entryCount: number;
  voterCount: number;
  winner?: { entryId: string; photoUrl: string; caption: string; member: Member };
}

export interface Entry {
  id: string;
  photoUrl: string;
  caption: string;
  mine: boolean;
  /** Only present once the poll is closed. */
  member?: Member;
  votes?: number;
  isWinner: boolean;
}

export interface PollDetail extends Poll {
  entries: Entry[];
  myVoteEntryId?: string;
  hasSubmitted: boolean;
}

/** Turns an API error into a sentence for the page. */
export function errorMessage(err: unknown): string {
  const e = err as HttpErrorResponse;
  if (e?.status === 0) return 'Could not reach the server.';
  return (e?.error as { error?: string } | null)?.error ?? 'Something went wrong.';
}

/** Thin promise wrapper over the Express API. Headers are added by `sessionInterceptor`. */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  members = () => firstValueFrom(this.http.get<Member[]>('/api/members'));
  addMember = (name: string) => firstValueFrom(this.http.post<Member>('/api/members', { name }));

  polls = () => firstValueFrom(this.http.get<Poll[]>('/api/polls'));
  poll = (id: string) => firstValueFrom(this.http.get<PollDetail>(`/api/polls/${id}`));

  submit(pollId: string, photo: File, caption: string): Promise<PollDetail> {
    const form = new FormData();
    form.append('caption', caption);
    form.append('photo', photo);
    return firstValueFrom(this.http.post<PollDetail>(`/api/polls/${pollId}/entries`, form));
  }

  vote = (pollId: string, entryId: string) =>
    firstValueFrom(this.http.post<PollDetail>(`/api/polls/${pollId}/vote`, { entryId }));

  // ---- admin
  checkAdmin = (passcode: string) =>
    firstValueFrom(
      this.http.post('/api/admin/check', {}, { headers: { 'x-admin-passcode': passcode } }),
    );
  createWeekly = (weekOf: string, theme: string) =>
    firstValueFrom(this.http.post<Poll>('/api/polls/weekly', { weekOf, theme }));
  createMonthly = (month: string) =>
    firstValueFrom(this.http.post<Poll>('/api/polls/monthly', { month }));
  openVoting = (pollId: string) =>
    firstValueFrom(this.http.post<PollDetail>(`/api/polls/${pollId}/open-voting`, {}));
  close = (pollId: string) =>
    firstValueFrom(
      this.http.post<{ poll: PollDetail; tiebreakId?: string }>(`/api/polls/${pollId}/close`, {}),
    );
  removeEntry = (entryId: string) => firstValueFrom(this.http.delete(`/api/entries/${entryId}`));
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
}
