import { Component, computed, input } from '@angular/core';
import type { Poll } from '../core/api';

/** Small coloured label: what kind of poll this is and what stage it's at. */
@Component({
  selector: 'app-status-badge',
  template: `<span [class]="'badge badge--' + poll().status">{{ label() }}</span>`,
})
export class StatusBadge {
  readonly poll = input.required<Pick<Poll, 'kind' | 'status'>>();

  protected readonly label = computed(() => {
    const { kind, status } = this.poll();
    const what =
      kind === 'monthly' ? 'Monthly final' : kind === 'tiebreak' ? 'Tie-break' : 'Weekend';
    const stage = {
      submissions: 'taking photos',
      voting: 'voting open',
      tied: 'tied — re-vote',
      closed: 'results',
    }[status];
    return `${what} · ${stage}`;
  });
}
