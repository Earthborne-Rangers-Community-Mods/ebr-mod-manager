// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getStorageItem, setStorageItem, removeStorageItem } from '$lib/safe-storage.js';

describe('getStorageItem', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('returns null for a missing key', () => {
		expect(getStorageItem('missing')).toBeNull();
	});

	it('returns the stored value', () => {
		localStorage.setItem('k', 'v');
		expect(getStorageItem('k')).toBe('v');
	});

	it('returns null when getItem throws', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
			throw new Error('storage unavailable');
		});
		expect(getStorageItem('k')).toBeNull();
	});
});

describe('setStorageItem', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('writes the value and reports success', () => {
		expect(setStorageItem('k', 'v')).toBe(true);
		expect(localStorage.getItem('k')).toBe('v');
	});

	it('returns false and does not throw when setItem throws', () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
			throw new Error('storage full');
		});
		expect(setStorageItem('k', 'v')).toBe(false);
	});
});

describe('removeStorageItem', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('removes the key', () => {
		localStorage.setItem('k', 'v');
		removeStorageItem('k');
		expect(localStorage.getItem('k')).toBeNull();
	});

	it('does not throw when removeItem throws', () => {
		vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
			throw new Error('storage unavailable');
		});
		expect(() => removeStorageItem('k')).not.toThrow();
	});
});

describe('storage unavailable (SSR / no localStorage)', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('getStorageItem returns null', () => {
		vi.stubGlobal('localStorage', undefined);
		expect(getStorageItem('k')).toBeNull();
	});

	it('setStorageItem returns false', () => {
		vi.stubGlobal('localStorage', undefined);
		expect(setStorageItem('k', 'v')).toBe(false);
	});

	it('removeStorageItem is a no-op', () => {
		vi.stubGlobal('localStorage', undefined);
		expect(() => removeStorageItem('k')).not.toThrow();
	});
});
