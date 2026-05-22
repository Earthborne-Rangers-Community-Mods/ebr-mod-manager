<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import BackLink from '$lib/ui/BackLink.svelte';

	let { data } = $props();
</script>

<section class="docs">
	<BackLink />
	<h1>{m.modding_guide_title()}</h1>
	<div class="guide-content">{@html data.html}</div>
</section>

<style>
	.docs {
		max-width: 42rem;
		margin: 0 auto;
	}

	.docs h1 {
		font-family: var(--font-display);
		color: var(--color-accent);
		margin-bottom: var(--spacing-md);
	}

	.guide-content {
		line-height: var(--line-height-normal);
	}

	.guide-content :global(h2) {
		font-family: var(--font-display);
		margin-top: var(--spacing-xl);
		margin-bottom: var(--spacing-sm);
	}

	.guide-content :global(p) {
		margin-bottom: var(--spacing-md);
	}

	.guide-content :global(ol),
	.guide-content :global(ul) {
		margin-bottom: var(--spacing-md);
		padding-left: var(--spacing-lg);
	}

	.guide-content :global(li) {
		margin-bottom: var(--spacing-xs);
	}

	.guide-content :global(pre) {
		background: var(--color-surface-alt, var(--color-surface));
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		padding: var(--spacing-sm) var(--spacing-md);
		overflow-x: auto;
		margin-bottom: var(--spacing-md);
		font-size: var(--font-size-sm);
	}

	.guide-content :global(code) {
		font-size: 0.9em;
	}

	.guide-content :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: var(--spacing-md);
		font-size: var(--font-size-sm);
	}

	.guide-content :global(th),
	.guide-content :global(td) {
		border: 1px solid var(--color-border);
		padding: var(--spacing-xs) var(--spacing-sm);
		text-align: left;
	}

	.guide-content :global(th) {
		background: var(--color-surface-alt, var(--color-surface));
		font-weight: 600;
	}

	.guide-content :global(a) {
		color: var(--color-primary);
	}
</style>
