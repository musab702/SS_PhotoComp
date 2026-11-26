import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Api, errorMessage } from '../core/api';
import type { Member } from '../core/api';
import { Session } from '../core/session';

/** "Who are you?" picker in the header. Names only — no passwords. */
@Component({
  selector: 'app-identity',
  template: `
    @if (session.member(); as me) {
      <span class="who">
        Voting as <strong>{{ me.name }}</strong>
        <button type="button" class="link" (click)="open.set(!open())">Not you?</button>
      </span>
    } @else {
      <button type="button" class="btn btn--primary btn--sm" (click)="open.set(!open())">
        Pick your name
      </button>
    }

    @if (open() || needsName()) {
      <div class="identity-panel" role="dialog" aria-label="Pick your name">
        <p class="identity-panel__title">Who are you?</p>
        @if (members().length) {
          <div class="identity-panel__names">
            @for (m of members(); track m.id) {
              <button
                type="button"
                class="chip"
                [class.chip--on]="m.id === session.member()?.id"
                (click)="choose(m)"
              >
                {{ m.name }}
              </button>
            }
          </div>
          <p class="muted small">Not listed? Add your name:</p>
        }
        <form class="row" (submit)="$event.preventDefault(); add()">
          <input
            #nameInput
            [value]="newName()"
            (input)="newName.set(nameInput.value)"
            placeholder="Your name as it appears in the chat"
            maxlength="40"
            aria-label="Your name"
          />
          <button class="btn btn--primary" [disabled]="!newName().trim() || busy()">Add</button>
        </form>
        @if (error()) {
          <p class="error small">{{ error() }}</p>
        }
        @if (session.member()) {
          <button type="button" class="link small" (click)="open.set(false)">Cancel</button>
        }
      </div>
    }
  `,
})
export class Identity implements OnInit {
  protected readonly session = inject(Session);
  private readonly api = inject(Api);

  protected readonly members = signal<Member[]>([]);
  protected readonly open = signal(false);
  protected readonly newName = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly loaded = signal(false);
  /** First visit: open the picker straight away. */
  protected readonly needsName = computed(() => this.loaded() && !this.session.member());

  async ngOnInit(): Promise<void> {
    try {
      const members = await this.api.members();
      this.members.set(members);
      // The saved name no longer exists on the server (e.g. data was reset).
      const me = this.session.member();
      if (me && !members.some((m) => m.id === me.id)) this.session.setMember(null);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
    this.loaded.set(true);
  }

  protected choose(member: Member): void {
    this.session.setMember(member);
    this.open.set(false);
  }

  protected async add(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      const member = await this.api.addMember(this.newName());
      if (!this.members().some((m) => m.id === member.id)) {
        this.members.update((list) =>
          [...list, member].sort((a, b) => a.name.localeCompare(b.name)),
        );
      }
      this.newName.set('');
      this.choose(member);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
