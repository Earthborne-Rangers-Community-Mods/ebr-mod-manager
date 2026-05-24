<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		notes?: string;
	}

	let { notes }: Props = $props();
</script>

<div class="safety-callout">
	<p class="safety-callout-title">{m.mod_detail_not_safe_mid_campaign()}</p>
	{#if notes}
		<p class="safety-callout-notes">{notes}</p>
	{/if}
</div>

<style>
	.safety-callout {
		border-left: 3px solid var(--color-error);
		background: var(--color-surface);
		border-radius: var(--radius-sm);
		padding: var(--spacing-sm) var(--spacing-md);
		margin-bottom: var(--spacing-lg);
	}

	.safety-callout-title {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-error);
		margin-bottom: var(--spacing-xs);
	}

	.safety-callout-notes {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		line-height: var(--line-height-normal);
	}
</style>
