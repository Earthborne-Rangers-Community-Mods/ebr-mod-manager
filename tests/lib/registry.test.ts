import { describe, it, expect } from 'vitest';
import {
	parseRegistry,
	parseRepoUrl,
	modFileUrl,
	coverImageUrl,
	rewriteImagePaths,
	getRegistryCampaignName,
} from '$lib/registry.js';
import {
	RegistryParseError,
	InvalidRepoUrlError,
} from '$lib/errors.js';
import type { BrowseMod } from '$lib/registry.js';

// --- Helpers ---

function catchError(fn: () => void): Error {
	try {
		fn();
		throw new Error('Expected function to throw');
	} catch (err) {
		return err as Error;
	}
}

// --- Fixtures ---

function validMod(overrides: Partial<BrowseMod> = {}): BrowseMod {
	return {
		id: 'test-mod',
		name: 'Test Mod',
		author: 'Tester',
		description: 'A test mod.',
		repoUrl: 'https://github.com/tester/ebr-mod-base-content',
		type: 'enhancement',
		tags: ['test'],
		campaigns: ['lure-of-the-valley'],
		requiredProducts: ['core-set'],
		safeToAddMidCampaign: true,
		icon: '🏔️',
		language: 'en',
		latestVersion: '1.0.0',
		updatedAt: '2026-04-24',
		commitHash: 'abc123def456',
		...overrides,
	};
}

function validRegistryData(mods: unknown[] = [validMod()]) {
	return { schemaVersion: 1, mods };
}

// --- parseRegistry ---

