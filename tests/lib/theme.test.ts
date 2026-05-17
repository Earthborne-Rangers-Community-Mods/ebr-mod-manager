// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock matchMedia (jsdom does not implement it).
function mockMatchMedia(prefersDark: boolean) {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: (query: string) => ({
			matches: prefersDark && query === '(prefers-color-scheme: dark)',
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}),
	});
}

// Return a fresh module instance with a clean cache (currentTheme = null).
// vi.resetModules() clears the module registry so the subsequent dynamic
// import re-evaluates the module from scratch.
async function freshModule() {
	vi.resetModules();
	return import('$lib/theme.js');
}

beforeEach(() => {
	localStorage.clear();
	document.documentElement.removeAttribute('data-theme');
	mockMatchMedia(false); // default: system prefers light
});

describe('getTheme', () => {
	it('returns light when localStorage is empty and system prefers light', async () => {
		mockMatchMedia(false);
		const { getTheme } = await freshModule();
		expect(getTheme()).toBe('light');
	});

	it('returns dark when localStorage is empty and system prefers dark', async () => {
		mockMatchMedia(true);
		const { getTheme } = await freshModule();
		expect(getTheme()).toBe('dark');
	});

	it('returns stored light value', async () => {
		localStorage.setItem('ebr-theme', 'light');
		const { getTheme } = await freshModule();
		expect(getTheme()).toBe('light');
	});

	it('returns stored dark value', async () => {
		localStorage.setItem('ebr-theme', 'dark');
		const { getTheme } = await freshModule();
		expect(getTheme()).toBe('dark');
	});

	it('ignores invalid localStorage value and falls back to system preference', async () => {
		localStorage.setItem('ebr-theme', 'invalid');
		mockMatchMedia(true);
		const { getTheme } = await freshModule();
		expect(getTheme()).toBe('dark');
	});

	it('ignores case-variant value (Dark) and falls back to system preference', async () => {
		localStorage.setItem('ebr-theme', 'Dark');
		mockMatchMedia(false);
		const { getTheme } = await freshModule();
		expect(getTheme()).toBe('light');
	});

	it('ignores numeric value and falls back to system preference', async () => {
		localStorage.setItem('ebr-theme', '1');
		mockMatchMedia(true);
		const { getTheme } = await freshModule();
		expect(getTheme()).toBe('dark');
	});

	it('caches the result: subsequent calls ignore localStorage changes', async () => {
		localStorage.setItem('ebr-theme', 'dark');
		const { getTheme } = await freshModule();
		getTheme(); // prime the cache
		localStorage.setItem('ebr-theme', 'light');
		expect(getTheme()).toBe('dark');
	});
});

describe('setTheme', () => {
	it('writes the theme to localStorage', async () => {
		const { setTheme } = await freshModule();
		setTheme('dark');
		expect(localStorage.getItem('ebr-theme')).toBe('dark');
	});

	it('applies the theme to document.documentElement via data-theme', async () => {
		const { setTheme } = await freshModule();
		setTheme('dark');
		expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
	});

	it('overwrites a previous localStorage value', async () => {
		const { setTheme } = await freshModule();
		setTheme('dark');
		setTheme('light');
		expect(localStorage.getItem('ebr-theme')).toBe('light');
	});

	it('overwrites a previous data-theme attribute', async () => {
		const { setTheme } = await freshModule();
		setTheme('dark');
		setTheme('light');
		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
	});

	it('sets data-theme="light"', async () => {
		const { setTheme } = await freshModule();
		setTheme('light');
		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
	});
});

describe('toggleTheme', () => {
	it('flips from light to dark', async () => {
		localStorage.setItem('ebr-theme', 'light');
		const { toggleTheme } = await freshModule();
		toggleTheme();
		expect(localStorage.getItem('ebr-theme')).toBe('dark');
		expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
	});

	it('flips from dark to light', async () => {
		localStorage.setItem('ebr-theme', 'dark');
		const { toggleTheme } = await freshModule();
		toggleTheme();
		expect(localStorage.getItem('ebr-theme')).toBe('light');
		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
	});

	it('toggles twice to return to original', async () => {
		localStorage.setItem('ebr-theme', 'dark');
		const { toggleTheme } = await freshModule();
		toggleTheme();
		toggleTheme();
		expect(localStorage.getItem('ebr-theme')).toBe('dark');
	});

	it('uses system preference as the starting point when no localStorage value', async () => {
		mockMatchMedia(false); // system prefers light
		const { toggleTheme } = await freshModule();
		toggleTheme();
		expect(localStorage.getItem('ebr-theme')).toBe('dark');
	});
});

describe('applyTheme', () => {
	it('sets data-theme="dark" on document.documentElement', async () => {
		const { applyTheme } = await freshModule();
		applyTheme('dark');
		expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
	});

	it('sets data-theme="light" on document.documentElement', async () => {
		const { applyTheme } = await freshModule();
		applyTheme('light');
		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
	});

	it('overwrites a previous data-theme value', async () => {
		const { applyTheme } = await freshModule();
		applyTheme('dark');
		applyTheme('light');
		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
	});
});

describe('initTheme', () => {
	it('applies the stored theme to document.documentElement', async () => {
		localStorage.setItem('ebr-theme', 'dark');
		const { initTheme } = await freshModule();
		initTheme();
		expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
	});

	it('falls back to system preference (dark) when nothing is stored', async () => {
		mockMatchMedia(true);
		const { initTheme } = await freshModule();
		initTheme();
		expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
	});

	it('falls back to system preference (light) when nothing is stored', async () => {
		mockMatchMedia(false);
		const { initTheme } = await freshModule();
		initTheme();
		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
	});

	it('prefers localStorage over system preference', async () => {
		localStorage.setItem('ebr-theme', 'light');
		mockMatchMedia(true); // system would say dark
		const { initTheme } = await freshModule();
		initTheme();
		expect(document.documentElement.getAttribute('data-theme')).toBe('light');
	});
});
