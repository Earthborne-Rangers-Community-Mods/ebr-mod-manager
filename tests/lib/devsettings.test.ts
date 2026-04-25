// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
	getToken,
	setToken,
	clearToken,
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
