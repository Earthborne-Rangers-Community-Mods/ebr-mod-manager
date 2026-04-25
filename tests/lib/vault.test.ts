// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	checkVaultDirectory,
	writeVault,
	isFileSystemAccessSupported,
	getInstalledMod,
	setInstalledMod,
	clearInstalledMod,
} from '$lib/vault.js';
import type { ExtractedFile } from '$lib/extraction.js';

// --- Mock FileSystemDirectoryHandle helpers ---

interface MockEntry {
	kind: 'file' | 'directory';
	name: string;
}

function mockDirHandle(
	name: string,
	entries: MockEntry[] = [],
	options?: {
		subdirs?: Record<string, ReturnType<typeof mockDirHandle>>;
		onGetFileHandle?: (name: string, opts?: any) => any;
		onGetDirectoryHandle?: (name: string, opts?: any) => any;
	},
): FileSystemDirectoryHandle {
	const writtenFiles: Record<string, Uint8Array[]> = {};

	const handle = {
		kind: 'directory' as const,
		name,
		async *values() {
			for (const entry of entries) {
				yield entry;
			}
		},
		getFileHandle: options?.onGetFileHandle ?? vi.fn(async (fileName: string, opts?: { create?: boolean }) => {
			return mockFileHandle(fileName, writtenFiles);
		}),
		getDirectoryHandle: options?.onGetDirectoryHandle ?? vi.fn(async (dirName: string, opts?: { create?: boolean }) => {
			if (options?.subdirs?.[dirName]) return options.subdirs[dirName];
			return mockDirHandle(dirName);
		}),
		_writtenFiles: writtenFiles,
	};
	return handle as unknown as FileSystemDirectoryHandle;
}

function mockFileHandle(name: string, store: Record<string, Uint8Array[]>) {
	return {
		kind: 'file' as const,
		name,
		createWritable: vi.fn(async () => {
			const chunks: Uint8Array[] = [];
			return {
				write: vi.fn(async (data: Uint8Array) => {
					chunks.push(data);
				}),
				close: vi.fn(async () => {
					store[name] = chunks;
				}),
			};
		}),
	};
}

// --- assertVaultSafe ---

describe('checkVaultDirectory', () => {
	it('returns empty for an empty directory', async () => {
		const dir = mockDirHandle('empty-folder', []);
		await expect(checkVaultDirectory(dir)).resolves.toBe('empty');
	});

	it('returns existing-vault for a directory with ebr-mod.json and .obsidian', async () => {
		const dir = mockDirHandle('vault', [
			{ kind: 'file', name: 'ebr-mod.json' },
			{ kind: 'directory', name: '.obsidian' },
		]);
		await expect(checkVaultDirectory(dir)).resolves.toBe('existing-vault');
	});

	it('returns existing-vault even with other files alongside the markers', async () => {
		const dir = mockDirHandle('vault', [
			{ kind: 'file', name: 'ebr-mod.json' },
			{ kind: 'directory', name: '.obsidian' },
			{ kind: 'file', name: 'README.md' },
		]);
		await expect(checkVaultDirectory(dir)).resolves.toBe('existing-vault');
	});

	it('returns unrecognized for ebr-mod.json without .obsidian', async () => {
		const dir = mockDirHandle('vault', [{ kind: 'file', name: 'ebr-mod.json' }]);
		await expect(checkVaultDirectory(dir)).resolves.toBe('unrecognized');
	});

	it('returns unrecognized for a directory with unrecognized content', async () => {
		const dir = mockDirHandle('my-notes', [
			{ kind: 'file', name: 'personal-diary.md' },
			{ kind: 'directory', name: 'projects' },
		]);
		await expect(checkVaultDirectory(dir)).resolves.toBe('unrecognized');
	});

	it('returns unrecognized for a directory with .obsidian but no ebr-mod.json', async () => {
		const dir = mockDirHandle('some-vault', [
			{ kind: 'directory', name: '.obsidian' },
			{ kind: 'file', name: 'other-stuff.md' },
		]);
		await expect(checkVaultDirectory(dir)).resolves.toBe('unrecognized');
	});

	it('does not match ebr-mod.json as a directory name', async () => {
		const dir = mockDirHandle('tricky', [
			{ kind: 'directory', name: 'ebr-mod.json' },
			{ kind: 'directory', name: '.obsidian' },
		]);
		await expect(checkVaultDirectory(dir)).resolves.toBe('unrecognized');
	});

	it('does not match .obsidian as a file name', async () => {
		const dir = mockDirHandle('tricky', [
			{ kind: 'file', name: 'ebr-mod.json' },
			{ kind: 'file', name: '.obsidian' },
		]);
		await expect(checkVaultDirectory(dir)).resolves.toBe('unrecognized');
	});

	it('does not recurse into subfolders containing markers', async () => {
		const subfolder = mockDirHandle('subfolder', [
			{ kind: 'file', name: 'ebr-mod.json' },
			{ kind: 'directory', name: '.obsidian' },
		]);
		const dir = mockDirHandle('parent', [
			{ kind: 'directory', name: 'subfolder' },
		], { subdirs: { subfolder } });
		await expect(checkVaultDirectory(dir)).resolves.toBe('unrecognized');
	});
});

