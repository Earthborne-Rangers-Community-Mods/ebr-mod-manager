import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../../src/lib/markdown.js';

describe('renderMarkdown', () => {
	it('renders all six heading levels matching Obsidian', () => {
		const html = renderMarkdown(
			'# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6',
		);
		expect(html).toContain('<h1>H1</h1>');
		expect(html).toContain('<h2>H2</h2>');
		expect(html).toContain('<h3>H3</h3>');
		expect(html).toContain('<h4>H4</h4>');
		expect(html).toContain('<h5>H5</h5>');
		expect(html).toContain('<h6>H6</h6>');
	});

	it('opens external links in a new tab with safe rel', () => {
		const html = renderMarkdown('[ext](https://example.com)');
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="noopener noreferrer"');
	});

	it('sets title="<href>" on external links so readers can preview the destination', () => {
		const html = renderMarkdown('[ext](https://example.com/path)');
		expect(html).toContain('title="https://example.com/path"');
	});

	it('overwrites author-supplied link titles to prevent destination spoofing', () => {
		const html = renderMarkdown('[click here](https://evil.example "https://github.com")');
		expect(html).toContain('title="https://evil.example"');
		expect(html).not.toContain('title="https://github.com"');
	});

	it('drops javascript: links', () => {
		// eslint-disable-next-line no-script-url
		const html = renderMarkdown('[bad](javascript:alert(1))');
		// The dangerous URL is rejected as a link target -- no anchor is emitted.
		expect(html).not.toContain('<a ');
	});

	it('drops data: links', () => {
		const html = renderMarkdown('[bad](data:text/html,<script>alert(1)</script>)');
		expect(html).not.toContain('<a href="data:');
	});

	it('allows mailto: links', () => {
		const html = renderMarkdown('[email](mailto:author@example.com)');
		expect(html).toContain('href="mailto:author@example.com"');
	});

	it('does not add target="_blank" to relative links', () => {
		const html = renderMarkdown('[rel](images/foo.png)');
		expect(html).not.toContain('target="_blank"');
	});

	it('adds loading="lazy" to images', () => {
		const html = renderMarkdown('![alt](images/foo.png)');
		expect(html).toContain('loading="lazy"');
	});

	it('renders GFM tables', () => {
		const html = renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |');
		expect(html).toContain('<table>');
		expect(html).toContain('<th>a</th>');
	});

	it('renders strikethrough', () => {
		const html = renderMarkdown('~~gone~~');
		expect(html).toContain('<s>gone</s>');
	});

	it('renders task list items', () => {
		const html = renderMarkdown('- [ ] todo\n- [x] done');
		expect(html).toContain('type="checkbox"');
	});

	it('autolinks bare URLs (linkify)', () => {
		const html = renderMarkdown('See https://example.com for details.');
		expect(html).toContain('<a href="https://example.com"');
	});

	it('preserves inline HTML for EBR symbol spans', () => {
		const html = renderMarkdown('Take 1 <span class="harm"></span>.');
		expect(html).toContain('<span class="harm"></span>');
	});
});
