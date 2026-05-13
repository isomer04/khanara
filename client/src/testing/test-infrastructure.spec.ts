import { describe, it, expect } from 'vitest';
import { Component, signal } from '@angular/core';
import { mountComponent, getByRole, userClick, buildUser } from './test-utils';
import { createMockAccountService } from './mock-services';
import { buildUser as buildTestUser } from './test-data-builders';

// Simple test component
@Component({
  selector: 'app-test',
  standalone: true,
  template: `
    <div>
      <h1>Test Component</h1>
      <button (click)="handleClick()">Click Me</button>
      <p>{{ message() }}</p>
    </div>
  `,
})
class TestComponent {
  message = signal('Initial message');

  handleClick() {
    this.message.set('Button clicked!');
  }
}

describe('Test Infrastructure', () => {
  it('should mount a component successfully', async () => {
    const fixture = await mountComponent(TestComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should query elements by role', async () => {
    const fixture = await mountComponent(TestComponent);
    const button = getByRole(fixture.nativeElement, 'button');
    expect(button).toBeTruthy();
    expect(button.textContent).toContain('Click Me');
  });

  it('should simulate user interactions', async () => {
    const fixture = await mountComponent(TestComponent);
    const button = getByRole(fixture.nativeElement, 'button');
    
    await userClick(button, fixture);
    
    // Check the rendered DOM instead of internal signal
    const paragraph = fixture.nativeElement.querySelector('p');
    expect(paragraph?.textContent).toBe('Button clicked!');
  });

  it('should create mock services', () => {
    const mockAccountService = createMockAccountService();
    expect(mockAccountService.currentUser).toBeTruthy();
    expect(mockAccountService.login).toBeTruthy();
    expect(mockAccountService.logout).toBeTruthy();
  });

  it('should build test data', () => {
    const user = buildTestUser({ displayName: 'Test User' });
    expect(user.displayName).toBe('Test User');
    expect(user.email).toBe('test@example.com');
    expect(user.roles).toEqual(['Member']);
  });
});
