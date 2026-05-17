<script lang="ts">
	// Renders rendered-markdown HTML inside a shadow root so the EBR
	// base-content CSS snippets cannot leak into surrounding
	// app styles. The host element is in the regular DOM and participates
	// in normal layout / scrolling; only the styles and inner DOM are
	// encapsulated. Click events still bubble out, so the Capacitor
	// link interceptor in `+layout.svelte` keeps working.
	import { onMount } from 'svelte';
	import { getBaseContentCss } from '$lib/base-content.js';

	let { html }: { html: string } = $props();

	let host: HTMLDivElement | undefined = $state();
	let shadow: ShadowRoot | null = null;
	let baseCss = $state('');

	// Container CSS, applied inside the shadow root before the fetched
	// snippets so the snippet's rules win on order.
	//
	// :host turns the wrapper into a block-level box. The img and pre
	// rules are layout protection only -- they keep oversized embedded
	// images and long code lines from blowing out the page width. We
	// don't impose any visual styling (border-radius, fonts, colors)
	// on the author's content; the markdown should render as authored.
	// The content inherits the host page's text color so it remains
	// readable in both light and dark themes. Obsidian-specific
	// background overrides are scoped to .markdown-reading-view so they
	// only fire in Obsidian (where that class is on the ancestor), not
	// here.
	const containerCss = `
		:host {
			display: block;
			margin-bottom: var(--spacing-lg, 1.5rem);
		}
		.description-content {
			color: var(--color-text, inherit);
			background-color: transparent;
			line-height: 1.6;
		}
		.description-content img { max-width: 100%; height: auto; }
		.description-content pre { overflow-x: auto; }
	`;

	onMount(async () => {
		baseCss = await getBaseContentCss();
	});

	// Whenever the host mounts or the content / CSS changes, rebuild the
	// shadow root. We attach the shadow root once and replace its
	// children on subsequent updates. Style content is set via
	// textContent (not innerHTML / string templates) so a stray
	// `</style>` inside the fetched CSS can't break out of the tag.
	$effect(() => {
		if (!host) return;
		shadow ??= host.attachShadow({ mode: 'open' });
		// Reading these declares them as effect dependencies.
		const currentHtml = html;
		const currentBaseCss = baseCss;

		const containerStyle = document.createElement('style');
		containerStyle.textContent = containerCss;

		const baseStyle = document.createElement('style');
		baseStyle.textContent = currentBaseCss;

		// Render description content without the Obsidian theme wrapper.
		// The .markdown-reading-view class is omitted intentionally so
		// Obsidian-scoped CSS rules (background colors, view-specific
		// layout) don't fire. The content adopts the host page's
		// typography and surface colors instead.
		const content = document.createElement('div');
		content.className = 'description-content markdown-rendered';
		// The HTML here comes from our own markdown renderer running on
		// content fetched at the registry-pinned commit hash -- the same
		// trust boundary the rest of the app already accepts.
		content.innerHTML = currentHtml;

		shadow.replaceChildren(containerStyle, baseStyle, content);
	});
</script>

<div bind:this={host}></div>
