import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage, monthLabel } from '../../core/api';
import type { Poll } from '../../core/api';
import { Session } from '../../core/session';
import { StatusBadge } from '../../shared/status-badge';

const pad = (n: number): string => String(n).padStart(2, '0');
const isoDate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** This weekend's Saturday (or the coming one on a weekday). */
function upcomingSaturday(today = new Date()): string {
  const d = new Date(today);
  const day = d.getDay(); // 0 Sun … 6 Sat
  d.setDate(d.getDate() + (day === 0 ? -1 : 6 - day));
  return isoDate(d);
}

/** Saturdays in `month` (YYYY-MM) from today on: weekends that could still get a competition. */
function saturdaysLeftIn(month: string, today = isoDate(new Date())): string[] {
  const [y, m] = month.split('-').map(Number);
  const out: string[] = [];
  for (let d = new Date(y, m - 1, 1); d.getMonth() === m - 1; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 6 && isoDate(d) >= today) out.push(isoDate(d));
  }
  return out;
}

@Component({
  selector: 'app-admin',
  imports: [DatePipe, RouterLink, StatusBadge],
  templateUrl: './admin.html',
})
export class AdminPage implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly session = inject(Session);

  protected readonly polls = signal<Poll[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly passcode = signal('');
  protected readonly weekOf = signal(upcomingSaturday());
  protected readonly theme = signal('');
  protected readonly month = signal(isoDate(new Date()).slice(0, 7));

  protected readonly active = computed(() =>
    this.polls().filter((p) => p.status !== 'closed' && p.status !== 'tied'),
  );

  /** What the monthly final for the chosen month would contain. */
  protected readonly monthPlan = computed(() => {
    const month = this.month();
    const weeks = this.polls().filter((p) => p.kind === 'weekly' && p.month === month);
    return {
      label: month ? monthLabel(month) : '',
      winners: weeks
        .filter((p) => p.winner)
        .sort((a, b) => (a.weekOf ?? '').localeCompare(b.weekOf ?? '')),
      unfinished: weeks.filter((p) => p.status !== 'closed'),
      existing: this.polls().find((p) => p.kind === 'monthly' && p.month === month),
      // Weekends later this month with no competition yet (e.g. a 5th weekend).
      comingUp: month
        ? saturdaysLeftIn(month).filter((s) => !weeks.some((p) => p.weekOf === s))
        : [],
    };
  });

  async ngOnInit(): Promise<void> {
    if (this.session.isAdmin()) await this.refresh();
  }

  private async refresh(): Promise<void> {
    try {
      this.polls.set(await this.api.polls());
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected async unlock(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.api.checkAdmin(this.passcode());
      this.session.setAdminPasscode(this.passcode());
      this.passcode.set('');
      await this.refresh();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected lock(): void {
    this.session.setAdminPasscode(null);
  }

  private async create(make: () => Promise<Poll>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const poll = await make();
      await this.router.navigate(['/poll', poll.id]);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected createWeekly(): Promise<void> {
    return this.create(() => this.api.createWeekly(this.weekOf(), this.theme()));
  }

  protected createMonthly(): Promise<void> {
    return this.create(() => this.api.createMonthly(this.month()));
  }
}
