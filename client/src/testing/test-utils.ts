import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Type, Provider } from '@angular/core';
import { FormGroup, FormControl, ReactiveFormsModule, ValidatorFn } from '@angular/forms';
import { provideRouter } from '@angular/router';

/**
 * Options for mounting a component in tests
 */
export interface MountOptions {
  /** Additional providers to inject */
  providers?: Provider[];
  /** Additional modules to import */
  imports?: any[];
  /** Component inputs to set */
  inputs?: Record<string, any>;
  /** Whether to trigger change detection after mounting (default: true) */
  detectChanges?: boolean;
}

/**
 * Configuration for mounting a component with a form
 */
export interface FormConfig {
  /** Form controls configuration */
  controls: Record<string, any>;
  /** Form-level validators */
  validators?: ValidatorFn[];
}

/**
 * Query options for element queries
 */
export interface QueryOptions {
  /** Accessible name for the element */
  name?: string;
  /** Whether to include hidden elements */
  hidden?: boolean;
}

/**
 * Options for waitFor utility
 */
export interface WaitOptions {
  /** Maximum time to wait in milliseconds (default: 5000) */
  timeout?: number;
  /** Interval between checks in milliseconds (default: 50) */
  interval?: number;
}

/**
 * Mounts an Angular component for testing with TestBed
 * 
 * @example
 * ```typescript
 * const fixture = await mountComponent(MyComponent, {
 *   providers: [{ provide: MyService, useValue: mockService }],
 *   inputs: { title: 'Test Title' }
 * });
 * ```
 */
export async function mountComponent<T>(
  component: Type<T>,
  options: MountOptions = {}
): Promise<ComponentFixture<T>> {
  const { providers = [], imports = [], inputs = {}, detectChanges = true } = options;

  await TestBed.configureTestingModule({
    imports: [component, ...imports],
    providers: [provideRouter([]), ...providers],
  }).compileComponents();

  const fixture = TestBed.createComponent(component);

  // Set component inputs
  Object.entries(inputs).forEach(([key, value]) => {
    fixture.componentRef.setInput(key, value);
  });

  if (detectChanges) {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  return fixture;
}

/**
 * Mounts an Angular component with a reactive form for testing
 * 
 * @example
 * ```typescript
 * const fixture = await mountComponentWithForm(LoginComponent, {
 *   controls: {
 *     email: ['', Validators.required],
 *     password: ['', Validators.required]
 *   }
 * });
 * ```
 */
export async function mountComponentWithForm<T>(
  component: Type<T>,
  formConfig: FormConfig,
  options: MountOptions = {}
): Promise<ComponentFixture<T>> {
  const { controls, validators = [] } = formConfig;

  // Create form group
  const formGroup = new FormGroup({}, validators);
  Object.entries(controls).forEach(([key, config]) => {
    const [value, ...controlValidators] = Array.isArray(config) ? config : [config];
    formGroup.addControl(key, new FormControl(value, controlValidators));
  });

  // Add ReactiveFormsModule to imports
  const imports = [ReactiveFormsModule, ...(options.imports || [])];

  return mountComponent(component, { ...options, imports });
}

/**
 * Gets an element by its ARIA role
 * Throws an error if the element is not found
 * 
 * @example
 * ```typescript
 * const button = getByRole(fixture.nativeElement, 'button', { name: 'Submit' });
 * ```
 */
export function getByRole(
  container: HTMLElement,
  role: string,
  options: QueryOptions = {}
): HTMLElement {
  const element = queryByRole(container, role, options);
  if (!element) {
    throw new Error(`Unable to find element with role "${role}"${options.name ? ` and name "${options.name}"` : ''}`);
  }
  return element;
}

/**
 * Gets an element by its label text
 * Throws an error if the element is not found
 * 
 * @example
 * ```typescript
 * const input = getByLabelText(fixture.nativeElement, 'Email');
 * ```
 */
export function getByLabelText(container: HTMLElement, text: string): HTMLElement {
  const element = queryByLabelText(container, text);
  if (!element) {
    throw new Error(`Unable to find element with label text "${text}"`);
  }
  return element;
}

/**
 * Gets an element by its text content
 * Throws an error if the element is not found
 * 
 * @example
 * ```typescript
 * const heading = getByText(fixture.nativeElement, 'Welcome');
 * ```
 */
export function getByText(container: HTMLElement, text: string): HTMLElement {
  const element = queryByText(container, text);
  if (!element) {
    throw new Error(`Unable to find element with text "${text}"`);
  }
  return element;
}

/**
 * Queries for an element by its ARIA role
 * Returns null if the element is not found
 * 
 * @example
 * ```typescript
 * const button = queryByRole(fixture.nativeElement, 'button', { name: 'Submit' });
 * ```
 */
export function queryByRole(
  container: HTMLElement,
  role: string,
  options: QueryOptions = {}
): HTMLElement | null {
  const elements = container.querySelectorAll(`[role="${role}"]`);
  
  if (elements.length === 0) {
    // Try implicit roles
    const implicitRoleMap: Record<string, string> = {
      button: 'button',
      link: 'a',
      textbox: 'input[type="text"], input:not([type]), textarea',
      checkbox: 'input[type="checkbox"]',
      radio: 'input[type="radio"]',
      heading: 'h1, h2, h3, h4, h5, h6',
    };
    
    const selector = implicitRoleMap[role];
    if (selector) {
      const implicitElements = container.querySelectorAll(selector);
      if (implicitElements.length > 0) {
        return filterByAccessibleName(Array.from(implicitElements), options.name);
      }
    }
    return null;
  }

  return filterByAccessibleName(Array.from(elements), options.name);
}

/**
 * Queries for an element by its label text
 * Returns null if the element is not found
 */
export function queryByLabelText(container: HTMLElement, text: string): HTMLElement | null {
  const labels = Array.from(container.querySelectorAll('label'));
  const label = labels.find((l) => l.textContent?.trim() === text);
  
  if (!label) return null;

  // Try to find associated input by 'for' attribute
  const forAttr = label.getAttribute('for');
  if (forAttr) {
    return container.querySelector(`#${forAttr}`);
  }

  // Try to find input inside label
  return label.querySelector('input, textarea, select');
}

/**
 * Queries for an element by its text content
 * Returns null if the element is not found
 */
export function queryByText(container: HTMLElement, text: string): HTMLElement | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.textContent?.trim() === text && node.parentElement) {
      return node.parentElement;
    }
  }
  
  return null;
}