describe('parseRegistry', () => {
	it('parses a valid registry with one mod', () => {
		const result = parseRegistry(validRegistryData());
		expect(result.schemaVersion).toBe(1);
		expect(result.mods).toHaveLength(1);
		expect(result.mods[0].id).toBe('test-mod');
	});

	it('parses an empty registry', () => {
		const result = parseRegistry(validRegistryData([]));
		expect(result.schemaVersion).toBe(1);
		expect(result.mods).toHaveLength(0);
	});

	it('parses mods with optional fields missing', () => {
		const mod = validMod();
		delete (mod as Record<string, unknown>).tags;
		delete (mod as Record<string, unknown>).icon;
		delete (mod as Record<string, unknown>).coverImage;
		delete (mod as Record<string, unknown>).author;
		delete (mod as Record<string, unknown>).description;
		delete (mod as Record<string, unknown>).language;
		delete (mod as Record<string, unknown>).latestVersion;
		delete (mod as Record<string, unknown>).updatedAt;
		delete (mod as Record<string, unknown>).campaigns;
		delete (mod as Record<string, unknown>).requiredProducts;
		delete (mod as Record<string, unknown>).safeToAddMidCampaign;
		const result = parseRegistry(validRegistryData([mod]));
		expect(result.mods).toHaveLength(1);
		const parsed = result.mods[0];
		expect(parsed.author).toBe('');
		expect(parsed.description).toBe('');
		expect(parsed.language).toBe('en');
		expect(parsed.latestVersion).toBe('');
		expect(parsed.updatedAt).toBe('');
		expect(parsed.tags).toEqual([]);
		expect(parsed.campaigns).toEqual([]);
		expect(parsed.requiredProducts).toEqual([]);
		expect(parsed.safeToAddMidCampaign).toBe(false);
		expect(parsed.icon).toBeUndefined();
		expect(parsed.coverImage).toBeUndefined();
	});

	it('rejects null', () => {
		expect(() => parseRegistry(null)).toThrow(RegistryParseError);
	});

	it('rejects a non-object', () => {
		expect(() => parseRegistry('string')).toThrow(RegistryParseError);
	});

	it('rejects missing schemaVersion', () => {
		const err = catchError(() => parseRegistry({ mods: [] }));
		expect(err).toBeInstanceOf(RegistryParseError);
		expect((err as RegistryParseError).field).toBe('schemaVersion');
	});

	it('rejects non-numeric schemaVersion', () => {
		const err = catchError(() => parseRegistry({ schemaVersion: '1', mods: [] }));
		expect(err).toBeInstanceOf(RegistryParseError);
		expect((err as RegistryParseError).field).toBe('schemaVersion');
	});

	it('rejects missing mods array', () => {
		const err = catchError(() => parseRegistry({ schemaVersion: 1 }));
		expect(err).toBeInstanceOf(RegistryParseError);
		expect((err as RegistryParseError).field).toBe('mods');
	});

	it('rejects non-array mods', () => {
		const err = catchError(() => parseRegistry({ schemaVersion: 1, mods: 'not-array' }));
		expect(err).toBeInstanceOf(RegistryParseError);
		expect((err as RegistryParseError).field).toBe('mods');
	});

	// -- per-mod validation (malformed mods are skipped, not thrown) --

	it('skips a mod that is not an object', () => {
		const result = parseRegistry(validRegistryData(['not-an-object']));
		expect(result.mods).toHaveLength(0);
	});

	it('skips a malformed mod but keeps valid ones', () => {
		const good = validMod({ id: 'good-mod' });
		const bad = { name: 'Bad Mod' }; // missing required fields
		const result = parseRegistry(validRegistryData([good, bad]));
		expect(result.mods).toHaveLength(1);
		expect(result.mods[0].id).toBe('good-mod');
	});

	// These 5 fields are required - missing any one skips the mod
	const requiredStringFields = [
		'id',
		'name',
		'repoUrl',
		'type',
		'commitHash',
	] as const;

	for (const field of requiredStringFields) {
		it(`skips a mod missing '${field}'`, () => {
			const mod = validMod();
			delete (mod as Record<string, unknown>)[field];
			const result = parseRegistry(validRegistryData([mod]));
			expect(result.mods).toHaveLength(0);
		});

		it(`skips a mod where '${field}' is not a string`, () => {
			const mod = validMod();
			(mod as Record<string, unknown>)[field] = 42;
			const result = parseRegistry(validRegistryData([mod]));
			expect(result.mods).toHaveLength(0);
		});
	}

	// These fields degrade gracefully with defaults
	it('defaults author to empty string when missing', () => {
		const mod = validMod();
		delete (mod as Record<string, unknown>).author;
		const result = parseRegistry(validRegistryData([mod]));
		expect(result.mods[0].author).toBe('');
	});

	it('defaults description to empty string when missing', () => {
		const mod = validMod();
		delete (mod as Record<string, unknown>).description;
		const result = parseRegistry(validRegistryData([mod]));
		expect(result.mods[0].description).toBe('');
	});

	it('defaults language to "en" when missing', () => {
		const mod = validMod();
		delete (mod as Record<string, unknown>).language;
		const result = parseRegistry(validRegistryData([mod]));
		expect(result.mods[0].language).toBe('en');
	});

	it('defaults campaigns to empty array when missing', () => {
		const mod = validMod();
		delete (mod as Record<string, unknown>).campaigns;
		const result = parseRegistry(validRegistryData([mod]));
		expect(result.mods[0].campaigns).toEqual([]);
	});

	it('defaults campaigns to empty array when not an array', () => {
		const mod = validMod();
		(mod as Record<string, unknown>).campaigns = 'not-array';
		const result = parseRegistry(validRegistryData([mod]));
		expect(result.mods[0].campaigns).toEqual([]);
	});

	it('defaults requiredProducts to empty array when missing', () => {
		const mod = validMod();
		delete (mod as Record<string, unknown>).requiredProducts;
		const result = parseRegistry(validRegistryData([mod]));
		expect(result.mods[0].requiredProducts).toEqual([]);
	});

	it('defaults safeToAddMidCampaign to false when missing', () => {
		const mod = validMod();
		delete (mod as Record<string, unknown>).safeToAddMidCampaign;
		const result = parseRegistry(validRegistryData([mod]));
		expect(result.mods[0].safeToAddMidCampaign).toBe(false);
	});

	it('defaults safeToAddMidCampaign to false when not boolean', () => {
		const mod = validMod();
		(mod as Record<string, unknown>).safeToAddMidCampaign = 'true';
		const result = parseRegistry(validRegistryData([mod]));
		expect(result.mods[0].safeToAddMidCampaign).toBe(false);
	});
});

