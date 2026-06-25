import { unzipSync, zipSync } from 'fflate';
import {
	PathTraversalError,
	ZipHashMismatchError,
} from './errors.js';
import { injectReadOnlyView } from './obsidian-plugins.js';

/**
 * File extensions allowed in extracted mod content.
 * Everything else is silently dropped.
 */
export const ALLOWED_EXTENSIONS = new Set([
	'.md',
	'.css',
	'.json',
	'.png',
	'.jpg',
	'.jpeg',
	'.gif',
	'.webp',
	'.svg',
	'.txt',
	'.pdf',
]);

/**
 * Path prefixes blocked from extraction.
 * Matched after normalizing to forward slashes and lowercasing.
 */
const BLOCKED_PREFIXES = ['.obsidian/plugins/', '.obsidian/community-plugins.json', '.github/'];

/** A single extracted file ready for vault writing. */
export interface ExtractedFile {
	path: string;
	data: Uint8Array;
}

export interface ExtractOptions {
	/** Expected git commit hash. If provided, the zip top-level directory is verified against it. */
	expectedCommitHash?: string;
}

/**
 * Extract a GitHub zip archive into a flat list of files with security checks:
 * - Path traversal protection (no ../ or absolute paths)
 * - File extension allowlist
 * - .obsidian/plugins/ blocklist
 * - Optional commit hash verification
 *
 * GitHub zips contain a top-level directory (e.g. "owner-repo-hash/").
 * This function strips that prefix so paths are relative to the vault root.
 */
export function extractModZip(zipBuffer: ArrayBuffer, options?: ExtractOptions): ExtractedFile[] {
	const zipData = new Uint8Array(zipBuffer);
	const entries = unzipSync(zipData);
	const files: ExtractedFile[] = [];

	// Detect the common top-level directory prefix from GitHub's zip format.
	// All entries in a GitHub zipball start with "owner-repo-commitsha/".
	const paths = Object.keys(entries);
	const topLevelPrefix = detectTopLevelPrefix(paths);

	// Verify the zip came from the expected commit
	if (options?.expectedCommitHash) {
		if (!topLevelPrefix) {
			// No top-level directory detected - cannot verify origin. Fail closed.
			throw new ZipHashMismatchError(options.expectedCommitHash, '(no prefix)');
		}
		verifyZipCommitHash(topLevelPrefix, options.expectedCommitHash);
	}

	for (const [rawPath, data] of Object.entries(entries)) {
		// Skip directories (they have zero-length data and trailing slash)
		if (rawPath.endsWith('/')) continue;

		// Strip the GitHub top-level directory prefix
		let filePath = topLevelPrefix ? rawPath.slice(topLevelPrefix.length) : rawPath;

		// Normalize to forward slashes
		filePath = filePath.replace(/\\/g, '/');

		// Security: reject path traversal
		assertNoPathTraversal(filePath);

		// Security: silently drop blocked paths (.obsidian/plugins/, community-plugins.json)
		if (isBlocked(filePath)) continue;

		// Security: only allow known file extensions
		if (!hasAllowedExtension(filePath)) continue;

		files.push({ path: filePath, data });
	}

	return files;
}

/**
 * Detect the common top-level directory prefix in a GitHub zipball.
 * Returns the prefix including trailing slash, or empty string if none found.
 */
export function detectTopLevelPrefix(paths: string[]): string {
	if (paths.length === 0) return '';

	// Find the first path and extract its top-level directory
	const first = paths[0];
	const slashIndex = first.indexOf('/');
	if (slashIndex === -1) return '';

	const prefix = first.slice(0, slashIndex + 1);

	// Verify all paths share this prefix
	const allMatch = paths.every((p) => p.startsWith(prefix));
	return allMatch ? prefix : '';
}

/**
 * Assert a file path does not escape the extraction root.
 * Rejects: absolute paths, ".." segments, backslash paths, null bytes.
 */
export function assertNoPathTraversal(filePath: string): void {
	// Reject null bytes (can bypass C-level path checks)
	if (filePath.includes('\0')) {
		throw new PathTraversalError(filePath);
	}

	// Reject absolute paths
	if (filePath.startsWith('/') || /^[A-Za-z]:/.test(filePath)) {
		throw new PathTraversalError(filePath);
	}

	// Reject any ".." path segment
	const segments = filePath.split('/');
	for (const segment of segments) {
		if (segment === '..') {
			throw new PathTraversalError(filePath);
		}
	}

	// Reject backslashes (already normalized above, but defense-in-depth)
	if (filePath.includes('\\')) {
		throw new PathTraversalError(filePath);
	}
}

/**
 * Check whether a file path is in the blocked list.
 * Blocks .obsidian/plugins/ and .obsidian/community-plugins.json.
 * Returns true if the path should be silently dropped.
 */
