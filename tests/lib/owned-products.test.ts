// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	getOwnedProducts,
	isProductLibraryConfigured,
	setOwnedProducts,
	ownsAllRequiredProducts,
} from '$lib/owned-products.js';

const OWNED_PRODUCTS_KEY = 'ebr-owned-products';

beforeEach(() => {
	localStorage.clear();
});

describe('getOwnedProducts', () => {
	it('returns null when nothing is stored (not configured)', () => {
		expect(getOwnedProducts()).toBeNull();
	});

	it('returns an empty set when an empty list is stored (configured, owns nothing)', () => {
		localStorage.setItem(OWNED_PRODUCTS_KEY, JSON.stringify([]));
		const owned = getOwnedProducts();
		expect(owned).toBeInstanceOf(Set);
		expect(owned?.size).toBe(0);
	});

	it('parses a stored selection', () => {
		localStorage.setItem(OWNED_PRODUCTS_KEY, JSON.stringify(['core-set', 'spire-in-bloom']));
		const owned = getOwnedProducts();
		expect(owned).toEqual(new Set(['core-set', 'spire-in-bloom']));
	});

	it('returns null on corrupt JSON', () => {
		localStorage.setItem(OWNED_PRODUCTS_KEY, '{not valid json');
		expect(getOwnedProducts()).toBeNull();
	});

	it('returns null when the stored value is not an array', () => {
		localStorage.setItem(OWNED_PRODUCTS_KEY, JSON.stringify({ 'core-set': true }));
		expect(getOwnedProducts()).toBeNull();
	});

	it('drops non-string entries from a stored array', () => {
		localStorage.setItem(OWNED_PRODUCTS_KEY, JSON.stringify(['core-set', 42, null, 'spire-in-bloom']));
		expect(getOwnedProducts()).toEqual(new Set(['core-set', 'spire-in-bloom']));
	});

	it('returns null when localStorage.getItem throws', () => {
		const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
			throw new Error('permission denied');
		});
		expect(getOwnedProducts()).toBeNull();
		spy.mockRestore();
	});
});

describe('isProductLibraryConfigured', () => {
	it('is false before any selection is stored', () => {
		expect(isProductLibraryConfigured()).toBe(false);
	});

	it('is true after a selection is stored, even an empty one', () => {
		setOwnedProducts([]);
		expect(isProductLibraryConfigured()).toBe(true);
	});

	it('returns false when localStorage.getItem throws', () => {
		const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
			throw new Error('permission denied');
		});
		expect(isProductLibraryConfigured()).toBe(false);
		spy.mockRestore();
	});

	it('returns false when the stored value is corrupt JSON (delegates to getOwnedProducts)', () => {
		// Corrupt storage reads as "not configured", not "configured but broken".
		// This is the behavior introduced by the delegation to getOwnedProducts().
		localStorage.setItem(OWNED_PRODUCTS_KEY, '{not valid json');
		expect(isProductLibraryConfigured()).toBe(false);
	});

	it('returns false when the stored value is a non-array (delegates to getOwnedProducts)', () => {
		// A stored object is not a valid product list; same result as absent key.
		localStorage.setItem(OWNED_PRODUCTS_KEY, JSON.stringify({ 'core-set': true }));
		expect(isProductLibraryConfigured()).toBe(false);
	});
});

describe('setOwnedProducts', () => {
	it('persists a selection that getOwnedProducts can read back', () => {
		setOwnedProducts(['core-set', 'incandescent-sky']);
		expect(getOwnedProducts()).toEqual(new Set(['core-set', 'incandescent-sky']));
	});

	it('deduplicates ids before storing', () => {
		setOwnedProducts(['core-set', 'core-set', 'spire-in-bloom']);
		expect(JSON.parse(localStorage.getItem(OWNED_PRODUCTS_KEY) ?? '[]')).toEqual([
			'core-set',
			'spire-in-bloom',
		]);
	});

	it('accepts a Set as input', () => {
		setOwnedProducts(new Set(['core-set']));
		expect(getOwnedProducts()).toEqual(new Set(['core-set']));
	});

	it('marks an empty selection as configured', () => {
		setOwnedProducts([]);
		expect(getOwnedProducts()).toEqual(new Set());
		expect(isProductLibraryConfigured()).toBe(true);
	});

	it('does not throw when localStorage.setItem throws (storage full or unavailable)', () => {
		const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
			throw new DOMException('QuotaExceededError');
		});
		expect(() => setOwnedProducts(['core-set'])).not.toThrow();
		spy.mockRestore();
	});
});

describe('ownsAllRequiredProducts', () => {
	it('treats a null library as owning everything', () => {
		expect(ownsAllRequiredProducts(['core-set', 'spire-in-bloom'], null)).toBe(true);
	});

	it('returns true when every required product is owned', () => {
		const owned = new Set(['core-set', 'spire-in-bloom']);
		expect(ownsAllRequiredProducts(['core-set'], owned)).toBe(true);
		expect(ownsAllRequiredProducts(['core-set', 'spire-in-bloom'], owned)).toBe(true);
	});

	it('returns false when any required product is missing', () => {
		const owned = new Set(['core-set']);
		expect(ownsAllRequiredProducts(['core-set', 'spire-in-bloom'], owned)).toBe(false);
	});

	it('returns true for a mod with no required products even when owning nothing', () => {
		expect(ownsAllRequiredProducts([], new Set())).toBe(true);
	});

	it('returns false for a mod requiring products when the user owns nothing', () => {
		expect(ownsAllRequiredProducts(['core-set'], new Set())).toBe(false);
	});
});
