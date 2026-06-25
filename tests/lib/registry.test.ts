import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	parseRegistry,
	parseRepoUrl,
	modFileUrl,
	rewriteImagePaths,
	getRegistryCampaignName,
	fetchDescription,
	fetchRegistry,
	readRegistryCache,
	writeRegistryCache,
	clearRegistryCache,
	isRegistryFresh,
	REGISTRY_TTL_MS,
	DESCRIPTION_FILENAME,
} from '$lib/registry.js';
import {
	RegistryParseError,
	RegistryFetchError,
	InvalidRepoUrlError,
	DescriptionFetchError,
	NetworkError,
} from '$lib/errors.js';
import type { BrowseMod } from '$lib/registry.js';

// --- Helpers ---

/**
 * Install a minimal in-memory Cache API on the global `caches` for a test.
 * Returns the backing store so a test can seed or inspect entries directly.
 * Each `match` returns a fresh clone so a stored body can be read more than
 * once, mirroring the real Cache API. Call `vi.unstubAllGlobals()` in an
 * afterEach to remove it.
 */
function installMockCaches(): Map<string, Response> {
	const store = new Map<string, Response>();
	const cache = {
		async match(request: string): Promise<Response | undefined> {
			const hit = store.get(request);
			return hit ? hit.clone() : undefined;
		},
		async put(request: string, response: Response): Promise<void> {
			store.set(request, response);
		},
	};
	vi.stubGlobal('caches', {
		open: async () => cache,
		async delete(): Promise<boolean> {
			const had = store.size > 0;
			store.clear();
			return had;
		},
	});
	return store;
}

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

/** Cast a typed fixture to a mutable bag so negative tests can delete or overwrite fields. */
function asRecord(mod: BrowseMod): Record<string, unknown> {
	return mod as unknown as Record<string, unknown>;
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
		delete asRecord(mod).tags;
		delete asRecord(mod).icon;
		delete asRecord(mod).author;
		delete asRecord(mod).description;
		delete asRecord(mod).language;
		delete asRecord(mod).latestVersion;
		delete asRecord(mod).updatedAt;
		delete asRecord(mod).campaigns;
		delete asRecord(mod).requiredProducts;
		delete asRecord(mod).safeToAddMidCampaign;
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
			delete asRecord(mod)[field];
			const result = parseRegistry(validRegistryData([mod]));
			expect(result.mods).toHaveLength(0);
		});

		it(`skips a mod where '${field}' is not a string`, () => {
			const mod = validMod();
			asRecord(mod)[field] = 42;
			const result = parseRegistry(validRegistryData([mod]));
			expect(result.mods).toHaveLength(0);
		});
	}

	// These fields degrade gracefully with defaults
	it('defaults author to empty string when missing', () => {
		const mod = validMod();
		delete asRecord(mod).author;
		const result = parseRegistry(validRegistryData([mod]));
		expect(result.mods[0].author).toBe('');
	});

	it('defaults description to empty string when missing', () => {
		const mod = validMod();
		delete asRecord(mod).description;
		const result = parseRegistry(validRegistryData([mod]));
		expect(result.mods[0].description).toBe('');
	});

	it('defaults language to "en" when missing', () => {
		const mod = validMod();
		delete asRecord(mod).language;
		const result = parseRegistry(validRegistryData([mod]));
		expect(result.mods[0].language).toBe('en');
	});

	it('defaults campaigns to empty array when missing', () => {
		const mod = validMod();
		delete asRecord(mod).campaigns;
		const result = parseRegistry(validRegistryData([mod]));
		expect(result.mods[0].campaigns).toEqual([]);
	});

	it('defaults campaigns to empty array when not an array', () => {
		const mod = validMod();
		asRecord(mod).campaigns = 'not-array';
		const result = parseRegistry(validRegistryData([mod]));
		expect(result.mods[0].campaigns).toEqual([]);
	});

	it('defaults requiredProducts to empty array when missing', () => {
		const mod = validMod();
		delete asRecord(mod).requiredProducts;
		const result = parseRegistry(validRegistryData([mod]));
		expect(result.mods[0].requiredProducts).toEqual([]);
	});

	it('defaults safeToAddMidCampaign to false when missing', () => {
		const mod = validMod();
		delete asRecord(mod).safeToAddMidCampaign;
		const result = parseRegistry(validRegistryData([mod]));
		expect(result.mods[0].safeToAddMidCampaign).toBe(false);
	});

	it('defaults safeToAddMidCampaign to false when not boolean', () => {
		const mod = validMod();
		asRecord(mod).safeToAddMidCampaign = 'true';
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

	it('encodes spaces and other reserved characters in path segments', () => {
		expect(modFileUrl(mod, 'About this Mod.md')).toBe(
			'https://raw.githubusercontent.com/creator/ebr-mod-base-content/abc123/About%20this%20Mod.md',
		);
	});

	it('preserves path separators while encoding segments individually', () => {
		expect(modFileUrl(mod, 'Pictures/cover image.png')).toBe(
			'https://raw.githubusercontent.com/creator/ebr-mod-base-content/abc123/Pictures/cover%20image.png',
		);
	});
});

