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
	// :host turns the wrapper into a block-level box. img / pre rules
	// keep oversized embedded images and long code lines from blowing
	// out the layout.
	//
	// The Obsidian snippet declares the EBR palette as CSS variables on
	// .theme-light / .theme-dark, but it relies on Obsidian's own app
	// painting `body` with those variables. There is no `body` inside
	// this shadow root, so we paint the theme wrapper here. Doing it on
	// our side (rather than in the snippet) keeps the snippet a pure
	// palette declaration and leaves room to use a different background
	// color in the manager later if we want.
	const containerCss = `
		:host {
			display: block;
			margin-bottom: 1.5rem;
		}
		.theme-light,
		.theme-dark {
			background-color: var(--background-primary);
			color: var(--text-normal);
		}
		.markdown-reading-view img { max-width: 100%; height: auto; }
		.markdown-reading-view pre { overflow-x: auto; }
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
		const themeClass =
			typeof window !== 'undefined' &&
			window.matchMedia?.('(prefers-color-scheme: dark)').matches
				? 'theme-dark'
				: 'theme-light';

		const containerStyle = document.createElement('style');
		containerStyle.textContent = containerCss;

		const baseStyle = document.createElement('style');
		baseStyle.textContent = currentBaseCss;

		// Mirror Obsidian's DOM structure so the snippet selectors line
		// up without any in-component overrides:
		//   <div class="theme-light"> or "theme-dark"  -- declares vars,
		//                                                 paints bg/text
		//     <div class="markdown-reading-view markdown-rendered">
		//       ...rendered markdown HTML...
		//
		// In Obsidian the theme class lives on <body>; we put it on the
		// outer wrapper here. The .markdown-rendered class is added in
		// addition to .markdown-reading-view so any snippet rules that
		// scope to either selector still match.
		const themeWrapper = document.createElement('div');
		themeWrapper.className = themeClass;

		const content = document.createElement('div');
		content.className = 'markdown-reading-view markdown-rendered';
		// The HTML here comes from our own markdown renderer running on
		// content fetched at the registry-pinned commit hash -- the same
		// trust boundary the rest of the app already accepts.
		content.innerHTML = currentHtml;

		themeWrapper.appendChild(content);

		shadow.replaceChildren(containerStyle, baseStyle, themeWrapper);
	});
</script>

<div bind:this={host}></div>
