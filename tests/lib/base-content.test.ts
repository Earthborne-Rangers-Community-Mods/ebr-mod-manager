// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	getBaseContentCss,
	_resetBaseContentCssForTesting,
} from '../../src/lib/base-content.js';

const SYMBOLS_URL =
	'https://raw.githubusercontent.com/Earthborne-Rangers-Community-Mods/ebr-mod-base-content/main/.obsidian/snippets/ebr-symbols.css';
const STYLES_URL =
	'https://raw.githubusercontent.com/Earthborne-Rangers-Community-Mods/ebr-mod-base-content/main/.obsidian/snippets/ebr-styles.css';

beforeEach(() => {
	_resetBaseContentCssForTesting();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('getBaseContentCss', () => {
	it('fetches both snippet files from main on the canonical repo', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('/* css */', { status: 200 }));

		await getBaseContentCss();

		const urls = fetchMock.mock.calls.map((call) => String(call[0]));
		expect(urls).toContain(SYMBOLS_URL);
		expect(urls).toContain(STYLES_URL);
	});

	it('returns the concatenated body of every snippet that loaded', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			const url = String(input);
			if (url === SYMBOLS_URL) return new Response('.harm { color: red; }');
			if (url === STYLES_URL) return new Response('.theme-light { font: x; }');
			return new Response('', { status: 404 });
		});

		const css = await getBaseContentCss();

		expect(css).toContain('.harm { color: red; }');
		expect(css).toContain('.theme-light { font: x; }');
	});

	it('only fetches once across repeated calls (per page lifetime)', async () => {
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('/* css */', { status: 200 }));

		await getBaseContentCss();
		await getBaseContentCss();
		await getBaseContentCss();

		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('skips snippets that return non-OK responses but keeps the rest', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			if (String(input) === SYMBOLS_URL) {
				return new Response('not found', { status: 404 });
			}
			return new Response('.theme-light {}', { status: 200 });
		});

		const css = await getBaseContentCss();

		expect(css).not.toContain('not found');
		expect(css).toContain('.theme-light {}');
	});

	it('returns an empty string when every snippet fails to fetch', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

		await expect(getBaseContentCss()).resolves.toBe('');
	});

	it('drops a snippet whose body exceeds the size cap', async () => {
		// One snippet within the cap, the other ~2 MiB of text.
		const oversized = 'a'.repeat(2 * 1024 * 1024);
		vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			if (String(input) === SYMBOLS_URL) {
				return new Response(oversized);
			}
			return new Response('.theme-light {}');
		});

		const css = await getBaseContentCss();

		expect(css).not.toContain('a'.repeat(64));
		expect(css).toContain('.theme-light {}');
	});

	it('rejects oversized responses up front via content-length', async () => {
		// Body is small, but the header lies about the size. The fetcher
		// should refuse to read the body rather than trust the body size.
		vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
			if (String(input) === SYMBOLS_URL) {
				return new Response('.harm {}', {
					headers: { 'content-length': String(2 * 1024 * 1024) },
				});
			}
			return new Response('.theme-light {}');
		});

		const css = await getBaseContentCss();

		expect(css).not.toContain('.harm {}');
		expect(css).toContain('.theme-light {}');
	});
});