// --- fetchDescription ---

describe('fetchDescription', () => {
	const mod = {
		repoUrl: 'https://github.com/creator/ebr-mod-base-content',
		commitHash: 'abc123',
	};
	const expectedUrl =
		'https://raw.githubusercontent.com/creator/ebr-mod-base-content/abc123/About%20this%20Mod.md';

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('exposes the canonical filename as DESCRIPTION_FILENAME', () => {
		expect(DESCRIPTION_FILENAME).toBe('About this Mod.md');
	});

	it('fetches About this Mod.md from the pinned commit and returns its body', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response('# Hello\n\nBody', { status: 200 }),
		);
		const result = await fetchDescription(mod);
		expect(result).toBe('# Hello\n\nBody');
		expect(fetchSpy).toHaveBeenCalledWith(expectedUrl);
	});

	it('returns null when the file is not present (404)', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response('', { status: 404 }),
		);
		expect(await fetchDescription(mod)).toBeNull();
	});

	it('throws DescriptionFetchError on non-OK, non-404 responses', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response('', { status: 500, statusText: 'Server Error' }),
		);
		await expect(fetchDescription(mod)).rejects.toBeInstanceOf(DescriptionFetchError);
	});

	it('fetches anonymously - no options object means no Authorization header', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response('', { status: 200 }),
		);
		await fetchDescription(mod);
		// fetch(url) - single argument confirms no options/headers were passed
		expect(fetchSpy.mock.calls[0]).toHaveLength(1);
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

// --- fetchRegistry ---

describe('fetchRegistry', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('throws NetworkError when fetch throws TypeError (offline / DNS failure)', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

		await expect(fetchRegistry()).rejects.toBeInstanceOf(NetworkError);
	});

	it('preserves the original TypeError as cause on the NetworkError', async () => {
		const original = new TypeError('Failed to fetch');
		vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(original);

		try {
			await fetchRegistry();
			throw new Error('Expected to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(NetworkError);
			expect((err as NetworkError).cause).toBe(original);
		}
	});

	it('throws RegistryParseError when the response body is not valid JSON', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response('not json at all', { status: 200 }),
		);

		await expect(fetchRegistry()).rejects.toBeInstanceOf(RegistryParseError);
	});

	it('RegistryParseError from bad JSON targets the root field', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response('not json at all', { status: 200 }),
		);

		try {
			await fetchRegistry();
			throw new Error('Expected to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(RegistryParseError);
			expect((err as RegistryParseError).field).toBe('root');
		}
	});
});

// --- registry cache helpers ---

describe('isRegistryFresh', () => {
	it('is true when the entry is younger than the interval', () => {
		const now = 1_000_000;
		expect(isRegistryFresh(now - (REGISTRY_TTL_MS - 1), now)).toBe(true);
	});

	it('is false once the entry reaches the interval', () => {
		const now = 1_000_000;
		expect(isRegistryFresh(now - REGISTRY_TTL_MS, now)).toBe(false);
	});

	it('is false for an entry older than the interval', () => {
		const now = 1_000_000;
		expect(isRegistryFresh(now - (REGISTRY_TTL_MS + 1), now)).toBe(false);
	});
});

