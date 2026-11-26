import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, errorMessage, monthLabel } from '../../core/api';
import type { Poll } from '../../core/api';
import { Session } from '../../core/session';
import { StatusBadge } from '../../shared/status-badge';

interface MonthGroup {
  month: string;
  label: string;
  champion?: Poll;
  weeks: Poll[];
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, StatusBadge],
  templateUrl: './home.html',
})
export class HomePage implements OnInit {
  private readonly api = inject(Api);
  protected readonly session = inject(Session);

  protected readonly polls = signal<Poll[] | null>(null);
  protected readonly error = signal<string | null>(null);

  /** Polls people can act on right now: submit, vote, or vote in a tie-break. */
  protected readonly live = computed(() =>
    (this.polls() ?? [])
      .filter((p) => p.status === 'submissions' || p.status === 'voting')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );

  /** Results by month, newest first: the month's champion, then each weekend's winner. */
  protected readonly months = computed<MonthGroup[]>(() => {
    const groups = new Map<string, MonthGroup>();
    for (const p of this.polls() ?? []) {
      if (p.kind === 'tiebreak') continue;
      const g = groups.get(p.month) ?? { month: p.month, label: monthLabel(p.month), weeks: [] };
      if (p.kind === 'monthly') {
        if (p.status === 'closed') g.champion = p;
      } else {
        g.weeks.push(p);
      }
      groups.set(p.month, g);
    }
    for (const g of groups.values())
      g.weeks.sort((a, b) => (a.weekOf ?? '').localeCompare(b.weekOf ?? ''));
    return [...groups.values()].sort((a, b) => b.month.localeCompare(a.month));
  });

  async ngOnInit(): Promise<void> {
    try {
      this.polls.set(await this.api.polls());
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
