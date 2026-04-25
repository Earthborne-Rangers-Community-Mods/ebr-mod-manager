import type { ExtractedFile } from './extraction.js';

/** Stored state about the currently installed mod. */
export interface InstalledMod {
	id: string;
	name: string;
	version: string;
	commitHash: string;
}

/** Result of checking a directory before vault writing. */
export type VaultCheckResult = 'empty' | 'existing-vault' | 'unrecognized';

/**
 * Check what a directory contains before writing a vault into it.
 * Returns 'empty' if the directory has no entries, 'existing-vault' if it
 * contains both ebr-mod.json and an .obsidian directory (the two markers
 * of an EBR Obsidian vault), or 'unrecognized' otherwise.
 */
export async function checkVaultDirectory(
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
export async function writeVault(
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
export async function clearDirectory(dirHandle: FileSystemDirectoryHandle): Promise<void> {
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

/** Check if File System Access API is available in this browser. */
export function isFileSystemAccessSupported(): boolean {
	return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

/** Prompt the user to pick a vault directory. */
export async function pickVaultDirectory(): Promise<FileSystemDirectoryHandle> {
	return window.showDirectoryPicker({
		id: 'ebr-vault',
		mode: 'readwrite',
		startIn: 'documents',
	});
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
