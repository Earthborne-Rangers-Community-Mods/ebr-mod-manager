import { describe, it, expect } from 'vitest';
import { zipSync, unzipSync } from 'fflate';
import {
	extractModZip,
	repackageModZip,
	detectTopLevelPrefix,
	assertNoPathTraversal,
	isBlocked,
	hasAllowedExtension,
	verifyZipCommitHash,
	ALLOWED_EXTENSIONS,
} from '$lib/extraction.js';
import { PathTraversalError, ZipHashMismatchError } from '$lib/errors.js';

/** Helper: build a zip buffer with given file entries. */
function makeZip(files: Record<string, string | Uint8Array>): ArrayBuffer {
	const entries: Record<string, Uint8Array> = {};
	for (const [path, content] of Object.entries(files)) {
		entries[path] =
			typeof content === 'string' ? new TextEncoder().encode(content) : content;
	}
	const zipped = zipSync(entries);
	return zipped.buffer as ArrayBuffer;
}

// --- detectTopLevelPrefix ---

describe('detectTopLevelPrefix', () => {
	it('detects a common top-level directory', () => {
		const paths = ['owner-repo-abc123/', 'owner-repo-abc123/README.md', 'owner-repo-abc123/src/index.js'];
		expect(detectTopLevelPrefix(paths)).toBe('owner-repo-abc123/');
	});

	it('returns empty string when paths have no common prefix', () => {
		expect(detectTopLevelPrefix(['a/file.md', 'b/file.md'])).toBe('');
	});

	it('returns empty string for empty array', () => {
		expect(detectTopLevelPrefix([])).toBe('');
	});

	it('returns empty string when no slash in first path', () => {
		expect(detectTopLevelPrefix(['file.md'])).toBe('');
	});
});

// --- assertNoPathTraversal ---

describe('assertNoPathTraversal', () => {
	it('accepts a normal relative path', () => {
		expect(() => assertNoPathTraversal('src/lib/file.ts')).not.toThrow();
	});

	it('accepts a top-level file', () => {
		expect(() => assertNoPathTraversal('README.md')).not.toThrow();
	});

	it('rejects paths with .. segments', () => {
		expect(() => assertNoPathTraversal('../etc/passwd')).toThrow(PathTraversalError);
	});

	it('rejects paths with embedded .. segments', () => {
		expect(() => assertNoPathTraversal('src/../../etc/passwd')).toThrow(PathTraversalError);
	});

	it('rejects absolute paths starting with /', () => {
		expect(() => assertNoPathTraversal('/etc/passwd')).toThrow(PathTraversalError);
	});

	it('rejects Windows absolute paths', () => {
		expect(() => assertNoPathTraversal('C:\\Windows\\System32\\cmd.exe')).toThrow(
			PathTraversalError,
		);
	});

	it('rejects paths with backslashes', () => {
		expect(() => assertNoPathTraversal('src\\..\\etc\\passwd')).toThrow(PathTraversalError);
	});
	it('rejects paths with null bytes', () => {
		expect(() => assertNoPathTraversal('src/file\0.md')).toThrow(PathTraversalError);
	});

	it('rejects paths with embedded null bytes before extension', () => {
		expect(() => assertNoPathTraversal('malware.exe\0.md')).toThrow(PathTraversalError);
	});
});

// --- assertNotBlocked ---

describe('isBlocked', () => {
	it('allows normal .obsidian paths', () => {
		expect(isBlocked('.obsidian/snippets/ebr-symbols.css')).toBe(false);
	});

	it('allows .obsidian/app.json', () => {
		expect(isBlocked('.obsidian/app.json')).toBe(false);
	});

	it('blocks .obsidian/plugins/ directory contents', () => {
		expect(isBlocked('.obsidian/plugins/evil-plugin/main.js')).toBe(true);
	});

	it('blocks .obsidian/plugins/ with exact prefix match', () => {
		expect(isBlocked('.obsidian/plugins/')).toBe(true);
	});

	it('blocks .obsidian/community-plugins.json', () => {
		expect(isBlocked('.obsidian/community-plugins.json')).toBe(true);
	});

	it('blocks .github/ directory contents', () => {
		expect(isBlocked('.github/workflows/build.yml')).toBe(true);
		expect(isBlocked('.github/README.md')).toBe(true);
	});

	it('is case-insensitive', () => {
		expect(isBlocked('.Obsidian/Plugins/evil/main.js')).toBe(true);
	});
});

// --- hasAllowedExtension ---

