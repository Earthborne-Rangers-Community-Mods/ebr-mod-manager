import { Capacitor } from '@capacitor/core';
import EbrVaultPlugin from './ebr-vault-plugin.js';
import type { ExtractedFile } from './extraction.js';
import { VaultDirectoryMissingError } from './errors.js';

// --- Unified vault types ---

/**
 * Opaque handle returned by pickVaultTarget(). Callers pass this to
 * checkVault / clearVault / writeVaultFiles without inspecting its contents.
 * Internally wraps either a native modId or a browser FileSystemDirectoryHandle.
 */
export type VaultTarget =
	| { readonly _platform: 'native'; readonly uri: string; readonly folderName: string | null }
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

/**
 * Detect Android browser (not inside the Capacitor native app).
 * Android Chrome reports File System Access API support but has a Chromium
 * bug that breaks createWritable() for typical EBR mod path lengths.
 * Used by the UI to block the install button on Android browser.
 */
export function isAndroidBrowser(): boolean {
	if (Capacitor.isNativePlatform()) return false;
	if (typeof navigator === 'undefined') return false;
	return /Android/i.test(navigator.userAgent);
}

// --- Unified vault operations ---

/**
 * Open a directory picker appropriate for the current platform.
 * On native: checks for a stored directory from a previous session, then
 * opens the system directory picker (SAF on Android) if none is stored.
 * On browser: opens showDirectoryPicker().
 * Returns an opaque VaultTarget to pass to subsequent vault operations.
 */
export async function pickVaultTarget(modId: string): Promise<VaultTarget> {
	if (Capacitor.isNativePlatform()) {
		const stored = await EbrVaultPlugin.getStoredDirectory();
		if (stored.uri) {
			return { _platform: 'native', uri: stored.uri, folderName: stored.name };
		}
		const picked = await EbrVaultPlugin.pickDirectory();
		return { _platform: 'native', uri: picked.uri, folderName: picked.name };
	}
	const handle = await window.showDirectoryPicker({
		id: 'ebr-vault',
		mode: 'readwrite',
		startIn: 'documents',
	});
	return { _platform: 'browser', handle };
}

/**
 * Open the directory picker.
 * Used when the user explicitly wants to change their vault folder.
 */
