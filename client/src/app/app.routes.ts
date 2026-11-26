import type { Routes } from '@angular/router';
import { HomePage } from './pages/home/home';
import { PollPage } from './pages/poll/poll';
import { AdminPage } from './pages/admin/admin';

export const routes: Routes = [
  { path: '', component: HomePage, title: 'Photo Competition' },
  { path: 'poll/:id', component: PollPage, title: 'Photo Competition' },
  { path: 'admin', component: AdminPage, title: 'Admin · Photo Competition' },
  { path: '**', redirectTo: '' },
];
