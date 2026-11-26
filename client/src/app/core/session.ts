import { Injectable, computed, inject, signal } from '@angular/core';
import type { HttpInterceptorFn } from '@angular/common/http';
import type { Member } from './api';

const MEMBER_KEY = 'photocomp.member';
const ADMIN_KEY = 'photocomp.adminPasscode';

function readMember(): Member | null {
  try {
    return JSON.parse(localStorage.getItem(MEMBER_KEY) ?? 'null') as Member | null;
  } catch {
    return null;
  }
}

/** Who is using the app on this device: their chosen name, and the admin passcode if unlocked. */
@Injectable({ providedIn: 'root' })
export class Session {
  readonly member = signal<Member | null>(readMember());
  readonly adminPasscode = signal<string | null>(localStorage.getItem(ADMIN_KEY));
  readonly isAdmin = computed(() => !!this.adminPasscode());

  setMember(member: Member | null): void {
    this.member.set(member);
    if (member) localStorage.setItem(MEMBER_KEY, JSON.stringify(member));
    else localStorage.removeItem(MEMBER_KEY);
  }

  setAdminPasscode(passcode: string | null): void {
    this.adminPasscode.set(passcode);
    if (passcode) localStorage.setItem(ADMIN_KEY, passcode);
    else localStorage.removeItem(ADMIN_KEY);
  }
}

/** Sends the member id and admin passcode with every API call. */
export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);
  const session = inject(Session);
  const headers: Record<string, string> = {};
  const member = session.member();
  const passcode = session.adminPasscode();
  if (member) headers['x-member-id'] = member.id;
  if (passcode && !req.headers.has('x-admin-passcode')) headers['x-admin-passcode'] = passcode;
  return next(req.clone({ setHeaders: headers }));
};
