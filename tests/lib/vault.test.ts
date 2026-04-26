// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	checkVaultBrowser,
	writeVaultBrowser,
	getInstallMethod,
	getInstalledMod,
	setInstalledMod,
	clearInstalledMod,
	uint8ArrayToBase64,
	pickVaultTarget,
	checkVaultNative,
	clearVaultNative,
	writeVaultNative,
} from '$lib/vault.js';
import type { ExtractedFile } from '$lib/extraction.js';

// --- Mock @capacitor/core ---

const mockIsNative = vi.hoisted(() => vi.fn(() => false));

vi.mock('@capacitor/core', () => ({
	Capacitor: { isNativePlatform: mockIsNative },
	registerPlugin: vi.fn(),
}));

// --- Mock ebr-vault-plugin ---

const mockPlugin = vi.hoisted(() => ({
	pickDirectory: vi.fn(async () => ({ uri: 'content://mock/picked' })),
	getStoredDirectory: vi.fn(async () => ({ uri: null as string | null })),
	listVaultContents: vi.fn(async () => ({ entries: [] as Array<{ name: string; isDirectory: boolean }> })),
	writeFile: vi.fn(async () => undefined),
	clearVaultContents: vi.fn(async () => undefined),
}));

vi.mock('$lib/ebr-vault-plugin.js', () => ({
	default: mockPlugin,
}));

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

describe('checkVaultBrowser', () => {
	it('returns empty for an empty directory', async () => {
		const dir = mockDirHandle('empty-folder', []);
		await expect(checkVaultBrowser(dir)).resolves.toBe('empty');
	});

	it('returns existing-vault for a directory with ebr-mod.json and .obsidian', async () => {
		const dir = mockDirHandle('vault', [
			{ kind: 'file', name: 'ebr-mod.json' },
			{ kind: 'directory', name: '.obsidian' },
		]);
		await expect(checkVaultBrowser(dir)).resolves.toBe('existing-vault');
	});

	it('returns existing-vault even with other files alongside the markers', async () => {
		const dir = mockDirHandle('vault', [
			{ kind: 'file', name: 'ebr-mod.json' },
			{ kind: 'directory', name: '.obsidian' },
			{ kind: 'file', name: 'README.md' },
		]);
		await expect(checkVaultBrowser(dir)).resolves.toBe('existing-vault');
	});

	it('returns unrecognized for ebr-mod.json without .obsidian', async () => {
		const dir = mockDirHandle('vault', [{ kind: 'file', name: 'ebr-mod.json' }]);
		await expect(checkVaultBrowser(dir)).resolves.toBe('unrecognized');
	});

	it('returns unrecognized for a directory with unrecognized content', async () => {
		const dir = mockDirHandle('my-notes', [
			{ kind: 'file', name: 'personal-diary.md' },
			{ kind: 'directory', name: 'projects' },
		]);
		await expect(checkVaultBrowser(dir)).resolves.toBe('unrecognized');
	});

	it('returns unrecognized for a directory with .obsidian but no ebr-mod.json', async () => {
		const dir = mockDirHandle('some-vault', [
			{ kind: 'directory', name: '.obsidian' },
			{ kind: 'file', name: 'other-stuff.md' },
		]);
		await expect(checkVaultBrowser(dir)).resolves.toBe('unrecognized');
	});

	it('does not match ebr-mod.json as a directory name', async () => {
		const dir = mockDirHandle('tricky', [
			{ kind: 'directory', name: 'ebr-mod.json' },
			{ kind: 'directory', name: '.obsidian' },
		]);
		await expect(checkVaultBrowser(dir)).resolves.toBe('unrecognized');
	});

	it('does not match .obsidian as a file name', async () => {
		const dir = mockDirHandle('tricky', [
			{ kind: 'file', name: 'ebr-mod.json' },
			{ kind: 'file', name: '.obsidian' },
		]);
		await expect(checkVaultBrowser(dir)).resolves.toBe('unrecognized');
	});

	it('does not recurse into subfolders containing markers', async () => {
		const subfolder = mockDirHandle('subfolder', [
			{ kind: 'file', name: 'ebr-mod.json' },
			{ kind: 'directory', name: '.obsidian' },
		]);
		const dir = mockDirHandle('parent', [
			{ kind: 'directory', name: 'subfolder' },
		], { subdirs: { subfolder } });
		await expect(checkVaultBrowser(dir)).resolves.toBe('unrecognized');
	});
});