describe('hasAllowedExtension', () => {
	it('allows .md files', () => {
		expect(hasAllowedExtension('README.md')).toBe(true);
	});

	it('allows .css files', () => {
		expect(hasAllowedExtension('.obsidian/snippets/theme.css')).toBe(true);
	});

	it('allows .json files', () => {
		expect(hasAllowedExtension('ebr-mod.json')).toBe(true);
	});

	it('allows image files', () => {
		expect(hasAllowedExtension('cover.png')).toBe(true);
		expect(hasAllowedExtension('photo.jpg')).toBe(true);
		expect(hasAllowedExtension('photo.jpeg')).toBe(true);
		expect(hasAllowedExtension('icon.gif')).toBe(true);
		expect(hasAllowedExtension('banner.webp')).toBe(true);
		expect(hasAllowedExtension('diagram.svg')).toBe(true);
	});

	it('allows .txt and .pdf', () => {
		expect(hasAllowedExtension('notes.txt')).toBe(true);
		expect(hasAllowedExtension('guide.pdf')).toBe(true);
	});

	it('rejects executable files', () => {
		expect(hasAllowedExtension('malware.exe')).toBe(false);
		expect(hasAllowedExtension('script.bat')).toBe(false);
		expect(hasAllowedExtension('script.sh')).toBe(false);
		expect(hasAllowedExtension('script.ps1')).toBe(false);
		expect(hasAllowedExtension('library.dll')).toBe(false);
	});

	it('rejects files with no extension', () => {
		expect(hasAllowedExtension('Makefile')).toBe(false);
	});

	it('is case-insensitive for extensions', () => {
		expect(hasAllowedExtension('FILE.MD')).toBe(true);
		expect(hasAllowedExtension('IMAGE.PNG')).toBe(true);
	});
});

// --- extractModZip (integration) ---

describe('extractModZip', () => {
	it('extracts files from a GitHub-style zip with top-level prefix', () => {
		const zip = makeZip({
			'owner-repo-abc123/': new Uint8Array(0),
			'owner-repo-abc123/README.md': '# Hello',
			'owner-repo-abc123/ebr-mod.json': '{}',
			'owner-repo-abc123/src/page.md': '# Page',
		});

		const files = extractModZip(zip);
		const paths = files.map((f) => f.path);

		expect(paths).toContain('README.md');
		expect(paths).toContain('ebr-mod.json');
		expect(paths).toContain('src/page.md');
		// Top-level prefix should be stripped
		expect(paths.every((p) => !p.startsWith('owner-repo-abc123/'))).toBe(true);
	});

	it('preserves file content', () => {
		const zip = makeZip({
			'prefix/': new Uint8Array(0),
			'prefix/hello.md': '# Hello World',
		});

		const files = extractModZip(zip);
		const hello = files.find((f) => f.path === 'hello.md')!;
		expect(new TextDecoder().decode(hello.data)).toBe('# Hello World');
	});

	it('silently drops files with disallowed extensions', () => {
		const zip = makeZip({
			'prefix/': new Uint8Array(0),
			'prefix/readme.md': '# OK',
			'prefix/malware.exe': 'evil',
			'prefix/script.sh': '#!/bin/bash',
			'prefix/.gitignore': 'node_modules',
		});

		const files = extractModZip(zip);
		const paths = files.map((f) => f.path);

		expect(paths).toContain('readme.md');
		expect(paths).not.toContain('malware.exe');
		expect(paths).not.toContain('script.sh');
		expect(paths).not.toContain('.gitignore');
	});

	it('throws on path traversal attempts', () => {
		const zip = makeZip({
			'prefix/': new Uint8Array(0),
			'prefix/../../../etc/passwd.md': 'evil',
		});

		expect(() => extractModZip(zip)).toThrow(PathTraversalError);
	});

	it('silently drops .obsidian/plugins/ content with allowed extension', () => {
		const zip = makeZip({
			'prefix/': new Uint8Array(0),
			'prefix/readme.md': '# OK',
			'prefix/.obsidian/plugins/evil/manifest.json': '{}',
		});

		const files = extractModZip(zip);
		expect(files).toHaveLength(1);
		expect(files[0].path).toBe('readme.md');
	});

	it('silently drops .obsidian/plugins/ content with disallowed extension', () => {
		const zip = makeZip({
			'prefix/': new Uint8Array(0),
			'prefix/readme.md': '# OK',
			'prefix/.obsidian/plugins/evil/main.js': 'evil',
		});

		const files = extractModZip(zip);
		expect(files).toHaveLength(1);
		expect(files[0].path).toBe('readme.md');
	});

	it('silently drops community-plugins.json', () => {
		const zip = makeZip({
			'prefix/': new Uint8Array(0),
			'prefix/readme.md': '# OK',
			'prefix/.obsidian/community-plugins.json': '["evil-plugin"]',
		});

		const files = extractModZip(zip);
		expect(files).toHaveLength(1);
		expect(files[0].path).toBe('readme.md');
	});

	it('allows safe .obsidian content', () => {
		const zip = makeZip({
			'prefix/': new Uint8Array(0),
			'prefix/.obsidian/snippets/ebr-symbols.css': '.progress { color: red; }',
			'prefix/.obsidian/app.json': '{}',
		});

		const files = extractModZip(zip);
		const paths = files.map((f) => f.path);

		expect(paths).toContain('.obsidian/snippets/ebr-symbols.css');
		expect(paths).toContain('.obsidian/app.json');
	});

	it('handles zip without top-level prefix', () => {
		const zip = makeZip({
			'readme.md': '# Hello',
			'data.json': '{}',
		});

		const files = extractModZip(zip);
		const paths = files.map((f) => f.path);

		expect(paths).toContain('readme.md');
		expect(paths).toContain('data.json');
	});

	it('skips directory entries', () => {
		const zip = makeZip({
			'prefix/': new Uint8Array(0),
			'prefix/subdir/': new Uint8Array(0),
			'prefix/subdir/file.md': '# File',
		});

		const files = extractModZip(zip);
		expect(files).toHaveLength(1);
		expect(files[0].path).toBe('subdir/file.md');
	});
});