// --- parseRepoUrl ---

describe('parseRepoUrl', () => {
	it('parses a standard GitHub URL', () => {
		expect(parseRepoUrl('https://github.com/creator/ebr-mod-base-content')).toEqual({
			owner: 'creator',
			repo: 'ebr-mod-base-content',
		});
	});

	it('strips .git suffix', () => {
		expect(parseRepoUrl('https://github.com/creator/repo.git')).toEqual({
			owner: 'creator',
			repo: 'repo',
		});
	});

	it('works with org-owned repos', () => {
		expect(parseRepoUrl('https://github.com/My-Org/some-repo')).toEqual({
			owner: 'My-Org',
			repo: 'some-repo',
		});
	});

	it('throws on non-GitHub URLs', () => {
		expect(() => parseRepoUrl('https://gitlab.com/user/repo')).toThrow(InvalidRepoUrlError);
	});

	it('throws on empty string', () => {
		expect(() => parseRepoUrl('')).toThrow(InvalidRepoUrlError);
	});

	it('throws on malformed URL', () => {
		expect(() => parseRepoUrl('not-a-url')).toThrow(InvalidRepoUrlError);
	});

	it('includes the bad URL on the error', () => {
		const err = catchError(() => parseRepoUrl('https://gitlab.com/user/repo'));
		expect(err).toBeInstanceOf(InvalidRepoUrlError);
		expect((err as InvalidRepoUrlError).repoUrl).toBe('https://gitlab.com/user/repo');
	});
});

// --- modFileUrl ---

describe('modFileUrl', () => {
	const mod = {
		repoUrl: 'https://github.com/creator/ebr-mod-base-content',
		commitHash: 'abc123',
	};

	it('builds a raw GitHub URL for a file', () => {
		expect(modFileUrl(mod, 'cover.png')).toBe(
			'https://raw.githubusercontent.com/creator/ebr-mod-base-content/abc123/cover.png',
		);
	});

	it('handles nested paths', () => {
		expect(modFileUrl(mod, 'images/screenshots/demo.png')).toBe(
			'https://raw.githubusercontent.com/creator/ebr-mod-base-content/abc123/images/screenshots/demo.png',
		);
	});
});

// --- coverImageUrl ---

describe('coverImageUrl', () => {
	it('returns the cover image URL when present', () => {
		const mod = {
			repoUrl: 'https://github.com/creator/ebr-mod-base-content',
			commitHash: 'abc123',
			coverImage: 'Pictures/cover.png',
		};
		expect(coverImageUrl(mod)).toBe(
			'https://raw.githubusercontent.com/creator/ebr-mod-base-content/abc123/Pictures/cover.png',
		);
	});

	it('returns null when coverImage is undefined', () => {
		const mod = {
			repoUrl: 'https://github.com/creator/ebr-mod-base-content',
			commitHash: 'abc123',
		};
		expect(coverImageUrl(mod)).toBeNull();
	});

	it('returns null when coverImage is empty string', () => {
		const mod = {
			repoUrl: 'https://github.com/creator/ebr-mod-base-content',
			commitHash: 'abc123',
			coverImage: '',
		};
		expect(coverImageUrl(mod)).toBeNull();
	});
});

// --- rewriteImagePaths ---

