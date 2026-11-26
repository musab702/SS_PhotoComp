import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import type { Entry, PollDetail } from '../../core/api';
import { Session } from '../../core/session';
import { StatusBadge } from '../../shared/status-badge';

@Component({
  selector: 'app-poll',
  imports: [RouterLink, StatusBadge],
  templateUrl: './poll.html',
})
export class PollPage {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly session = inject(Session);

  /** Route param `:id`. */
  readonly id = input.required<string>();

  protected readonly poll = signal<PollDetail | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly viewing = signal<Entry | null>(null);

  // Submission form
  protected readonly file = signal<File | null>(null);
  protected readonly preview = signal<string | null>(null);
  protected readonly caption = signal('');

  protected readonly myEntry = computed(() => this.poll()?.entries.find((e) => e.mine));

  constructor() {
    // Reload when the route changes, and when the person switches name.
    effect(() => {
      const id = this.id();
      this.session.member();
      untracked(() => void this.load(id));
    });
  }

  private async load(id: string): Promise<void> {
    this.error.set(null);
    try {
      this.poll.set(await this.api.poll(id));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  /** Runs an action, showing its error and refreshing the poll afterwards. */
  private async run(action: () => Promise<unknown>, done?: string): Promise<void> {
    this.busy.set(true);
    this.notice.set(null);
    this.error.set(null);
    try {
      await action();
      if (done) this.notice.set(done);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
      await this.load(this.id());
    }
  }

  protected pickFile(input: HTMLInputElement): void {
    const file = input.files?.[0] ?? null;
    const old = this.preview();
    if (old) URL.revokeObjectURL(old);
    this.file.set(file);
    this.preview.set(file ? URL.createObjectURL(file) : null);
  }

  protected submit(): Promise<void> {
    const file = this.file();
    if (!file) return Promise.resolve();
    const replacing = !!this.myEntry();
    return this.run(
      async () => {
        await this.api.submit(this.id(), file, this.caption());
        this.pickFile({ files: null } as HTMLInputElement);
        this.caption.set('');
      },
      replacing ? 'Your photo was replaced.' : 'Your photo is in. Good luck!',
    );
  }

  protected vote(entry: Entry): Promise<void> {
    return this.run(
      () => this.api.vote(this.id(), entry.id),
      'Vote saved. You can change it until voting closes.',
    );
  }

  // ---- admin
  protected openVoting(): Promise<void> {
    if (!confirm('Close submissions and open voting? Nobody will be able to submit after this.')) {
      return Promise.resolve();
    }
    return this.run(() => this.api.openVoting(this.id()), 'Voting is open.');
  }

  protected async close(): Promise<void> {
    if (!confirm('Close voting and reveal the results?')) return;
    this.busy.set(true);
    try {
      const { tiebreakId } = await this.api.close(this.id());
      if (tiebreakId) {
        alert("It's a tie! A tie-break poll with only the tied photos is now open.");
        await this.router.navigate(['/poll', tiebreakId]);
      } else {
        await this.load(this.id());
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected remove(entry: Entry): Promise<void> {
    if (!confirm('Remove this photo from the competition?')) return Promise.resolve();
    return this.run(() => this.api.removeEntry(entry.id), 'Photo removed.');
  }
}
