<script lang="ts">
	import { clearRegistryCache } from '$lib/registry.js';
	import { clearLedger } from '$lib/ledger.js';
	import { clearOwnedProducts } from '$lib/owned-products.js';
	import { clearObsidianIntroSeen } from '$lib/obsidian-intro.js';
	import { clearStoredTheme } from '$lib/theme.js';
	import * as m from '$lib/paraglide/messages.js';

	let { onclose }: { onclose: () => void } = $props();

	interface CacheItem {
		key: string;
		label: string;
		hint: string;
		clear: () => void | Promise<void>;
	}

	const items: CacheItem[] = [
		{
			key: 'registry',
			label: 'Registry cache',
			hint: 'The cached copy of the browse-tier registry. Clearing forces a fresh fetch on the next visit.',
			clear: clearRegistryCache,
		},
		{
			key: 'ledger',
			label: 'Download ledger',
			hint: 'The record of which mod versions were installed. Clearing removes all update badges.',
			clear: clearLedger,
		},
		{
			key: 'owned-products',
			label: 'Owned-products library',
			hint: 'The products you marked as owned. Clearing returns the filter to "all products owned".',
			clear: clearOwnedProducts,
		},
		{
			key: 'obsidian-intro',
			label: 'Obsidian intro flag',
			hint: 'Whether the first-download Obsidian explainer has been seen. Clearing makes it show again.',
			clear: clearObsidianIntroSeen,
		},
		{
			key: 'theme',
			label: 'Theme preference',
			hint: 'Your saved light/dark choice. Clearing falls back to the system theme.',
			clear: clearStoredTheme,
		},
	];

	let clearedKey = $state<string | null>(null);
	let clearedTimer: ReturnType<typeof setTimeout> | null = null;

	async function handleClear(item: CacheItem) {
		await item.clear();
		clearedKey = item.key;
		if (clearedTimer !== null) clearTimeout(clearedTimer);
		clearedTimer = setTimeout(() => {
			clearedKey = null;
			clearedTimer = null;
		}, 1500);
	}
</script>

<aside class="dev-panel">
	<div class="dev-header">
		<span class="dev-title">Dev Panel</span>
		<button class="dev-close" onclick={onclose}>X</button>
	</div>
	<p class="dev-explanation">
		{m.dev_panel_explanation()}
	</p>

	<div class="dev-body">
		<span class="dev-section-title">Clear cached values</span>
		<ul class="cache-list">
			{#each items as item (item.key)}
				<li class="cache-item">
					<div class="cache-text">
						<span class="cache-label">{item.label}</span>
						<p class="dev-hint">{item.hint}</p>
					</div>
					<div class="cache-action">
						<button class="dev-btn" onclick={() => handleClear(item)}>Clear</button>
						{#if clearedKey === item.key}
							<span class="dev-cleared">Cleared</span>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	</div>
</aside>

<style>
	.dev-panel {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--color-surface);
		border-top: 2px solid var(--color-primary);
		padding: var(--spacing-sm) var(--spacing-md);
		z-index: 1000;
		font-size: var(--font-size-sm);
		max-height: 70vh;
		overflow-y: auto;
	}

	.dev-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--spacing-sm);
	}

	.dev-title {
		font-weight: 700;
		color: var(--color-primary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.dev-close {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		font-size: var(--font-size-sm);
		padding: 2px var(--spacing-xs);
		min-height: auto;
	}

	.dev-close:hover {
		color: var(--color-text);
	}

	.dev-explanation {
		color: var(--color-text-muted);
		font-size: var(--font-size-xs);
		line-height: 1.4;
		margin-bottom: var(--spacing-sm);
	}

	.dev-section-title {
		display: block;
		color: var(--color-text-muted);
		font-size: var(--font-size-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		margin-bottom: var(--spacing-xs);
	}

	.cache-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.cache-item {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--spacing-md);
		padding: var(--spacing-xs) 0;
	}

	.cache-item + .cache-item {
		border-top: 1px solid var(--color-border);
	}

	.cache-text {
		flex: 1;
		min-width: 0;
	}

	.cache-label {
		font-size: var(--font-size-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--color-text-muted);
	}

	.dev-hint {
		font-weight: 400;
		text-transform: none;
		letter-spacing: normal;
		line-height: 1.4;
		margin: 2px 0 0;
		color: var(--color-text-muted);
	}

	.cache-action {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
		flex-shrink: 0;
	}

	.dev-btn {
		font-size: var(--font-size-xs);
		padding: var(--spacing-xs) var(--spacing-sm);
		min-height: auto;
		background: var(--color-primary);
		color: var(--color-primary-text);
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
	}

	.dev-btn:hover {
		opacity: 0.85;
	}

	.dev-cleared {
		color: var(--color-success);
		font-size: var(--font-size-xs);
	}
</style>
