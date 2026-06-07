import { Capacitor } from '@capacitor/core';
import { parseRepoUrl } from './registry.js';
import { ModDownloadError, NetworkError } from './errors.js';

export interface DownloadProgress {
	receivedBytes: number;
	totalBytes: number | null;
}

/**
 * Build the direct GitHub API URL for downloading a repo zip at a specific commit.
 * Not usable from the browser due to CORS - use modZipProxyUrl instead.
 */
export function modZipUrl(mod: { repoUrl: string; commitHash: string }): string {
	const { owner, repo } = parseRepoUrl(mod.repoUrl);
	return `https://api.github.com/repos/${owner}/${repo}/zipball/${mod.commitHash}`;
}

/** Build a proxy-friendly URL for downloading a mod zip.
 * In production, VITE_GITHUB_PROXY_URL is set to the Cloudflare Worker base URL.
 * In development, falls back to /github-api which the Vite dev proxy handles. */
export function modZipProxyUrl(mod: { repoUrl: string; commitHash: string }): string {
	const { owner, repo } = parseRepoUrl(mod.repoUrl);
	const base = import.meta.env.VITE_GITHUB_PROXY_URL ?? '/github-api';
	return `${base}/repos/${owner}/${repo}/zipball/${mod.commitHash}`;
}

/** Download a mod's content as a zip ArrayBuffer. */
export async function downloadModZip(
	mod: { repoUrl: string; commitHash: string },
	options?: {
		token?: string;
		onProgress?: (progress: DownloadProgress) => void;
		signal?: AbortSignal;
	},
): Promise<ArrayBuffer> {
	const url = Capacitor.isNativePlatform() ? modZipUrl(mod) : modZipProxyUrl(mod);
	const headers: Record<string, string> = {
		Accept: 'application/vnd.github+json',
	};
	if (options?.token) {
		headers['Authorization'] = `Bearer ${options.token}`;
	}

	const fetchOptions: RequestInit = { headers };
	if (options?.signal) {
		fetchOptions.signal = options.signal;
	}

	let response: Response;
	try {
		response = await fetch(url, fetchOptions);
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') {
			throw err; // Re-throw user-initiated abort as-is
		}
		throw new NetworkError(`Network error downloading mod: ${url}`, err);
	}

	if (!response.ok) {
		throw new ModDownloadError(mod.commitHash, url, response.status, response.statusText);
	}

	try {
		if (options?.onProgress && response.body) {
			return await streamWithProgress(response, options.onProgress);
		}
		return await response.arrayBuffer();
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') {
			throw err;
		}
		// Stream read failure mid-download is a network error
		throw new NetworkError(`Connection lost while downloading mod: ${url}`, err);
	}
}

async function streamWithProgress(
	response: Response,
	onProgress: (progress: DownloadProgress) => void,
): Promise<ArrayBuffer> {
	const contentLength = response.headers.get('Content-Length');
	const totalBytes = contentLength ? parseInt(contentLength, 10) : null;
	const reader = response.body!.getReader();
	const chunks: Uint8Array[] = [];
	let receivedBytes = 0;

	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		receivedBytes += value.length;
		onProgress({ receivedBytes, totalBytes });
	}

	const combined = new Uint8Array(receivedBytes);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.length;
	}
	return combined.buffer;
}
