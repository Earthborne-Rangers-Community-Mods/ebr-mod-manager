import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import type { ExtractedFile } from './extraction.js';

// --- Unified vault types ---

/**
 * Opaque handle returned by pickVaultTarget(). Callers pass this to
 * checkVault / clearVault / writeVaultFiles without inspecting its contents.
 * Internally wraps either a native modId or a browser FileSystemDirectoryHandle.
 */
export type VaultTarget =
	| { readonly _platform: 'native'; readonly modId: string }
	| { readonly _platform: 'browser'; readonly handle: FileSystemDirectoryHandle };

/** Result of checking a vault target before writing. */
export type VaultCheckResult = 'empty' | 'existing-vault' | 'unrecognized' | 'missing';

/** How this platform installs mods. */
export type InstallMethod = 'vault-write' | 'zip-download';

/** Stored state about the currently installed mod. */
export interface InstalledMod {
	id: string;
	name: string;
	version: string;
	commitHash: string;
}

// --- Platform detection ---

/** Determine how this platform should install mods. */
export function getInstallMethod(): InstallMethod {
	if (Capacitor.isNativePlatform()) return 'vault-write';
	if (isFileSystemAccessSupported()) return 'vault-write';
	return 'zip-download';
}

// --- Unified vault operations ---

/**
 * Open a directory picker appropriate for the current platform.
 * On native: currently returns a Documents-based target for the given modId.
 * Will be replaced with @capawesome/capacitor-file-picker once integrated.
 * On browser: opens showDirectoryPicker().
 * Returns an opaque VaultTarget to pass to subsequent vault operations.
 */
export async function pickVaultTarget(modId: string): Promise<VaultTarget> {
	if (Capacitor.isNativePlatform()) {
		return { _platform: 'native', modId };
	}
	const handle = await window.showDirectoryPicker({
		id: 'ebr-vault',
		mode: 'readwrite',
		startIn: 'documents',
	});
	return { _platform: 'browser', handle };
}

/** Check what a vault target contains before writing. */
export async function checkVault(target: VaultTarget): Promise<VaultCheckResult> {
	if (target._platform === 'native') return checkVaultNative(target.modId);
	return checkVaultBrowser(target.handle);
}

/** Remove all contents from a vault target. */
export async function clearVault(target: VaultTarget): Promise<void> {
	if (target._platform === 'native') return clearVaultNative(target.modId);
	return clearVaultBrowser(target.handle);
}

/** Write extracted mod files to a vault target. */
export async function writeVaultFiles(
	target: VaultTarget,
	files: ExtractedFile[],
	options?: { onProgress?: (written: number, total: number) => void },
): Promise<void> {
	if (target._platform === 'native') return writeVaultNative(target.modId, files, options);
	return writeVaultBrowser(target.handle, files, options);
}

// --- Native (Capacitor) implementation ---

/**
 * Base directory for mod vaults in shared Documents storage.
 * Files go to: Documents/EBR Mod Manager/<modId>/...
 * This location is accessible to other apps like Obsidian.
 */
const VAULTS_ROOT = 'EBR Mod Manager';

/** Write extracted mod files to shared Documents storage via @capacitor/filesystem. */
export async function writeVaultNative(
	modId: string,
	files: ExtractedFile[],
	options?: { onProgress?: (written: number, total: number) => void },
): Promise<void> {
	const total = files.length;
	let written = 0;
	const basePath = `${VAULTS_ROOT}/${modId}`;

	// Ensure base directory exists
	await mkdirRecursive(basePath);

	// Collect unique subdirectories and create them
	const dirs = new Set<string>();
	for (const file of files) {
		const lastSlash = file.path.lastIndexOf('/');
		if (lastSlash !== -1) {
			dirs.add(file.path.slice(0, lastSlash));
		}
	}
	for (const dir of dirs) {
		await mkdirRecursive(`${basePath}/${dir}`);
	}

	// Write files with limited concurrency
	const CONCURRENCY = 6;
	for (let i = 0; i < files.length; i += CONCURRENCY) {
		const batch = files.slice(i, i + CONCURRENCY);
		await Promise.all(batch.map(async (file) => {
			const filePath = `${basePath}/${file.path}`;
			const base64 = uint8ArrayToBase64(file.data);

			await Filesystem.writeFile({
				path: filePath,
				data: base64,
				directory: Directory.Documents,
				recursive: true,
			});

			written++;
			options?.onProgress?.(written, total);
		}));
	}
}

/** Check if a mod vault directory exists and contains expected markers. */
export async function checkVaultNative(
	modId: string,
): Promise<VaultCheckResult> {
	const basePath = `${VAULTS_ROOT}/${modId}`;
	try {
		const result = await Filesystem.readdir({
			path: basePath,
			directory: Directory.Documents,
		});

		if (result.files.length === 0) return 'empty';

		const names = result.files.map((f) => f.name);
		const hasModJson = names.includes('ebr-mod.json');
		const hasObsidian = names.includes('.obsidian');
		if (hasModJson && hasObsidian) return 'existing-vault';
		return 'unrecognized';
	} catch {
		return 'missing';
	}
}