/**
 * Queries for all elements matching a selector
 * 
 * @example
 * ```typescript
 * const buttons = queryAll(fixture.nativeElement, 'button');
 * ```
 */
export function queryAll(container: HTMLElement, selector: string): HTMLElement[] {
  return Array.from(container.querySelectorAll(selector));
}

/**
 * Helper function to filter elements by accessible name
 */
function filterByAccessibleName(
  elements: Element[],
  name?: string
): HTMLElement | null {
  if (!name) {
    return elements[0] as HTMLElement;
  }

  for (const element of elements) {
    const accessibleName = getAccessibleName(element as HTMLElement);
    if (accessibleName === name) {
      return element as HTMLElement;
    }
  }

  return null;
}

/**
 * Gets the accessible name of an element
 */
function getAccessibleName(element: HTMLElement): string {
  // Check aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  // Check aria-labelledby
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelElement = document.getElementById(ariaLabelledBy);
    if (labelElement) return labelElement.textContent?.trim() || '';
  }

  // Check text content for buttons
  if (element.tagName === 'BUTTON') {
    return element.textContent?.trim() || '';
  }

  // Check value for inputs
  if (element.tagName === 'INPUT') {
    return (element as HTMLInputElement).value || '';
  }

  return '';
}

/**
 * Simulates a user click on an element
 * Dispatches a click event and triggers Angular change detection
 * 
 * @example
 * ```typescript
 * const button = getByRole(fixture.nativeElement, 'button');
 * await userClick(button, fixture);
 * ```
 */
export async function userClick(element: HTMLElement, fixture?: ComponentFixture<any>): Promise<void> {
  element.click();
  element.dispatchEvent(new Event('click', { bubbles: true }));
  
  // Trigger Angular change detection
  if (fixture) {
    fixture.detectChanges();
    await fixture.whenStable();
  } else {
    // Fallback to TestBed for backward compatibility
    const activeFixture = (TestBed as any)._activeFixtures?.[0];
    if (activeFixture) {
      activeFixture.detectChanges();
      await activeFixture.whenStable();
    }
  }
}

/**
 * Simulates a user typing into an input element
 * Sets the value and dispatches input events
 * 
 * @example
 * ```typescript
 * const input = getByLabelText(fixture.nativeElement, 'Email');
 * await userType(input as HTMLInputElement, 'test@example.com', fixture);
 * ```
 */
