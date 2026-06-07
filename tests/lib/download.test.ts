import { describe, it, expect, vi, beforeEach } from 'vitest';
import { modZipUrl, modZipProxyUrl, downloadModZip } from '$lib/download.js';
import { ModDownloadError, NetworkError } from '$lib/errors.js';
import { InvalidRepoUrlError } from '$lib/errors.js';

vi.mock('@capacitor/core', () => ({
	Capacitor: { isNativePlatform: () => false },
}));

// --- modZipUrl ---

describe('modZipUrl', () => {
	it('builds the correct GitHub API zipball URL', () => {
		const mod = {
			repoUrl: 'https://github.com/creator/ebr-mod-base-content',
			commitHash: 'a1b2c3d4e5f6',
		};
		expect(modZipUrl(mod)).toBe(
			'https://api.github.com/repos/creator/ebr-mod-base-content/zipball/a1b2c3d4e5f6',
		);
	});

	it('strips .git suffix from repoUrl', () => {
		const mod = {
			repoUrl: 'https://github.com/creator/repo.git',
			commitHash: 'abc123',
		};
		expect(modZipUrl(mod)).toBe(
			'https://api.github.com/repos/creator/repo/zipball/abc123',
		);
	});

	it('works with org-owned repos', () => {
		const mod = {
			repoUrl: 'https://github.com/My-Org/some-repo',
			commitHash: 'def456',
		};
		expect(modZipUrl(mod)).toBe(
			'https://api.github.com/repos/My-Org/some-repo/zipball/def456',
		);
	});

	it('throws on invalid repoUrl', () => {
		const mod = {
			repoUrl: 'https://gitlab.com/user/repo',
			commitHash: 'abc123',
		};
		expect(() => modZipUrl(mod)).toThrow(InvalidRepoUrlError);
	});
});

// --- modZipProxyUrl ---

describe('modZipProxyUrl', () => {
	it('builds a proxy-relative URL', () => {
		const mod = {
			repoUrl: 'https://github.com/creator/ebr-mod-base-content',
			commitHash: 'a1b2c3d4e5f6',
		};
		expect(modZipProxyUrl(mod)).toBe(
			'/github-api/repos/creator/ebr-mod-base-content/zipball/a1b2c3d4e5f6',
		);
	});

	it('strips .git suffix', () => {
		const mod = {
			repoUrl: 'https://github.com/creator/repo.git',
			commitHash: 'abc123',
		};
		expect(modZipProxyUrl(mod)).toBe(
			'/github-api/repos/creator/repo/zipball/abc123',
		);
	});
});

// --- downloadModZip ---

