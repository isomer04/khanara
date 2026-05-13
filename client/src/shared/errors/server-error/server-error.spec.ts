import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ServerError } from './server-error';

describe('ServerError', () => {
  let component: ServerError;
  let fixture: ComponentFixture<ServerError>;

  beforeEach(async () => {
    const mockRouter = {
      getCurrentNavigation: () => ({
        extras: { state: { error: { message: 'Test error', details: 'Stack trace here' } } },
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ServerError],
      providers: [{ provide: Router, useValue: mockRouter }],
    }).compileComponents();

    fixture = TestBed.createComponent(ServerError);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
