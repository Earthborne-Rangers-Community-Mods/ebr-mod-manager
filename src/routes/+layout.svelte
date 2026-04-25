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
</script>

<svelte:window onkeydown={handleKeydown} />

<header class="app-header">
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
