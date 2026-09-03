import { Component, OnInit, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import type { HttpErrorResponse } from '@angular/common/http';
import { HealthService } from '../core/health.service';
import type { HealthResponse } from '../core/health.service';

@Component({
  selector: 'app-home',
  imports: [JsonPipe],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  private readonly healthService = inject(HealthService);

  protected readonly health = signal<HealthResponse | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);

  ngOnInit(): void {
    this.checkHealth();
  }

  protected checkHealth(): void {
    this.loading.set(true);
    this.error.set(null);

    this.healthService.getHealth().subscribe({
      next: (response) => {
        this.health.set(response);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.health.set(null);
        this.error.set(
          err.status === 0
            ? 'Could not reach the API. Is the Express server running on port 3000?'
            : `API responded with ${String(err.status)} ${err.statusText}`,
        );
        this.loading.set(false);
      },
    });
  }
}
