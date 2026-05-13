import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HasRole } from './has-role';
import { AccountService } from '../../core/services/account-service';

@Component({
  standalone: true,
  template: `<ng-template [appHasRole]="['Admin']"><span>content</span></ng-template>`,
  imports: [HasRole],
})
class TestHost {}

describe('HasRole', () => {
  it('should create an instance', async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
      providers: [
        { provide: AccountService, useValue: { currentUser: () => null } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