export async function changeVaultTarget(): Promise<VaultTarget> {
	if (Capacitor.isNativePlatform()) {
		const picked = await EbrVaultPlugin.pickDirectory();
		return { _platform: 'native', uri: picked.uri, folderName: picked.name };
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
	if (target._platform === 'native') return checkVaultNative();
	return checkVaultBrowser(target.handle);
}

/** Get the user-visible folder name from a vault target. */
export function getVaultFolderName(target: VaultTarget): string | null {
	if (target._platform === 'native') return target.folderName;
	return target.handle.name;
}

/** Get the stored vault folder name. Returns null if none stored. */
export async function getStoredVaultFolderName(): Promise<string | null> {
	if (!Capacitor.isNativePlatform()) return null;
	const stored = await EbrVaultPlugin.getStoredDirectory();
	return stored.uri ? stored.name : null;
}

/** Remove all contents from a vault target. */
export async function clearVault(
	target: VaultTarget,
	options?: { onProgress?: (deleted: number, total: number) => void },
): Promise<void> {
	if (target._platform === 'native') return clearVaultNative(options);
	return clearVaultBrowser(target.handle, options);
}

/** Write extracted mod files to a vault target. */
export async function writeVaultFiles(
	target: VaultTarget,
	files: ExtractedFile[],
	options?: { onProgress?: (written: number, total: number) => void },
): Promise<void> {
	if (target._platform === 'native') return writeVaultNative(files, options);
	return writeVaultBrowser(target.handle, files, options);
}

/**
 * Reorder files so vault markers (ebr-mod.json and .obsidian/ contents) are
 * written first. This ensures that if a write is interrupted, the directory is
 * still recognized as a vault by the safety check on the next attempt.
 */
function vaultMarkersFirst(files: ExtractedFile[]): ExtractedFile[] {
	const markers: ExtractedFile[] = [];
	const rest: ExtractedFile[] = [];
	for (const file of files) {
		if (file.path === 'ebr-mod.json' || file.path.startsWith('.obsidian/')) {
			markers.push(file);
		} else {
			rest.push(file);
		}
	}
	return [...markers, ...rest];
}

// --- Native (Capacitor) implementation via ebr-vault-plugin ---

/** Wrap "Directory not found" plugin errors as VaultDirectoryMissingError; rethrow all others. */
function wrapDirectoryMissingError(err: unknown): never {
	if (err instanceof Error && err.message.includes('Directory not found')) {
		throw new VaultDirectoryMissingError();
	}
	throw err;
}

/** Write extracted mod files to the user-chosen directory via the native plugin. */
export async function writeVaultNative(
	files: ExtractedFile[],
	options?: { onProgress?: (written: number, total: number) => void },
): Promise<void> {
	const ordered = vaultMarkersFirst(files);
	const total = ordered.length;
	let written = 0;

	try {
		// Prevent Android media scanner from indexing vault images
		await EbrVaultPlugin.writeFile({ path: '.nomedia', data: '' });
	} catch (err) {
		wrapDirectoryMissingError(err);
	}

	// Write files with limited concurrency
	const CONCURRENCY = 6;
	for (let i = 0; i < ordered.length; i += CONCURRENCY) {
		const batch = ordered.slice(i, i + CONCURRENCY);
		await Promise.all(batch.map(async (file) => {
			const base64 = uint8ArrayToBase64(file.data);
			await EbrVaultPlugin.writeFile({ path: file.path, data: base64 });

			written++;
			options?.onProgress?.(written, total);
		}));
	}
}

/** Check if the user-chosen directory contains expected vault markers. */
export async function checkVaultNative(): Promise<VaultCheckResult> {
	try {
		const result = await EbrVaultPlugin.listVaultContents();

		if (result.entries.length === 0) return 'empty';

		const hasModJson = result.entries.some((e) => e.name === 'ebr-mod.json' && !e.isDirectory);
		const hasObsidian = result.entries.some((e) => e.name === '.obsidian' && e.isDirectory);
		if (hasModJson && hasObsidian) return 'existing-vault';
		return 'unrecognized';
	} catch {
		return 'missing';
	}
}

/** Remove all contents from the user-chosen directory. */
export async function clearVaultNative(
	options?: { onProgress?: (deleted: number, total: number) => void },
): Promise<void> {
	let listener: { remove: () => Promise<void> } | undefined;
	try {
		if (options?.onProgress) {
			listener = await EbrVaultPlugin.addListener('clearProgress', (data) => {
				options.onProgress!(data.deleted, data.total);
			});
		}
		await EbrVaultPlugin.clearVaultContents();
	} catch (err) {
		wrapDirectoryMissingError(err);
	} finally {
		await listener?.remove();
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
	const ordered = vaultMarkersFirst(files);
	const total = ordered.length;
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
	for (let i = 0; i < ordered.length; i += CONCURRENCY) {
		const batch = ordered.slice(i, i + CONCURRENCY);
		await Promise.all(batch.map(writeFile));
	}
}

/**
 * Clear all contents of a directory handle (for replacing vault contents).
 * Uses the removeEntry method if available, otherwise skips (the write will overwrite).
 */
export async function clearVaultBrowser(
	dirHandle: FileSystemDirectoryHandle,
	options?: { onProgress?: (deleted: number, total: number) => void },
): Promise<void> {
	const entries: string[] = [];
	for await (const entry of dirHandle.values()) {
		entries.push(entry.name);
	}
	const total = entries.length;
	let deleted = 0;
	for (const name of entries) {
		try {
			// removeEntry is part of the File System Access API but not in all type defs
			await (dirHandle as any).removeEntry(name, { recursive: true });
		} catch {
			// If removeEntry is not supported, we'll overwrite in place
		}
		deleted++;
		options?.onProgress?.(deleted, total);
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
