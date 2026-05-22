import { getLocale } from '$lib/paraglide/runtime.js';
import { renderMarkdown } from '$lib/markdown.js';

export async function load() {
	const locale = getLocale();
	let source: string;
	try {
		source = (await import(`../../../lib/docs/${locale}/modding-guide.md?raw`)).default;
	} catch {
		source = (await import('../../../lib/docs/en/modding-guide.md?raw')).default;
	}
	return { html: renderMarkdown(source) };
}