describe('downloadModZip', () => {
	const mod = {
		repoUrl: 'https://github.com/creator/ebr-mod-base-content',
		commitHash: 'a1b2c3d4e5f6',
	};

	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns an ArrayBuffer on success', async () => {
		const fakeZip = new Uint8Array([80, 75, 3, 4]).buffer;
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				body: null,
				arrayBuffer: () => Promise.resolve(fakeZip),
			}),
		);

		const result = await downloadModZip(mod);
		expect(result).toBe(fakeZip);
	});

	it('sends the Accept header', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			body: null,
			arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
		});
		vi.stubGlobal('fetch', fetchMock);

		await downloadModZip(mod);
		expect(fetchMock).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: 'application/vnd.github+json',
				}),
			}),
		);
	});

	it('includes Authorization header when token is provided', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			body: null,
			arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
		});
		vi.stubGlobal('fetch', fetchMock);

		await downloadModZip(mod, { token: 'ghp_test123' });
		expect(fetchMock).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: 'Bearer ghp_test123',
				}),
			}),
		);
	});

	it('does not include Authorization header when no token', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			body: null,
			arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
		});
		vi.stubGlobal('fetch', fetchMock);

		await downloadModZip(mod);
		const headers = fetchMock.mock.calls[0][1].headers;
		expect(headers).not.toHaveProperty('Authorization');
	});

	it('throws ModDownloadError on non-ok response', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				statusText: 'Not Found',
			}),
		);

		try {
			await downloadModZip(mod);
			throw new Error('Expected function to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(ModDownloadError);
			const e = err as ModDownloadError;
			expect(e.commitHash).toBe('a1b2c3d4e5f6');
			expect(e.httpStatus).toBe(404);
			expect(e.url).toContain('a1b2c3d4e5f6');
		}
	});

	it('throws ModDownloadError on 403 rate limit', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 403,
				statusText: 'Forbidden',
			}),
		);

		try {
			await downloadModZip(mod);
			throw new Error('Expected function to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(ModDownloadError);
			expect((err as ModDownloadError).httpStatus).toBe(403);
		}
	});

	it('reports progress when onProgress and body are available', async () => {
		const chunk1 = new Uint8Array([1, 2, 3]);
		const chunk2 = new Uint8Array([4, 5]);
		let readCount = 0;

		const mockReader = {
			read: vi.fn().mockImplementation(() => {
				readCount++;
				if (readCount === 1) return Promise.resolve({ done: false, value: chunk1 });
				if (readCount === 2) return Promise.resolve({ done: false, value: chunk2 });
				return Promise.resolve({ done: true, value: undefined });
			}),
		};

		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				body: { getReader: () => mockReader },
				headers: new Headers({ 'Content-Length': '5' }),
			}),
		);

		const progressCalls: { receivedBytes: number; totalBytes: number | null }[] = [];
		const result = await downloadModZip(mod, {
			onProgress: (p) => progressCalls.push({ ...p }),
		});

		expect(progressCalls).toEqual([
			{ receivedBytes: 3, totalBytes: 5 },
			{ receivedBytes: 5, totalBytes: 5 },
		]);

		const bytes = new Uint8Array(result);
		expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5]);
	});

	it('reports null totalBytes when Content-Length is absent', async () => {
		const chunk = new Uint8Array([10, 20]);
		let readCount = 0;

		const mockReader = {
			read: vi.fn().mockImplementation(() => {
				readCount++;
				if (readCount === 1) return Promise.resolve({ done: false, value: chunk });
				return Promise.resolve({ done: true, value: undefined });
			}),
		};

		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				body: { getReader: () => mockReader },
				headers: new Headers(),
			}),
		);

		const progressCalls: { receivedBytes: number; totalBytes: number | null }[] = [];
		await downloadModZip(mod, {
			onProgress: (p) => progressCalls.push({ ...p }),
		});

		expect(progressCalls).toEqual([{ receivedBytes: 2, totalBytes: null }]);
	});

	it('falls back to arrayBuffer when no onProgress callback', async () => {
		const fakeZip = new Uint8Array([80, 75, 3, 4]).buffer;
		const arrayBufferMock = vi.fn().mockResolvedValue(fakeZip);

		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				body: { getReader: () => ({}) },
				arrayBuffer: arrayBufferMock,
			}),
		);

		const result = await downloadModZip(mod);
		expect(result).toBe(fakeZip);
		expect(arrayBufferMock).toHaveBeenCalled();
	});

	it('fetches the correct proxy URL', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			body: null,
			arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
		});
		vi.stubGlobal('fetch', fetchMock);

		await downloadModZip(mod);
		expect(fetchMock).toHaveBeenCalledWith(
			'/github-api/repos/creator/ebr-mod-base-content/zipball/a1b2c3d4e5f6',
			expect.any(Object),
		);
	});

	it('wraps TypeError from fetch as NetworkError', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

		await expect(downloadModZip(mod)).rejects.toBeInstanceOf(NetworkError);
	});

	it('preserves the original TypeError as cause on the NetworkError', async () => {
		const original = new TypeError('Failed to fetch');
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(original));

		try {
			await downloadModZip(mod);
			throw new Error('Expected to throw');
		} catch (err) {
			expect(err).toBeInstanceOf(NetworkError);
			expect((err as NetworkError).cause).toBe(original);
		}
	});
});