export function isBlocked(filePath: string): boolean {
	const normalized = filePath.toLowerCase();
	for (const prefix of BLOCKED_PREFIXES) {
		if (normalized === prefix || normalized.startsWith(prefix)) {
			return true;
		}
	}
	return false;
}

/**
 * Check whether a file path has an allowed extension.
 * Returns false for files that should be silently dropped.
 */
export function hasAllowedExtension(filePath: string): boolean {
	const lastDot = filePath.lastIndexOf('.');
	if (lastDot === -1) return false;
	const ext = filePath.slice(lastDot).toLowerCase();
	return ALLOWED_EXTENSIONS.has(ext);
}

/**
 * Verify a GitHub zip's top-level directory contains the expected commit hash.
 * GitHub zipballs use a directory named "owner-repo-shortcommithash/".
 * The short hash is always 7 lowercase hex characters.
 * Throws ZipHashMismatchError if the hash doesn't match.
 */
export function verifyZipCommitHash(topLevelPrefix: string, expectedCommitHash: string): void {
	// Strip trailing slash from the prefix
	const dirName = topLevelPrefix.replace(/\/$/, '');

	// GitHub uses the first 7+ characters of the commit hash as the suffix.
	// The directory name format is: "owner-repo-shortcommithash"
	// Extract the last segment after the final hyphen.
	const lastHyphen = dirName.lastIndexOf('-');
	if (lastHyphen === -1) {
		throw new ZipHashMismatchError(expectedCommitHash, dirName);
	}

	const zipShortHash = dirName.slice(lastHyphen + 1).toLowerCase();

	// Reject empty suffix (trailing hyphen in directory name)
	if (!zipShortHash) {
		throw new ZipHashMismatchError(expectedCommitHash, '');
	}

	const expectedLower = expectedCommitHash.toLowerCase();

	// The expected full hash must start with the short hash from the zip.
	// This is a strict one-directional prefix check.
	if (!expectedLower.startsWith(zipShortHash)) {
		throw new ZipHashMismatchError(expectedCommitHash, zipShortHash);
	}
}

/**
 * Extract a zip, apply all security filters, inject the trusted read-only
 * plugin, and re-zip the result. Used for the fallback browser download on
 * unsupported browsers so users never receive executables, smuggled plugins,
 * or other blocked content, and so the downloaded vault opens read-only in
 * Obsidian - the same vault the directory-write path produces. Injection runs
 * after the security strip; see `injectReadOnlyView` in obsidian-plugins.ts.
 */
export function repackageModZip(zipBuffer: ArrayBuffer, options?: ExtractOptions): Uint8Array {
	const files = injectReadOnlyView(extractModZip(zipBuffer, options));
	const entries: Record<string, Uint8Array> = {};
	for (const file of files) {
		entries[file.path] = file.data;
	}
	return zipSync(entries);
}

// --- Async worker-backed versions (keep zip work off the main thread) ---

import type { WorkerResponse } from './extraction.worker.js';

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (value: any) => void; reject: (reason: any) => void }>();

function getWorker(): Worker {
	if (!worker) {
		worker = new Worker(new URL('./extraction.worker.ts', import.meta.url), { type: 'module' });
		worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
			const msg = e.data;
			const entry = pending.get(msg.id);
			if (!entry) return;
			pending.delete(msg.id);

			if (msg.type === 'error') {
				let err: Error;
				if (msg.errorName === 'PathTraversalError') {
					err = new PathTraversalError(msg.filePath ?? msg.message);
				} else if (msg.errorName === 'ZipHashMismatchError') {
					err = new ZipHashMismatchError(msg.expectedHash ?? '', msg.actualHash ?? '');
				} else {
					err = new Error(msg.message);
				}
				entry.reject(err);
			} else {
				entry.resolve(msg);
			}
		};
	}
	return worker;
}

function call(type: 'extract' | 'repackage', zipBuffer: ArrayBuffer, options?: { expectedCommitHash?: string }): Promise<WorkerResponse> {
	return new Promise((resolve, reject) => {
		const id = nextId++;
		pending.set(id, { resolve, reject });
		getWorker().postMessage({ id, type, zipBuffer, expectedCommitHash: options?.expectedCommitHash }, [zipBuffer]);
	});
}

/** Extract mod zip off the main thread. */
export async function extractModZipAsync(zipBuffer: ArrayBuffer, options?: ExtractOptions): Promise<ExtractedFile[]> {
	const result = await call('extract', zipBuffer, { expectedCommitHash: options?.expectedCommitHash });
	if (result.type !== 'extract') throw new Error('Unexpected worker response');
	return result.files;
}

/** Repackage mod zip off the main thread. */
export async function repackageModZipAsync(zipBuffer: ArrayBuffer, options?: ExtractOptions): Promise<Uint8Array> {
	const result = await call('repackage', zipBuffer, { expectedCommitHash: options?.expectedCommitHash });
	if (result.type !== 'repackage') throw new Error('Unexpected worker response');
	return result.cleanZip;
}