export async function userType(input: HTMLInputElement, text: string, fixture?: ComponentFixture<any>): Promise<void> {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Trigger Angular change detection
  if (fixture) {
    fixture.detectChanges();
    await fixture.whenStable();
  } else {
    // Fallback to TestBed for backward compatibility
    const activeFixture = (TestBed as any)._activeFixtures?.[0];
    if (activeFixture) {
      activeFixture.detectChanges();
      await activeFixture.whenStable();
    }
  }
}

/**
 * Simulates a user selecting an option from a select element
 * Sets the value and dispatches change events
 * 
 * @example
 * ```typescript
 * const select = getByLabelText(fixture.nativeElement, 'Country');
 * await userSelectOption(select as HTMLSelectElement, 'US', fixture);
 * ```
 */
export async function userSelectOption(
  select: HTMLSelectElement,
  value: string,
  fixture?: ComponentFixture<any>
): Promise<void> {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Trigger Angular change detection
  if (fixture) {
    fixture.detectChanges();
    await fixture.whenStable();
  } else {
    // Fallback to TestBed for backward compatibility
    const activeFixture = (TestBed as any)._activeFixtures?.[0];
    if (activeFixture) {
      activeFixture.detectChanges();
      await activeFixture.whenStable();
    }
  }
}

/**
 * Waits for a condition to be true
 * Polls the callback at regular intervals until it succeeds or times out
 * 
 * @example
 * ```typescript
 * await waitFor(() => {
 *   expect(getByText(fixture.nativeElement, 'Success!')).toBeTruthy();
 * }, { fixture });
 * ```
 */
export async function waitFor(
  callback: () => void,
  options: WaitOptions & { fixture?: ComponentFixture<any> } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50, fixture } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      callback();
      
      // Trigger Angular change detection
      if (fixture) {
        fixture.detectChanges();
        await fixture.whenStable();
      } else {
        // Fallback to TestBed for backward compatibility
        const activeFixture = (TestBed as any)._activeFixtures?.[0];
        if (activeFixture) {
          activeFixture.detectChanges();
          await activeFixture.whenStable();
        }
      }
      
      return;
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  // One final attempt
  callback();
}

/**
 * Waits for an element to be removed from the DOM
 * 
 * @example
 * ```typescript
 * const modal = getByRole(fixture.nativeElement, 'dialog');
 * await userClick(closeButton);
 * await waitForElementToBeRemoved(modal);
 * ```
 */
export async function waitForElementToBeRemoved(
  element: HTMLElement,
  options: WaitOptions = {}
): Promise<void> {
  await waitFor(() => {
    if (document.contains(element)) {
      throw new Error('Element is still in the document');
    }
  }, options);
}

/**
 * Asserts that an element has the specified accessible name
 * 
 * @example
 * ```typescript
 * const button = getByRole(fixture.nativeElement, 'button');
 * expectElementToHaveAccessibleName(button, 'Submit Form');
 * ```
 */
export function expectElementToHaveAccessibleName(
  element: HTMLElement,
  name: string
): void {
  const accessibleName = getAccessibleName(element);
  if (accessibleName !== name) {
    throw new Error(
      `Expected element to have accessible name "${name}", but got "${accessibleName}"`
    );
  }
}

/**
 * Asserts that an element is visible in the DOM
 * 
 * @example
 * ```typescript
 * const message = getByText(fixture.nativeElement, 'Success!');
 * expectElementToBeVisible(message);
 * ```
 */
export function expectElementToBeVisible(element: HTMLElement): void {
  const isVisible =
    element.offsetWidth > 0 &&
    element.offsetHeight > 0 &&
    window.getComputedStyle(element).visibility !== 'hidden' &&
    window.getComputedStyle(element).display !== 'none';

  if (!isVisible) {
    throw new Error('Expected element to be visible, but it is not');
  }
}

/**
 * Asserts that a form control has a specific validation error
 * 
 * @example
 * ```typescript
 * const emailControl = component.form.get('email');
 * expectFormControlToHaveError(emailControl, 'required');
 * ```
 */
export function expectFormControlToHaveError(
  control: any,
  errorKey: string
): void {
  if (!control) {
    throw new Error('Form control is null or undefined');
  }

  if (!control.errors || !control.errors[errorKey]) {
    const errors = control.errors ? Object.keys(control.errors).join(', ') : 'none';
    throw new Error(
      `Expected form control to have error "${errorKey}", but it has errors: ${errors}`
    );
  }
}
