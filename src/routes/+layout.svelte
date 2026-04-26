<script lang="ts">
	import '../app.css';
	import * as m from '$lib/paraglide/messages.js';
	import DevPanel from '$lib/ui/DevPanel.svelte';
	import { isDevPanelOpen, setDevPanelOpen } from '$lib/devsettings.js';

	let { children } = $props();

	let showDevPanel = $state(isDevPanelOpen());

	function toggleDevPanel() {
		showDevPanel = !showDevPanel;
		setDevPanelOpen(showDevPanel);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.ctrlKey && e.key === '`') {
			e.preventDefault();
			toggleDevPanel();
		}
	}

	const TAP_COUNT = 5;
	const TAP_WINDOW_MS = 2000;
	let tapTimestamps: number[] = [];

	function handleHeaderTap(e: MouseEvent) {
		// Only enable the tap-to-open-dev-panel gesture on touch devices
		if (!('ontouchstart' in window)) return;
		const now = Date.now();
		tapTimestamps.push(now);
		// Keep only taps within the time window
		tapTimestamps = tapTimestamps.filter((t) => now - t < TAP_WINDOW_MS);
		if (tapTimestamps.length >= TAP_COUNT) {
			e.preventDefault();
			tapTimestamps = [];
			toggleDevPanel();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<header class="app-header" onclick={handleHeaderTap}>
	<div class="container header-inner">
		<a href="/" class="logo">{m.app_title()}</a>
	</div>
</header>

<main class="container">
	{@render children()}
</main>

{#if showDevPanel}
	<DevPanel onclose={toggleDevPanel} />
{/if}

<style>
	.app-header {
		border-bottom: 1px solid var(--color-border);
		padding: 0.75rem 0;
		margin-bottom: 1.5rem;
		-webkit-tap-highlight-color: transparent;
		user-select: none;
	}

	.header-inner {
		display: flex;
		align-items: center;
	}

	.logo {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--color-text);
	}

	.logo:hover {
		text-decoration: none;
	}

	main {
		padding-bottom: 2rem;
	}
</style>
