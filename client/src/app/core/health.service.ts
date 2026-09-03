import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

/** Mirrors the `HealthResponse` returned by the Express API. */
export interface HealthResponse {
  status: string;
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  /** The URL is relative, so `ng serve` proxies it to the Express server. */
  getHealth(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>('/api/health');
  }
}
