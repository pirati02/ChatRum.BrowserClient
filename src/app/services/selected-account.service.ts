import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

const STORAGE_KEY = 'chatrum-selected-account-id';

@Injectable({
  providedIn: 'root',
})
export class SelectedAccountService {
  private readonly selectedAccountId$ = new BehaviorSubject<string | null>(
    this.readFromStorage(),
  );

  selectedAccountId(): Observable<string | null> {
    return this.selectedAccountId$.asObservable();
  }

  getSelectedAccountId(): string | null {
    return this.selectedAccountId$.value;
  }

  setSelectedAccountId(id: string | null): void {
    this.selectedAccountId$.next(id);
    if (id) {
      sessionStorage.setItem(STORAGE_KEY, id);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }

  private readFromStorage(): string | null {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
