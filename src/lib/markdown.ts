// Markdown renderer for mod description pages.
//
// Uses markdown-it (CommonMark base) with GFM-style extensions to match
// Obsidian's parsing foundation as closely as possible. Configured to:
//   - render headings as h1-h6 to match Obsidian (no offset). The mod
//     detail page scopes its own headings outside the description
//     container and styles description headings via CSS.
//   - open external links in a new tab with safe rel attributes
//   - mark all images with loading="lazy"
//
// HTML is enabled because mod content uses inline EBR symbol spans
// (e.g. <span class="harm"></span>) styled by ebr-symbols.css. Content
// is fetched from registry-pinned commits on GitHub, which are reviewed
// before listing -- the same trust boundary as the mod files themselves.

import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';

function createRenderer(): MarkdownIt {
	const md = new MarkdownIt({
		html: true,
		linkify: true,
		typographer: false,
		breaks: false,
	});

	md.use(taskLists, { enabled: false, label: false });

	// Restrict link schemes to http(s) and mailto. markdown-it already
	// blocks javascript:/vbscript:/data: URLs by default, but explicitly
	// declaring the allowlist documents intent and guards against future
	// changes to the default scheme list.
	md.validateLink = (url: string) => {
		const trimmed = url.trim().toLowerCase();
		return (
			trimmed.startsWith('http://') ||
			trimmed.startsWith('https://') ||
			trimmed.startsWith('mailto:') ||
			// Allow relative URLs (no scheme).
			!/^[a-z][a-z0-9+.-]*:/.test(trimmed)
		);
	};

	// Open external links in a new tab and surface the destination via title.
	const defaultLinkOpen =
		md.renderer.rules.link_open ??
		((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
	md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
		const token = tokens[idx];
		const href = token.attrGet('href') ?? '';
		if (/^https?:\/\//i.test(href)) {
			token.attrSet('target', '_blank');
			token.attrSet('rel', 'noopener noreferrer');
			// Show the destination URL on hover (desktop) and long-press
			// (mobile WebView) so readers can verify links before tapping.
			// Always overwrite any author-supplied title -- a custom title
			// (e.g. [click](https://evil.example "https://github.com")) could
			// otherwise spoof the destination preview.
			token.attrSet('title', href);
		}
		return defaultLinkOpen(tokens, idx, options, env, self);
	};

	// Lazy-load images.
	const defaultImage =
		md.renderer.rules.image ??
		((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
	md.renderer.rules.image = (tokens, idx, options, env, self) => {
		const token = tokens[idx];
		token.attrSet('loading', 'lazy');
		return defaultImage(tokens, idx, options, env, self);
	};

	return md;
}

const renderer = createRenderer();

/** Render markdown source to an HTML string. */
export function renderMarkdown(source: string): string {
	return renderer.render(source);
}
