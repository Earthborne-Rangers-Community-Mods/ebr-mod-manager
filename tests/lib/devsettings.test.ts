// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isDevPanelOpen, setDevPanelOpen } from '$lib/devsettings.js';

describe('devPanel', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('defaults to closed', () => {
		expect(isDevPanelOpen()).toBe(false);
	});

	it('can be opened', () => {
		setDevPanelOpen(true);
		expect(isDevPanelOpen()).toBe(true);
	});

	it('can be closed', () => {
		setDevPanelOpen(true);
		setDevPanelOpen(false);
		expect(isDevPanelOpen()).toBe(false);
	});

	it('removes the key when closed', () => {
		setDevPanelOpen(true);
		setDevPanelOpen(false);
		expect(localStorage.getItem('ebr_dev_panel')).toBeNull();
	});
});

describe('storage unavailable (SSR / no localStorage)', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('reads fall back to false without throwing', () => {
		vi.stubGlobal('localStorage', undefined);
		expect(isDevPanelOpen()).toBe(false);
	});

	it('writes are a no-op and do not throw', () => {
		vi.stubGlobal('localStorage', undefined);
		expect(() => setDevPanelOpen(true)).not.toThrow();
		expect(() => setDevPanelOpen(false)).not.toThrow();
	});
});
