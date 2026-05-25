<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import BackLink from '$lib/ui/BackLink.svelte';

	let { data } = $props();
</script>

<section class="docs">
	<BackLink />
	<h1>{m.modding_guide_title()}</h1>
	<div class="guide-content markdown-content">{@html data.html}</div>
</section>

<style>
	.docs {
		max-width: 42rem;
		margin: 0 auto;
		overflow-x: hidden;
	}

	.docs h1 {
		font-family: var(--font-display);
		color: var(--color-accent);
		margin-bottom: var(--spacing-md);
	}

	.guide-content {
		line-height: var(--line-height-normal);
	}
</style>
