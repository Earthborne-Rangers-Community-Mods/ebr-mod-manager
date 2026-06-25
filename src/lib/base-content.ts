// Helpers for fetching shared assets from the canonical
// `ebr-mod-base-content` repo. Today this only exposes the EBR theme CSS
// snippets (ebr-symbols.css and ebr-styles.css) used to render mod
// description markdown the same way Obsidian does during play, but the
// module is named generically so future shared assets (templates, icon
// art, etc.) can live alongside without another rename.
//
// Resources are always fetched from the HEAD of `main` (not a per-mod
// commit hash) -- description pages should always reflect the current
// visual baseline so they match what a player sees after installing.
//
// Returned CSS is concatenated text rather than globally injected.
// Callers (the mod detail page) put it inside a shadow root so the rules
// stay sealed off from the surrounding app -- the snippets declare bare
// class selectors like `.theme-light`, `.callout`, and `.harm` that
// would otherwise be at risk of colliding with app styles.
//
// Fetches are cached for the page lifetime so opening multiple mod
// detail pages in one session only hits the network once.

const BASE_CONTENT_OWNER = 'Earthborne-Rangers-Community-Mods';
const BASE_CONTENT_REPO = 'ebr-mod-base-content';
const BASE_CONTENT_BRANCH = 'main';

const SNIPPETS = ['ebr-symbols.css', 'ebr-styles.css'] as const;

function snippetUrl(name: string): string {
	const path = `.obsidian/snippets/${name}`;
	return `https://raw.githubusercontent.com/${BASE_CONTENT_OWNER}/${BASE_CONTENT_REPO}/${BASE_CONTENT_BRANCH}/${path}`;
}

let cssPromise: Promise<string> | null = null;

/**
 * Fetch and concatenate the base-content CSS snippets. Returns the empty
 * string if all fetches fail -- a partial fetch returns whatever was
 * retrieved successfully. The result is cached for the page lifetime.
 */
export function getBaseContentCss(): Promise<string> {
	cssPromise ??= fetchAll();
	return cssPromise;
}

// Defense-in-depth size cap. The shadow root is the real isolation
// boundary, but rejecting absurdly large responses guards against an
// accidental commit of a giant blob (or a malicious one) bloating
// memory or stalling parsing. Real snippets sit well under 100 KB; the
// limit is generous enough to absorb growth without being a footgun.
const MAX_SNIPPET_BYTES = 1_048_576; // 1 MiB

async function fetchAll(): Promise<string> {
	const parts = await Promise.all(SNIPPETS.map((name) => fetchOne(name)));
	return parts.filter((p) => p.length > 0).join('\n\n');
}

async function fetchOne(name: string): Promise<string> {
	try {
		const response = await fetch(snippetUrl(name));
		if (!response.ok) return '';
		// If the server reports a size, reject early without buffering.
		const contentLength = Number(response.headers.get('content-length'));
		if (Number.isFinite(contentLength) && contentLength > MAX_SNIPPET_BYTES) {
			return '';
		}
		const text = await response.text();
		// Re-check after reading: content-length may be missing, wrong,
		// or the response may be chunked. Bytes >= UTF-16 code units, so
		// comparing string length to a byte limit is conservative.
		if (text.length > MAX_SNIPPET_BYTES) {
			return '';
		}
		return text;
	} catch {
		// Network failure: silently skip. The description still renders;
		// it just won't show EBR symbols or themed callouts/headings.
		return '';
	}
}

/** Test-only: reset the cached fetch promise. */
export function _resetBaseContentCssForTesting(): void {
	cssPromise = null;
}
