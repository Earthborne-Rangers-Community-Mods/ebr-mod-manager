// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	getToken,
	setToken,
	clearToken,
	getBaseContentToken,
	setBaseContentToken,
	clearBaseContentToken,
	isDevPanelOpen,
	setDevPanelOpen,
} from '$lib/devsettings.js';

describe('token', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('returns null when no token is set', () => {
		expect(getToken()).toBeNull();
	});

	it('stores and retrieves a token', () => {
		setToken('ghp_abc123');
		expect(getToken()).toBe('ghp_abc123');
	});

	it('overwrites a previous token', () => {
		setToken('ghp_old');
		setToken('ghp_new');
		expect(getToken()).toBe('ghp_new');
	});

	it('clears the token', () => {
		setToken('ghp_abc123');
		clearToken();
		expect(getToken()).toBeNull();
	});

	it('clearToken is safe when no token exists', () => {
		clearToken();
		expect(getToken()).toBeNull();
	});
});

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

describe('baseContentToken', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('returns null when no token is set', () => {
		expect(getBaseContentToken()).toBeNull();
	});

	it('stores and retrieves a token', () => {
		setBaseContentToken('ghp_base123');
		expect(getBaseContentToken()).toBe('ghp_base123');
	});

	it('is independent of the per-mod token', () => {
		setToken('ghp_mod');
		setBaseContentToken('ghp_base');
		expect(getToken()).toBe('ghp_mod');
		expect(getBaseContentToken()).toBe('ghp_base');
	});

	it('clears the token', () => {
		setBaseContentToken('ghp_base123');
		clearBaseContentToken();
		expect(getBaseContentToken()).toBeNull();
	});
});

describe('storage unavailable (SSR / no localStorage)', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('reads fall back to null / false without throwing', () => {
		vi.stubGlobal('localStorage', undefined);
		expect(getToken()).toBeNull();
		expect(getBaseContentToken()).toBeNull();
		expect(isDevPanelOpen()).toBe(false);
	});

	it('writes are a no-op and do not throw', () => {
		vi.stubGlobal('localStorage', undefined);
		expect(() => setToken('ghp_x')).not.toThrow();
		expect(() => setBaseContentToken('ghp_y')).not.toThrow();
		expect(() => clearToken()).not.toThrow();
		expect(() => clearBaseContentToken()).not.toThrow();
		expect(() => setDevPanelOpen(true)).not.toThrow();
		expect(() => setDevPanelOpen(false)).not.toThrow();
	});
});