// --- repackageModZip ---

describe('repackageModZip', () => {
	it('produces a valid zip containing only allowed files', () => {
		const zip = makeZip({
			'prefix/': new Uint8Array(0),
			'prefix/readme.md': '# Hello',
			'prefix/data.json': '{}',
			'prefix/malware.exe': 'evil',
			'prefix/script.sh': '#!/bin/bash',
		});

		const cleanZip = repackageModZip(zip);
		const entries = unzipSync(cleanZip);
		const paths = Object.keys(entries);

		expect(paths).toContain('readme.md');
		expect(paths).toContain('data.json');
		expect(paths).not.toContain('malware.exe');
		expect(paths).not.toContain('script.sh');
	});

	it('preserves file content through repackaging', () => {
		const zip = makeZip({
			'prefix/': new Uint8Array(0),
			'prefix/hello.md': '# Hello World',
		});

		const cleanZip = repackageModZip(zip);
		const entries = unzipSync(cleanZip);
		expect(new TextDecoder().decode(entries['hello.md'])).toBe('# Hello World');
	});

	it('silently drops blocked content', () => {
		const zip = makeZip({
			'prefix/': new Uint8Array(0),
			'prefix/readme.md': '# OK',
			'prefix/.obsidian/plugins/evil/manifest.json': '{}',
		});

		const cleanZip = repackageModZip(zip);
		const entries = unzipSync(cleanZip);
		const paths = Object.keys(entries);

		expect(paths).toContain('readme.md');
		expect(paths).not.toContain('.obsidian/plugins/evil/manifest.json');
		// The smuggled plugin is dropped; only the trusted read-only plugin remains.
		expect(paths).toContain('.obsidian/plugins/read-only-view/main.js');
		expect(paths.filter((p) => p.startsWith('.obsidian/plugins/')).every((p) =>
			p.startsWith('.obsidian/plugins/read-only-view/'))).toBe(true);
		// ...and it is the only enabled plugin even with smuggled input present.
		expect(JSON.parse(
			new TextDecoder().decode(entries['.obsidian/community-plugins.json']),
		)).toEqual(['read-only-view']);
	});

	it('verifies commit hash when expectedCommitHash is provided', () => {
		const zip = makeZip({
			'owner-repo-abc1234/': new Uint8Array(0),
			'owner-repo-abc1234/readme.md': '# OK',
		});

		const cleanZip = repackageModZip(zip, { expectedCommitHash: 'abc1234567890abcdef' });
		const entries = unzipSync(cleanZip);
		expect(Object.keys(entries)).toContain('readme.md');
	});

	it('throws ZipHashMismatchError when commit hash mismatches during repackage', () => {
		const zip = makeZip({
			'owner-repo-abc1234/': new Uint8Array(0),
			'owner-repo-abc1234/readme.md': '# OK',
		});

		expect(() => repackageModZip(zip, { expectedCommitHash: 'ffffff0000000000000' }))
			.toThrow(ZipHashMismatchError);
	});

	it('injects the trusted read-only plugin and enables it', () => {
		const zip = makeZip({
			'prefix/': new Uint8Array(0),
			'prefix/readme.md': '# Hello',
		});

		const cleanZip = repackageModZip(zip);
		const entries = unzipSync(cleanZip);
		const paths = Object.keys(entries);

		expect(paths).toContain('readme.md');
		expect(paths).toContain('.obsidian/plugins/read-only-view/main.js');
		expect(paths).toContain('.obsidian/plugins/read-only-view/manifest.json');
		expect(paths).toContain('.obsidian/community-plugins.json');

		const enabled = JSON.parse(
			new TextDecoder().decode(entries['.obsidian/community-plugins.json']),
		);
		expect(enabled).toEqual(['read-only-view']);
	});
});

