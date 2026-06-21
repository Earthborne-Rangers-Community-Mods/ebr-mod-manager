import { describe, it, expect } from 'vitest';
import {
	resolveCampaignDisplayName,
	resolveProductDisplayName,
	resolveModTypeName,
	resolveModTypeDescription,
	KNOWN_PRODUCT_IDS,
} from '$lib/catalogs.js';
import { parseRegistry } from '$lib/registry.js';

// --- resolveCampaignDisplayName ---

describe('resolveCampaignDisplayName', () => {
	it('returns an i18n display name for official campaigns', () => {
		const name = resolveCampaignDisplayName('lure-of-the-valley');
		expect(name).toBeTruthy();
		expect(name).not.toBe('lure-of-the-valley');
	});

	it('returns an i18n display name for official one-day missions', () => {
		const name = resolveCampaignDisplayName('animal-rescue');
		expect(name).toBeTruthy();
		expect(name).not.toBe('animal-rescue');
	});

	it('returns the registry-derived name for fan campaigns', () => {
		// Populate the registry campaign map with a fan campaign
		parseRegistry({
			schemaVersion: 1,
			mods: [{
				id: 'fan-campaign-xyz',
				name: 'Fan Campaign XYZ',
				repoUrl: 'https://github.com/fan/ebr-mod-base-content',
				type: 'campaign',
				commitHash: 'abc123',
			}],
		});
		expect(resolveCampaignDisplayName('fan-campaign-xyz')).toBe('Fan Campaign XYZ');
	});

	it('returns the raw slug for unknown campaigns not in i18n or registry', () => {
		// Ensure the registry map is clean
		parseRegistry({ schemaVersion: 1, mods: [] });
		expect(resolveCampaignDisplayName('totally-unknown')).toBe('totally-unknown');
	});

	it('prefers i18n over registry-derived name when both exist', () => {
		// Put an official campaign ID into the registry with a different name
		parseRegistry({
			schemaVersion: 1,
			mods: [{
				id: 'lure-of-the-valley',
				name: 'WRONG NAME',
				repoUrl: 'https://github.com/x/ebr-mod-base-content',
				type: 'campaign',
				commitHash: 'abc123',
			}],
		});
		const name = resolveCampaignDisplayName('lure-of-the-valley');
		expect(name).not.toBe('WRONG NAME');
		expect(name).not.toBe('lure-of-the-valley');
	});
});

// --- resolveProductDisplayName ---

describe('resolveProductDisplayName', () => {
	it('returns an i18n display name for official products', () => {
		const name = resolveProductDisplayName('core-set');
		expect(name).toBeTruthy();
		expect(name).not.toBe('core-set');
	});

	it('returns an i18n display name for expansion products', () => {
		const name = resolveProductDisplayName('stewards-of-the-valley');
		expect(name).toBeTruthy();
		expect(name).not.toBe('stewards-of-the-valley');
	});

	it('returns the raw slug for unknown products', () => {
		expect(resolveProductDisplayName('some-unknown-product')).toBe('some-unknown-product');
	});
});

// --- resolveModTypeDescription ---

describe('resolveModTypeDescription', () => {
	const KNOWN_TYPES = [
		'campaign',
		'enhancement',
		'one-day-mission',
		'expansion',
		'collection',
		'theme',
	];

	it('returns a non-empty i18n description for every known mod type', () => {
		for (const type of KNOWN_TYPES) {
			const desc = resolveModTypeDescription(type);
			expect(desc, type).toBeTruthy();
			expect(desc, type).not.toBe(type);
		}
	});

	it('returns distinct descriptions per type', () => {
		const descriptions = KNOWN_TYPES.map((t) => resolveModTypeDescription(t));
		expect(new Set(descriptions).size).toBe(KNOWN_TYPES.length);
	});

	it('returns an empty string for an unknown type so callers can skip rendering', () => {
		expect(resolveModTypeDescription('not-a-type')).toBe('');
	});
});

// --- resolveModTypeName ---

describe('resolveModTypeName', () => {
	const KNOWN_TYPES = [
		'campaign',
		'enhancement',
		'one-day-mission',
		'expansion',
		'collection',
		'theme',
	];

	it('returns a player-facing label for every known mod type', () => {
		for (const type of KNOWN_TYPES) {
			const name = resolveModTypeName(type);
			expect(name, type).toBeTruthy();
			expect(name, type).not.toBe(type);
		}
	});

	it('gives the hyphenated one-day-mission slug a properly cased label', () => {
		// CSS capitalize would render "One-day-mission"; the i18n label fixes this.
		expect(resolveModTypeName('one-day-mission')).toBe('One-Day Mission');
	});

	it('falls back to the raw slug for an unknown type', () => {
		expect(resolveModTypeName('not-a-type')).toBe('not-a-type');
	});
});

// --- KNOWN_PRODUCT_IDS ---
// This list mirrors OFFICIAL_PRODUCTS in ebr-mod-tools and drives the
// product-ownership checkboxes. This assertion is the sync canary: when a
// product is added to OFFICIAL_PRODUCTS, KNOWN_PRODUCT_IDS and this test
// must change in the same diff.

describe('KNOWN_PRODUCT_IDS', () => {
	it('contains exactly the expected official product ids in catalog order', () => {
		expect([...KNOWN_PRODUCT_IDS]).toEqual([
			'core-set',
			'legacy-of-the-ancestors',
			'spire-in-bloom',
			'shadow-of-the-storm',
			'moments-in-the-valley',
			'stewards-of-the-valley',
			'moments-on-the-path',
			'ranger-card-doubler',
			'incandescent-sky',
		]);
	});
});