// --- writeVaultBrowser ---

describe('writeVaultBrowser', () => {
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

		await writeVaultBrowser(dir, files);

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

		await writeVaultBrowser(dir, files);

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

		await writeVaultBrowser(dir, files, {
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

// --- getInstallMethod ---

describe('getInstallMethod', () => {
	it('returns vault-write on native platform', () => {
		mockIsNative.mockReturnValue(true);
		expect(getInstallMethod()).toBe('vault-write');
		mockIsNative.mockReturnValue(false);
	});

	it('returns vault-write when showDirectoryPicker is available', () => {
		(window as any).showDirectoryPicker = vi.fn();
		expect(getInstallMethod()).toBe('vault-write');
	});

	it('returns zip-download when showDirectoryPicker is not available', () => {
		delete (window as any).showDirectoryPicker;
		expect(getInstallMethod()).toBe('zip-download');
	});
});

// --- Capacitor vault operations (via ebr-vault-plugin) ---

describe('pickVaultTarget (native)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockIsNative.mockReturnValue(true);
	});

	afterEach(() => {
		mockIsNative.mockReturnValue(false);
	});

	it('returns stored directory if available', async () => {
		mockPlugin.getStoredDirectory.mockResolvedValueOnce({ uri: 'content://stored/uri' });

		const target = await pickVaultTarget('test-mod');

		expect(target).toEqual({ _platform: 'native', uri: 'content://stored/uri' });
		expect(mockPlugin.pickDirectory).not.toHaveBeenCalled();
	});

	it('opens picker when no stored directory exists', async () => {
		mockPlugin.getStoredDirectory.mockResolvedValueOnce({ uri: null });
		mockPlugin.pickDirectory.mockResolvedValueOnce({ uri: 'content://newly/picked' });

		const target = await pickVaultTarget('test-mod');

		expect(target).toEqual({ _platform: 'native', uri: 'content://newly/picked' });
		expect(mockPlugin.pickDirectory).toHaveBeenCalled();
	});

	it('checks stored directory before opening picker', async () => {
		mockPlugin.getStoredDirectory.mockResolvedValueOnce({ uri: 'content://existing' });

		await pickVaultTarget('any-mod');

		expect(mockPlugin.getStoredDirectory).toHaveBeenCalledOnce();
		expect(mockPlugin.pickDirectory).not.toHaveBeenCalled();
	});
});

describe('writeVaultNative', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('calls writeFile for each file with correct path and base64 data', async () => {
		const files: ExtractedFile[] = [
			{ path: 'README.md', data: new TextEncoder().encode('# Hello') },
			{ path: 'ebr-mod.json', data: new TextEncoder().encode('{}') },
		];

		await writeVaultNative(files);

		// 3 calls: .nomedia + 2 content files
		expect(mockPlugin.writeFile).toHaveBeenCalledTimes(3);
		expect(mockPlugin.writeFile).toHaveBeenCalledWith({
			path: '.nomedia',
			data: '',
		});
		expect(mockPlugin.writeFile).toHaveBeenCalledWith({
			path: 'README.md',
			data: btoa('# Hello'),
		});
		expect(mockPlugin.writeFile).toHaveBeenCalledWith({
			path: 'ebr-mod.json',
			data: btoa('{}'),
		});
	});

	it('passes nested paths directly to the plugin', async () => {
		const files: ExtractedFile[] = [
			{ path: '.obsidian/snippets/theme.css', data: new TextEncoder().encode('.x {}') },
		];

		await writeVaultNative(files);

		expect(mockPlugin.writeFile).toHaveBeenCalledWith({
			path: '.obsidian/snippets/theme.css',
			data: btoa('.x {}'),
		});
	});

	it('writes .nomedia before content files', async () => {
		const files: ExtractedFile[] = [
			{ path: 'cover.png', data: new Uint8Array([137, 80, 78, 71]) },
		];

		await writeVaultNative(files);

		const calls = mockPlugin.writeFile.mock.calls.map((c: any) => c[0].path);
		expect(calls[0]).toBe('.nomedia');
		expect(calls[1]).toBe('cover.png');
	});

	it('reports progress via callback', async () => {
		const files: ExtractedFile[] = [
			{ path: 'a.md', data: new TextEncoder().encode('a') },
			{ path: 'b.md', data: new TextEncoder().encode('b') },
			{ path: 'c.md', data: new TextEncoder().encode('c') },
		];

		const progressCalls: [number, number][] = [];
		await writeVaultNative(files, {
			onProgress: (written, total) => progressCalls.push([written, total]),
		});

		expect(progressCalls).toEqual([
			[1, 3],
			[2, 3],
			[3, 3],
		]);
	});

	it('converts file data to base64 for the native bridge', async () => {
		const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
		const files: ExtractedFile[] = [{ path: 'test.txt', data }];

		await writeVaultNative(files);

		expect(mockPlugin.writeFile).toHaveBeenCalledWith({
			path: 'test.txt',
			data: btoa('Hello'),
		});
	});
});