// --- writeVault ---

describe('writeVault', () => {
	it('writes files to the directory handle', async () => {
		const files: ExtractedFile[] = [
			{ path: 'README.md', data: new TextEncoder().encode('# Hello') },
			{ path: 'ebr-mod.json', data: new TextEncoder().encode('{}') },
		];

		const fileHandles: Record<string, any> = {};
		const dir = mockDirHandle('vault', []);
		dir.getFileHandle = vi.fn(async (name: string, opts?: any) => {
			const handle = mockFileHandle(name, {});
			fileHandles[name] = handle;
			return handle;
		}) as any;

		await writeVault(dir, files);

		expect(dir.getFileHandle).toHaveBeenCalledWith('README.md', { create: true });
		expect(dir.getFileHandle).toHaveBeenCalledWith('ebr-mod.json', { create: true });
		expect(fileHandles['README.md'].createWritable).toHaveBeenCalled();
		expect(fileHandles['ebr-mod.json'].createWritable).toHaveBeenCalled();
	});

	it('creates subdirectories as needed', async () => {
		const files: ExtractedFile[] = [
			{
				path: '.obsidian/snippets/theme.css',
				data: new TextEncoder().encode('.test {}'),
			},
		];

		const createdDirs: string[] = [];
		const leafDir = mockDirHandle('snippets', []);

		const obsidianDir = mockDirHandle('.obsidian', []);
		obsidianDir.getDirectoryHandle = vi.fn(async (name: string, opts?: any) => {
			createdDirs.push(name);
			return leafDir;
		}) as any;

		const dir = mockDirHandle('vault', []);
		dir.getDirectoryHandle = vi.fn(async (name: string, opts?: any) => {
			createdDirs.push(name);
			return obsidianDir;
		}) as any;

		await writeVault(dir, files);

		expect(createdDirs).toContain('.obsidian');
		expect(createdDirs).toContain('snippets');
	});

	it('reports progress via callback', async () => {
		const files: ExtractedFile[] = [
			{ path: 'a.md', data: new TextEncoder().encode('a') },
			{ path: 'b.md', data: new TextEncoder().encode('b') },
			{ path: 'c.md', data: new TextEncoder().encode('c') },
		];

		const progressCalls: [number, number][] = [];
		const dir = mockDirHandle('vault', []);

		await writeVault(dir, files, {
			onProgress: (written, total) => progressCalls.push([written, total]),
		});

		expect(progressCalls).toEqual([
			[1, 3],
			[2, 3],
			[3, 3],
		]);
	});
});

// --- InstalledMod localStorage ---

describe('installed mod tracking', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('returns null when nothing is stored', () => {
		expect(getInstalledMod()).toBeNull();
	});

	it('stores and retrieves installed mod info', () => {
		setInstalledMod({
			id: 'test-mod',
			name: 'Test Mod',
			version: '1.0.0',
			commitHash: 'abc123',
		});

		const result = getInstalledMod();
		expect(result).toEqual({
			id: 'test-mod',
			name: 'Test Mod',
			version: '1.0.0',
			commitHash: 'abc123',
		});
	});

	it('clears installed mod info', () => {
		setInstalledMod({
			id: 'test-mod',
			name: 'Test Mod',
			version: '1.0.0',
			commitHash: 'abc123',
		});
		clearInstalledMod();
		expect(getInstalledMod()).toBeNull();
	});

	it('returns null for corrupted localStorage data', () => {
		localStorage.setItem('ebr-installed-mod', 'not-json{{{');
		expect(getInstalledMod()).toBeNull();
	});
});

// --- isFileSystemAccessSupported ---

describe('isFileSystemAccessSupported', () => {
	it('returns true when showDirectoryPicker is available', () => {
		(window as any).showDirectoryPicker = vi.fn();
		expect(isFileSystemAccessSupported()).toBe(true);
	});

	it('returns false when showDirectoryPicker is not available', () => {
		delete (window as any).showDirectoryPicker;
		expect(isFileSystemAccessSupported()).toBe(false);
	});
});