describe('rewriteImagePaths', () => {
	const mod = {
		repoUrl: 'https://github.com/creator/ebr-mod-base-content',
		commitHash: 'abc123',
	};

	it('rewrites relative image paths to absolute raw GitHub URLs', () => {
		const md = '![Screenshot](images/demo.png)';
		expect(rewriteImagePaths(md, mod)).toBe(
			'![Screenshot](https://raw.githubusercontent.com/creator/ebr-mod-base-content/abc123/images/demo.png)',
		);
	});

	it('leaves absolute http URLs unchanged', () => {
		const md = '![Logo](https://example.com/logo.png)';
		expect(rewriteImagePaths(md, mod)).toBe(md);
	});

	it('leaves absolute https URLs unchanged', () => {
		const md = '![Logo](https://cdn.example.com/img.jpg)';
		expect(rewriteImagePaths(md, mod)).toBe(md);
	});

	it('rewrites multiple images in one string', () => {
		const md = '![A](a.png)\n\nSome text\n\n![B](dir/b.jpg)';
		const result = rewriteImagePaths(md, mod);
		expect(result).toContain(
			'https://raw.githubusercontent.com/creator/ebr-mod-base-content/abc123/a.png',
		);
		expect(result).toContain(
			'https://raw.githubusercontent.com/creator/ebr-mod-base-content/abc123/dir/b.jpg',
		);
	});

	it('handles empty alt text', () => {
		const md = '![](icon.svg)';
		expect(rewriteImagePaths(md, mod)).toBe(
			'![](https://raw.githubusercontent.com/creator/ebr-mod-base-content/abc123/icon.svg)',
		);
	});

	it('returns unchanged markdown with no images', () => {
		const md = '# Hello\n\nSome text with [a link](page.md).';
		expect(rewriteImagePaths(md, mod)).toBe(md);
	});
});

// --- getRegistryCampaignName ---

describe('getRegistryCampaignName', () => {
	it('returns the slug when the map is empty', () => {
		// Before parseRegistry populates the map, unknown IDs return as-is
		expect(getRegistryCampaignName('unknown-campaign')).toBe('unknown-campaign');
	});

	it('returns the mod name for campaign-type mods after parseRegistry', () => {
		parseRegistry(validRegistryData([
			validMod({ id: 'my-custom-campaign', name: 'My Custom Campaign', type: 'campaign' }),
		]));
		expect(getRegistryCampaignName('my-custom-campaign')).toBe('My Custom Campaign');
	});

	it('returns the mod name for one-day-mission-type mods after parseRegistry', () => {
		parseRegistry(validRegistryData([
			validMod({ id: 'rescue-mission', name: 'Rescue Mission', type: 'one-day-mission' }),
		]));
		expect(getRegistryCampaignName('rescue-mission')).toBe('Rescue Mission');
	});

	it('does not include enhancement-type mods in the campaign map', () => {
		parseRegistry(validRegistryData([
			validMod({ id: 'some-enhancement', name: 'Some Enhancement', type: 'enhancement' }),
		]));
		expect(getRegistryCampaignName('some-enhancement')).toBe('some-enhancement');
	});

	it('does not include collection-type mods in the campaign map', () => {
		parseRegistry(validRegistryData([
			validMod({ id: 'mega-collection', name: 'Mega Collection', type: 'collection' }),
		]));
		expect(getRegistryCampaignName('mega-collection')).toBe('mega-collection');
	});

	it('rebuilds the map on each parseRegistry call', () => {
		parseRegistry(validRegistryData([
			validMod({ id: 'campaign-a', name: 'Campaign A', type: 'campaign' }),
		]));
		expect(getRegistryCampaignName('campaign-a')).toBe('Campaign A');

		// Second parse with a different campaign replaces the map
		parseRegistry(validRegistryData([
			validMod({ id: 'campaign-b', name: 'Campaign B', type: 'campaign' }),
		]));
		expect(getRegistryCampaignName('campaign-a')).toBe('campaign-a');
		expect(getRegistryCampaignName('campaign-b')).toBe('Campaign B');
	});
});