describe('checkVaultNative', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns missing when plugin throws', async () => {
		mockPlugin.listVaultContents.mockRejectedValueOnce(new Error('not found'));
		await expect(checkVaultNative()).resolves.toBe('missing');
	});

	it('returns empty when directory has no entries', async () => {
		mockPlugin.listVaultContents.mockResolvedValueOnce({ entries: [] });
		await expect(checkVaultNative()).resolves.toBe('empty');
	});

	it('returns existing-vault when both markers are present', async () => {
		mockPlugin.listVaultContents.mockResolvedValueOnce({
			entries: [
				{ name: 'ebr-mod.json', isDirectory: false },
				{ name: '.obsidian', isDirectory: true },
			],
		});
		await expect(checkVaultNative()).resolves.toBe('existing-vault');
	});

	it('returns unrecognized when only one marker is present', async () => {
		mockPlugin.listVaultContents.mockResolvedValueOnce({
			entries: [{ name: 'ebr-mod.json', isDirectory: false }],
		});
		await expect(checkVaultNative()).resolves.toBe('unrecognized');
	});

	it('returns unrecognized when folder has non-marker files', async () => {
		mockPlugin.listVaultContents.mockResolvedValueOnce({
			entries: [
				{ name: 'personal-diary.md', isDirectory: false },
				{ name: 'projects', isDirectory: true },
			],
		});
		await expect(checkVaultNative()).resolves.toBe('unrecognized');
	});

	it('does not match ebr-mod.json as a directory', async () => {
		mockPlugin.listVaultContents.mockResolvedValueOnce({
			entries: [
				{ name: 'ebr-mod.json', isDirectory: true },
				{ name: '.obsidian', isDirectory: true },
			],
		});
		await expect(checkVaultNative()).resolves.toBe('unrecognized');
	});

	it('does not match .obsidian as a file', async () => {
		mockPlugin.listVaultContents.mockResolvedValueOnce({
			entries: [
				{ name: 'ebr-mod.json', isDirectory: false },
				{ name: '.obsidian', isDirectory: false },
			],
		});
		await expect(checkVaultNative()).resolves.toBe('unrecognized');
	});
});

describe('clearVaultNative', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('calls clearVaultContents on the plugin', async () => {
		await clearVaultNative();
		expect(mockPlugin.clearVaultContents).toHaveBeenCalledOnce();
	});

	it('does not throw when clearVaultContents fails', async () => {
		mockPlugin.clearVaultContents.mockRejectedValueOnce(new Error('fail'));
		await expect(clearVaultNative()).resolves.toBeUndefined();
	});
});

describe('uint8ArrayToBase64', () => {
	it('converts ASCII bytes to base64', () => {
		const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
		expect(uint8ArrayToBase64(bytes)).toBe(btoa('Hello'));
	});

	it('handles empty arrays', () => {
		expect(uint8ArrayToBase64(new Uint8Array([]))).toBe('');
	});

	it('handles binary data with high bytes', () => {
		const bytes = new Uint8Array([0, 128, 255]);
		const result = uint8ArrayToBase64(bytes);
		expect(result).toBe(btoa('\x00\x80\xFF'));
	});
});
