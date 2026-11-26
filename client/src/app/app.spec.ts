import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { sessionInterceptor } from './core/session';

describe('App', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    // In-memory storage: Node 25+ has its own global localStorage that shadows jsdom's.
    const data = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => data.set(k, v),
        removeItem: (k: string) => data.delete(k),
        clear: () => data.clear(),
      },
    });
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(withInterceptors([sessionInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('asks a first-time visitor to pick their name', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    httpMock.expectOne('/api/members').flush([{ id: 'm1', name: 'Alice' }]);
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.brand')?.textContent).toContain('Creatives Photo Comp');
    expect(el.querySelector('.identity-panel')?.textContent).toContain('Alice');
  });

  it('sends the chosen member id with API calls', async () => {
    localStorage.setItem('photocomp.member', JSON.stringify({ id: 'm1', name: 'Alice' }));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/members');
    expect(req.request.headers.get('x-member-id')).toBe('m1');
    req.flush([{ id: 'm1', name: 'Alice' }]);
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.who')?.textContent).toContain('Alice');
    expect(el.querySelector('.identity-panel')).toBeNull();
  });
});
