// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	checkVaultBrowser,
	writeVaultBrowser,
	getInstallMethod,
	getInstalledMod,
	setInstalledMod,
	clearInstalledMod,
	uint8ArrayToBase64,
} from '$lib/vault.js';
import type { ExtractedFile } from '$lib/extraction.js';

// --- Mock @capacitor/core ---

vi.mock('@capacitor/core', () => ({
	Capacitor: { isNativePlatform: () => false },
}));

// --- Mock @capacitor/filesystem ---

const mockFilesystem = vi.hoisted(() => ({
	writeFile: vi.fn(async () => ({})),
	mkdir: vi.fn(async () => ({})),
	readdir: vi.fn(async () => ({ files: [] })),
	rmdir: vi.fn(async () => ({})),
	getUri: vi.fn(async () => ({ uri: 'file:///mock/path' })),
}));

vi.mock('@capacitor/filesystem', () => ({
	Filesystem: mockFilesystem,
	Directory: { Documents: 'DOCUMENTS' },
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
	it('returns vault-write when showDirectoryPicker is available', () => {
		(window as any).showDirectoryPicker = vi.fn();
		expect(getInstallMethod()).toBe('vault-write');
	});

	it('returns zip-download when showDirectoryPicker is not available', () => {
		delete (window as any).showDirectoryPicker;
		expect(getInstallMethod()).toBe('zip-download');
	});
});

// --- Capacitor vault operations ---

describe('writeVaultNative', () => {
	let writeVaultNative: typeof import('$lib/vault.js').writeVaultNative;

	beforeEach(async () => {
		vi.clearAllMocks();
		const mod = await import('$lib/vault.js');
		writeVaultNative = mod.writeVaultNative;
	});

	it('writes files under the vault root directory', async () => {
		const files: ExtractedFile[] = [
			{ path: 'README.md', data: new TextEncoder().encode('# Hello') },
			{ path: 'ebr-mod.json', data: new TextEncoder().encode('{}') },
		];

		await writeVaultNative('test-mod', files);

		expect(mockFilesystem.mkdir).toHaveBeenCalledWith({
			path: 'EBR Mod Manager/test-mod',
			directory: 'DOCUMENTS',
			recursive: true,
		});

		expect(mockFilesystem.writeFile).toHaveBeenCalledTimes(2);
		expect(mockFilesystem.writeFile).toHaveBeenCalledWith(
			expect.objectContaining({
				path: 'EBR Mod Manager/test-mod/README.md',
				directory: 'DOCUMENTS',
				recursive: true,
			}),
		);
		expect(mockFilesystem.writeFile).toHaveBeenCalledWith(
			expect.objectContaining({
				path: 'EBR Mod Manager/test-mod/ebr-mod.json',
				directory: 'DOCUMENTS',
				recursive: true,
			}),
		);
	});

	it('creates subdirectories before writing nested files', async () => {
		const files: ExtractedFile[] = [
			{ path: '.obsidian/snippets/theme.css', data: new TextEncoder().encode('.x {}') },
		];

		await writeVaultNative('test-mod', files);

		expect(mockFilesystem.mkdir).toHaveBeenCalledWith({
			path: 'EBR Mod Manager/test-mod',
			directory: 'DOCUMENTS',
			recursive: true,
		});
		expect(mockFilesystem.mkdir).toHaveBeenCalledWith({
			path: 'EBR Mod Manager/test-mod/.obsidian/snippets',
			directory: 'DOCUMENTS',
			recursive: true,
		});
	});

	it('reports progress via callback', async () => {
		const files: ExtractedFile[] = [
			{ path: 'a.md', data: new TextEncoder().encode('a') },
			{ path: 'b.md', data: new TextEncoder().encode('b') },
			{ path: 'c.md', data: new TextEncoder().encode('c') },
		];

		const progressCalls: [number, number][] = [];
		await writeVaultNative('test-mod', files, {
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

		await writeVaultNative('test-mod', files);

		expect(mockFilesystem.writeFile).toHaveBeenCalledWith(
			expect.objectContaining({
				data: btoa('Hello'),
			}),
		);
	});
});

describe('checkVaultNative', () => {
	let checkVaultNative: typeof import('$lib/vault.js').checkVaultNative;

	beforeEach(async () => {
		vi.clearAllMocks();
		const mod = await import('$lib/vault.js');
		checkVaultNative = mod.checkVaultNative;
	});

	it('returns missing when directory does not exist', async () => {
		mockFilesystem.readdir.mockRejectedValueOnce(new Error('not found'));
		await expect(checkVaultNative('test-mod')).resolves.toBe('missing');
	});

	it('returns empty when directory has no files', async () => {
		mockFilesystem.readdir.mockResolvedValueOnce({ files: [] });
		await expect(checkVaultNative('test-mod')).resolves.toBe('empty');
	});

	it('returns existing-vault when both markers are present', async () => {
		mockFilesystem.readdir.mockResolvedValueOnce({
			files: [
				{ name: 'ebr-mod.json', type: 'file' },
				{ name: '.obsidian', type: 'directory' },
			],
		});
		await expect(checkVaultNative('test-mod')).resolves.toBe('existing-vault');
	});

	it('returns unrecognized when only one marker is present', async () => {
		mockFilesystem.readdir.mockResolvedValueOnce({
			files: [{ name: 'ebr-mod.json', type: 'file' }],
		});
		await expect(checkVaultNative('test-mod')).resolves.toBe('unrecognized');
	});

	it('returns unrecognized when folder has non-marker files', async () => {
		mockFilesystem.readdir.mockResolvedValueOnce({
			files: [
				{ name: 'personal-diary.md', type: 'file' },
				{ name: 'projects', type: 'directory' },
			],
		});
		await expect(checkVaultNative('test-mod')).resolves.toBe('unrecognized');
	});

	it('reads from the correct path', async () => {
		mockFilesystem.readdir.mockResolvedValueOnce({ files: [] });
		await checkVaultNative('my-mod');

		expect(mockFilesystem.readdir).toHaveBeenCalledWith({
			path: 'EBR Mod Manager/my-mod',
			directory: 'DOCUMENTS',
		});
	});
});

describe('clearVaultNative', () => {
	let clearVaultNative: typeof import('$lib/vault.js').clearVaultNative;

	beforeEach(async () => {
		vi.clearAllMocks();
		const mod = await import('$lib/vault.js');
		clearVaultNative = mod.clearVaultNative;
	});

	it('removes the vault directory recursively', async () => {
		await clearVaultNative('test-mod');

		expect(mockFilesystem.rmdir).toHaveBeenCalledWith({
			path: 'EBR Mod Manager/test-mod',
			directory: 'DOCUMENTS',
			recursive: true,
		});
	});

	it('does not throw when directory does not exist', async () => {
		mockFilesystem.rmdir.mockRejectedValueOnce(new Error('not found'));
		await expect(clearVaultNative('test-mod')).resolves.toBeUndefined();
	});
});

describe('getVaultUri', () => {
	let getVaultUri: typeof import('$lib/vault.js').getVaultUri;

	beforeEach(async () => {
		vi.clearAllMocks();
		const mod = await import('$lib/vault.js');
		getVaultUri = mod.getVaultUri;
	});

	it('returns the native file URI', async () => {
		mockFilesystem.getUri.mockResolvedValueOnce({
			uri: 'file:///storage/emulated/0/Documents/EBR%20Mod%20Manager/test-mod',
		});
		const uri = await getVaultUri('test-mod');
		expect(uri).toBe('file:///storage/emulated/0/Documents/EBR%20Mod%20Manager/test-mod');
	});

	it('queries the correct path', async () => {
		await getVaultUri('my-mod');
		expect(mockFilesystem.getUri).toHaveBeenCalledWith({
			path: 'EBR Mod Manager/my-mod',
			directory: 'DOCUMENTS',
		});
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