describe('registry cache helpers without a Cache API', () => {
	const cacheUrl = 'https://example.com/registry.json';

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('readRegistryCache returns null', async () => {
		// caches is undefined in the test environment unless stubbed.
		expect(typeof caches).toBe('undefined');
		expect(await readRegistryCache(cacheUrl)).toBeNull();
	});

	it('writeRegistryCache is a no-op and does not throw', async () => {
		await expect(writeRegistryCache(cacheUrl, '{}')).resolves.toBeUndefined();
	});

	it('clearRegistryCache is a no-op and does not throw', async () => {
		await expect(clearRegistryCache()).resolves.toBeUndefined();
	});
});

describe('registry cache helpers round trip', () => {
	const CACHED_AT_HEADER = 'x-ebr-cached-at';
	const cacheUrl = 'https://example.com/registry.json';

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('reads back what was written, stamped with the write time', async () => {
		installMockCaches();
		vi.spyOn(Date, 'now').mockReturnValue(5_000);

		await writeRegistryCache(cacheUrl, '{"schemaVersion":1,"mods":[]}');
		const cached = await readRegistryCache(cacheUrl);

		expect(cached).not.toBeNull();
		expect(cached?.cachedAt).toBe(5_000);
		expect(cached?.data).toEqual({ schemaVersion: 1, mods: [] });
	});

	it('returns null for a URL that was never written', async () => {
		installMockCaches();
		expect(await readRegistryCache(cacheUrl)).toBeNull();
	});

	it('clearRegistryCache drops a previously written entry', async () => {
		installMockCaches();
		await writeRegistryCache(cacheUrl, '{"schemaVersion":1,"mods":[]}');
		expect(await readRegistryCache(cacheUrl)).not.toBeNull();

		await clearRegistryCache();
		expect(await readRegistryCache(cacheUrl)).toBeNull();
	});

	it('treats a corrupt cached body as a miss', async () => {
		const store = installMockCaches();
		store.set(
			cacheUrl,
			new Response('not json', {
				headers: { [CACHED_AT_HEADER]: '5000' },
			}),
		);
		expect(await readRegistryCache(cacheUrl)).toBeNull();
	});

	it('treats a missing timestamp header as epoch zero (stale)', async () => {
		const store = installMockCaches();
		store.set(cacheUrl, new Response('{"schemaVersion":1,"mods":[]}'));

		const cached = await readRegistryCache(cacheUrl);
		expect(cached?.cachedAt).toBe(0);
		expect(isRegistryFresh(cached!.cachedAt, REGISTRY_TTL_MS + 1)).toBe(false);
	});
});

// --- fetchRegistry caching ---

