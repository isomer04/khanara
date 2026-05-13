import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CookOnboarding } from './cook-onboarding';

describe('CookOnboarding', () => {
  let component: CookOnboarding;
  let fixture: ComponentFixture<CookOnboarding>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CookOnboarding],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CookOnboarding);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
