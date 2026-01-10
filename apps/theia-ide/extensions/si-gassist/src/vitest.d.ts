/**
 * Type declarations for Vitest testing framework.
 *
 * These declarations prevent TypeScript errors when importing vitest
 * and @testing-library packages in test files.
 */

declare module 'vitest' {
  export interface Mock {
    mockResolvedValue: (value: unknown) => Mock;
    mockRejectedValue: (value: unknown) => Mock;
    mockImplementation: (fn: (...args: unknown[]) => unknown) => Mock;
    mockReturnValue: (value: unknown) => Mock;
    (): unknown;
  }

  export interface Vitest {
    fn: () => Mock;
    clearAllMocks: () => void;
    resetAllMocks: () => void;
    restoreAllMocks: () => void;
  }

  export const vi: Vitest;

  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: () => void | Promise<void>): void;
  export function test(name: string, fn: () => void | Promise<void>): void;

  export interface Matchers {
    toBe(expected: unknown): boolean;
    toEqual(expected: unknown): boolean;
    toHaveLength(length: number): boolean;
    toContain(expected: unknown): boolean;
    toBeTruthy(): boolean;
    toBeFalsy(): boolean;
    toBeNull(): boolean;
    toBeUndefined(): boolean;
    toHaveBeenCalled(): boolean;
    toHaveBeenCalledWith(...args: unknown[]): boolean;
    toHaveBeenCalledTimes(count: number): boolean;
    toThrow(expected?: string | Error): boolean;
    toBeGreaterThan(expected: number): boolean;
    toBeLessThan(expected: number): boolean;
  }

  export function expect(actual: unknown): Matchers;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
}

declare module '@testing-library/react' {
  import { ReactElement } from 'react';

  export interface RenderResult {
    container: HTMLElement;
    unmount: () => void;
    rerender: (component: ReactElement) => void;
  }

  export function render(
    component: ReactElement,
    options?: Record<string, unknown>
  ): RenderResult;

  export interface Screen {
    getByText(text: string | RegExp): HTMLElement;
    getByRole(role: string): HTMLElement;
    getByTestId(testId: string): HTMLElement;
    queryByText(text: string | RegExp): HTMLElement | null;
    queryByRole(role: string): HTMLElement | null;
    queryByTestId(testId: string): HTMLElement | null;
    findAllByText(text: string | RegExp): Promise<HTMLElement[]>;
  }

  export const screen: Screen;

  export interface FireEvent {
    click(element: HTMLElement): void;
    change(element: HTMLElement, value: { value: string }): void;
    input(element: HTMLElement, value: { value: string }): void;
    keyDown(element: HTMLElement, key: string): void;
  }

  export const fireEvent: FireEvent;

  export function waitFor(callback: () => void | Promise<void>): Promise<void>;
  export function cleanup(): void;
}

declare module '@testing-library/jest-dom' {
  // Empty module - matchers are added to jest.Expect globally
}

declare module 'jsdom' {
  export class JSDOM {
    constructor(html: string, options?: Record<string, unknown>);
    readonly window: Window & {
      navigator: Navigator;
      document: Document;
    };
  }
}