// --- verifyZipCommitHash ---

describe('verifyZipCommitHash', () => {
	it('passes when short hash matches expected full hash', () => {
		expect(() => verifyZipCommitHash(
			'owner-repo-abc1234/',
			'abc1234567890abcdef1234567890abcdef123456'
		)).not.toThrow();
	});

	it('passes when full hash starts with the short hash (7 chars)', () => {
		expect(() => verifyZipCommitHash(
			'some-owner-some-repo-f4c8a91/',
			'f4c8a911234567890abcdef1234567890abcdef12'
		)).not.toThrow();
	});

	it('is case-insensitive', () => {
		expect(() => verifyZipCommitHash(
			'owner-repo-ABC1234/',
			'abc1234567890abcdef1234567890abcdef123456'
		)).not.toThrow();
	});

	it('throws ZipHashMismatchError when hashes do not match', () => {
		expect(() => verifyZipCommitHash(
			'owner-repo-ffffff/',
			'abc1234567890abcdef1234567890abcdef123456'
		)).toThrow(ZipHashMismatchError);
	});

	it('throws when prefix has no hyphen', () => {
		expect(() => verifyZipCommitHash(
			'nohyphen/',
			'abc1234567890abcdef1234567890abcdef123456'
		)).toThrow(ZipHashMismatchError);
	});

	it('throws when hash suffix is empty (trailing hyphen in dir name)', () => {
		expect(() => verifyZipCommitHash(
			'owner-repo-/',
			'abc1234567890abcdef1234567890abcdef123456'
		)).toThrow(ZipHashMismatchError);
	});

	it('handles repos with hyphens in owner or name', () => {
		expect(() => verifyZipCommitHash(
			'my-org-my-cool-repo-abc1234/',
			'abc1234567890abcdef1234567890abcdef123456'
		)).not.toThrow();
	});

	it('rejects when only first 7 chars match but suffix is longer and diverges', () => {
		expect(() => verifyZipCommitHash(
			'owner-repo-abc1234xxx/',
			'abc1234567890abcdef1234567890abcdef123456'
		)).toThrow(ZipHashMismatchError);
	});

	it('populates expectedHash and actualHash on ZipHashMismatchError', () => {
		let caught: ZipHashMismatchError | undefined;
		try {
			verifyZipCommitHash('owner-repo-ffffff/', 'abc1234567890abcdef');
		} catch (e) {
			caught = e as ZipHashMismatchError;
		}
		expect(caught).toBeInstanceOf(ZipHashMismatchError);
		expect(caught?.expectedHash).toBe('abc1234567890abcdef');
		expect(caught?.actualHash).toBe('ffffff');
	});
});

// --- extractModZip with commit hash verification ---

describe('extractModZip with expectedCommitHash', () => {
	it('extracts normally when commit hash matches', () => {
		const zip = makeZip({
			'owner-repo-abc1234/': new Uint8Array(0),
			'owner-repo-abc1234/readme.md': '# Hello',
		});

		const files = extractModZip(zip, { expectedCommitHash: 'abc1234567890abcdef' });
		expect(files).toHaveLength(1);
		expect(files[0].path).toBe('readme.md');
	});

	it('throws ZipHashMismatchError when commit hash does not match', () => {
		const zip = makeZip({
			'owner-repo-abc1234/': new Uint8Array(0),
			'owner-repo-abc1234/readme.md': '# Hello',
		});

		expect(() => extractModZip(zip, { expectedCommitHash: 'ffffff0000000000000' }))
			.toThrow(ZipHashMismatchError);
	});

	it('does not verify when expectedCommitHash is not provided', () => {
		const zip = makeZip({
			'owner-repo-abc1234/': new Uint8Array(0),
			'owner-repo-abc1234/readme.md': '# Hello',
		});

		// Should not throw even though no hash to compare
		const files = extractModZip(zip);
		expect(files).toHaveLength(1);
	});

	it('throws when zip has no top-level prefix (fail-closed)', () => {
		const zip = makeZip({
			'readme.md': '# Hello',
			'data.json': '{}',
		});

		// No top-level prefix detected - cannot verify commit origin, so reject
		expect(() => extractModZip(zip, { expectedCommitHash: 'abc1234' }))
			.toThrow(ZipHashMismatchError);
	});

	it('throws PathTraversalError for null byte path in zip', () => {
		const zip = makeZip({
			'prefix/': new Uint8Array(0),
			'prefix/malware.exe\0.md': 'evil',
		});
		expect(() => extractModZip(zip)).toThrow(PathTraversalError);
	});
});