/** Remove a mod vault directory and all its contents. */
export async function clearVaultNative(modId: string): Promise<void> {
	const basePath = `${VAULTS_ROOT}/${modId}`;
	try {
		await Filesystem.rmdir({
			path: basePath,
			directory: Directory.Documents,
			recursive: true,
		});
	} catch {
		// Directory may not exist yet
	}
}

/** Get the native file URI for a mod vault directory. */
export async function getVaultUri(modId: string): Promise<string> {
	const result = await Filesystem.getUri({
		path: `${VAULTS_ROOT}/${modId}`,
		directory: Directory.Documents,
	});
	return result.uri;
}

async function mkdirRecursive(path: string): Promise<void> {
	try {
		await Filesystem.mkdir({
			path,
			directory: Directory.Documents,
			recursive: true,
		});
	} catch {
		// Directory may already exist
	}
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

// --- Browser (File System Access API) implementation ---

/**
 * Check what a directory contains before writing a vault into it.
 * Returns 'empty' if the directory has no entries, 'existing-vault' if it
 * contains both ebr-mod.json and an .obsidian directory (the two markers
 * of an EBR Obsidian vault), or 'unrecognized' otherwise.
 */
export async function checkVaultBrowser(
	dirHandle: FileSystemDirectoryHandle,
): Promise<VaultCheckResult> {
	let hasEntries = false;
	let hasModJson = false;
	let hasObsidian = false;

	for await (const entry of dirHandle.values()) {
		hasEntries = true;
		if (entry.kind === 'file' && entry.name === 'ebr-mod.json') {
			hasModJson = true;
		}
		if (entry.kind === 'directory' && entry.name === '.obsidian') {
			hasObsidian = true;
		}
		if (hasModJson && hasObsidian) break;
	}

	if (!hasEntries) return 'empty';
	return hasModJson && hasObsidian ? 'existing-vault' : 'unrecognized';
}

/**
 * Write extracted mod files to a vault directory via the File System Access API.
 * Creates subdirectories as needed. Uses a directory handle cache and concurrent
 * writes to minimize round-trips to the file system.
 */
export async function writeVaultBrowser(
	dirHandle: FileSystemDirectoryHandle,
	files: ExtractedFile[],
	options?: { onProgress?: (written: number, total: number) => void },
): Promise<void> {
	const total = files.length;
	let written = 0;

	// Cache resolved directory handles to avoid repeated navigation from root
	const dirCache = new Map<string, FileSystemDirectoryHandle>();
	dirCache.set('', dirHandle);

	async function getDir(dirPath: string): Promise<FileSystemDirectoryHandle> {
		const cached = dirCache.get(dirPath);
		if (cached) return cached;

		const segments = dirPath.split('/');
		// Find the longest cached prefix, then create from there
		let current = dirHandle;
		let resolvedPath = '';
		for (const seg of segments) {
			resolvedPath = resolvedPath ? `${resolvedPath}/${seg}` : seg;
			const existing = dirCache.get(resolvedPath);
			if (existing) {
				current = existing;
			} else {
				current = await current.getDirectoryHandle(seg, { create: true });
				dirCache.set(resolvedPath, current);
			}
		}
		return current;
	}

	async function writeFile(file: ExtractedFile): Promise<void> {
		const lastSlash = file.path.lastIndexOf('/');
		const dirPath = lastSlash === -1 ? '' : file.path.slice(0, lastSlash);
		const fileName = lastSlash === -1 ? file.path : file.path.slice(lastSlash + 1);

		const parent = await getDir(dirPath);
		const fileHandle = await parent.getFileHandle(fileName, { create: true });
		const writable = await fileHandle.createWritable();
		await writable.write(file.data);
		await writable.close();

		written++;
		options?.onProgress?.(written, total);
	}

	// Write files with limited concurrency
	const CONCURRENCY = 6;
	for (let i = 0; i < files.length; i += CONCURRENCY) {
		const batch = files.slice(i, i + CONCURRENCY);
		await Promise.all(batch.map(writeFile));
	}
}

/**
 * Clear all contents of a directory handle (for replacing vault contents).
 * Uses the removeEntry method if available, otherwise skips (the write will overwrite).
 */
export async function clearVaultBrowser(dirHandle: FileSystemDirectoryHandle): Promise<void> {
	const entries: string[] = [];
	for await (const entry of dirHandle.values()) {
		entries.push(entry.name);
	}
	for (const name of entries) {
		try {
			// removeEntry is part of the File System Access API but not in all type defs
			await (dirHandle as any).removeEntry(name, { recursive: true });
		} catch {
			// If removeEntry is not supported, we'll overwrite in place
		}
	}
}

function isFileSystemAccessSupported(): boolean {
	return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// --- localStorage tracking of installed mod ---

const INSTALLED_MOD_KEY = 'ebr-installed-mod';

export function getInstalledMod(): InstalledMod | null {
	try {
		const raw = localStorage.getItem(INSTALLED_MOD_KEY);
		if (!raw) return null;
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

export function setInstalledMod(mod: InstalledMod): void {
	localStorage.setItem(INSTALLED_MOD_KEY, JSON.stringify(mod));
}

export function clearInstalledMod(): void {
	localStorage.removeItem(INSTALLED_MOD_KEY);
}