describe('fetchRegistry caching', () => {
	const REGISTRY_URL =
		'https://raw.githubusercontent.com/Earthborne-Rangers-Community-Mods/ebr-mod-registry/main/registry.json';
	const TTL_MS = 60 * 60 * 1000;

	/** Seed the cache store with a registry body stamped at the given time. */
	function seedCache(store: Map<string, Response>, mods: unknown[], cachedAt: number) {
		store.set(
			REGISTRY_URL,
			new Response(JSON.stringify(validRegistryData(mods)), {
				headers: { 'x-ebr-cached-at': String(cachedAt) },
			}),
		);
	}

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('serves a fresh cached copy without hitting the network', async () => {
		const store = installMockCaches();
		vi.spyOn(Date, 'now').mockReturnValue(TTL_MS);
		seedCache(store, [validMod({ id: 'cached-mod' })], TTL_MS - 1);
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		const result = await fetchRegistry();

		expect(result.mods[0].id).toBe('cached-mod');
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('revalidates from the network when the cached copy is stale', async () => {
		const store = installMockCaches();
		vi.spyOn(Date, 'now').mockReturnValue(2 * TTL_MS);
		seedCache(store, [validMod({ id: 'stale-mod' })], 0);
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response(JSON.stringify(validRegistryData([validMod({ id: 'fresh-mod' })])), {
				status: 200,
			}),
		);

		const result = await fetchRegistry();

		expect(result.mods[0].id).toBe('fresh-mod');
		expect(fetchSpy).toHaveBeenCalledOnce();
	});

	it('forceRefresh bypasses a fresh cache and hits the network', async () => {
		const store = installMockCaches();
		vi.spyOn(Date, 'now').mockReturnValue(TTL_MS);
		seedCache(store, [validMod({ id: 'cached-mod' })], TTL_MS - 1);
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response(JSON.stringify(validRegistryData([validMod({ id: 'fresh-mod' })])), {
				status: 200,
			}),
		);

		const result = await fetchRegistry({ forceRefresh: true });

		expect(result.mods[0].id).toBe('fresh-mod');
		expect(fetchSpy).toHaveBeenCalledOnce();
	});

	it('writes a successful network response back to the cache', async () => {
		const store = installMockCaches();
		vi.spyOn(Date, 'now').mockReturnValue(123_456);
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response(JSON.stringify(validRegistryData([validMod({ id: 'written-mod' })])), {
				status: 200,
			}),
		);

		await fetchRegistry();

		const stored = store.get(REGISTRY_URL);
		expect(stored).toBeDefined();
		expect(stored?.headers.get('x-ebr-cached-at')).toBe('123456');
		expect((await stored!.clone().json()).mods[0].id).toBe('written-mod');
	});

	it('falls back to a stale cache when the network fails', async () => {
		const store = installMockCaches();
		vi.spyOn(Date, 'now').mockReturnValue(2 * TTL_MS);
		seedCache(store, [validMod({ id: 'stale-mod' })], 0);
		vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

		const result = await fetchRegistry();

		expect(result.mods[0].id).toBe('stale-mod');
	});

	it('falls back to a cached copy when the response is not OK', async () => {
		const store = installMockCaches();
		vi.spyOn(Date, 'now').mockReturnValue(2 * TTL_MS);
		seedCache(store, [validMod({ id: 'stale-mod' })], 0);
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response('', { status: 503, statusText: 'Service Unavailable' }),
		);

		const result = await fetchRegistry();

		expect(result.mods[0].id).toBe('stale-mod');
	});

	it('throws NetworkError when the network fails and nothing is cached', async () => {
		installMockCaches();
		vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'));

		await expect(fetchRegistry()).rejects.toBeInstanceOf(NetworkError);
	});

	it('throws RegistryFetchError when the response is not OK and nothing is cached', async () => {
		installMockCaches();
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response('', { status: 503, statusText: 'Service Unavailable' }),
		);

		await expect(fetchRegistry()).rejects.toBeInstanceOf(RegistryFetchError);
	});

	it('does not write to cache when the response body is not valid JSON', async () => {
		const store = installMockCaches();
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response('not json', { status: 200 }),
		);

		await expect(fetchRegistry()).rejects.toBeInstanceOf(RegistryParseError);
		expect(store.size).toBe(0);
	});

	it('does not write to cache when the response is valid JSON but not a valid registry', async () => {
		const store = installMockCaches();
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response('{"schemaVersion":"not-a-number","mods":[]}', { status: 200 }),
		);

		await expect(fetchRegistry()).rejects.toBeInstanceOf(RegistryParseError);
		expect(store.size).toBe(0);
	});

	it('normalizes a mid-stream body-read failure to RegistryParseError on root', async () => {
		const store = installMockCaches();
		// An OK response whose body stream rejects when read -- e.g. a connection
		// dropped after headers arrived. This must surface as the same parse error
		// the old response.json() path produced, not escape raw.
		const failingBody = {
			ok: true,
			status: 200,
			statusText: 'OK',
			text: () => Promise.reject(new TypeError('network error reading body')),
		} as unknown as Response;
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(failingBody);

		try {
			await fetchRegistry();
			throw new Error('Expected to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(RegistryParseError);
			expect((err as RegistryParseError).field).toBe('root');
		}
		expect(store.size).toBe(0);
	});
});
