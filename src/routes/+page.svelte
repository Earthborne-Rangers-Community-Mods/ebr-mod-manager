<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { fetchRegistry, type BrowseMod, type ModType } from '$lib/registry.js';
	import { RegistryFetchError } from '$lib/errors.js';
	import {
		getInstallMethod,
		changeVaultTarget,
		getVaultFolderName,
		getStoredVaultFolderName,
	} from '$lib/vault.js';

	let mods = $state<BrowseMod[]>([]);
	let loading = $state(true);
	let error = $state('');
	let searchQuery = $state('');
	let activeTypeFilter = $state<ModType | 'all'>('all');
	let vaultFolderName = $state<string | null>(null);

	const TYPE_FILTERS: { value: ModType | 'all'; label: () => string }[] = [
		{ value: 'all', label: m.filter_all },
		{ value: 'enhancement', label: m.filter_enhancement },
		{ value: 'expansion', label: m.filter_expansion },
		{ value: 'one-day-mission', label: m.filter_one_day_mission },
		{ value: 'campaign', label: m.filter_campaign },
		{ value: 'collection', label: m.filter_collection },
		{ value: 'theme', label: m.filter_theme },
	];

	const filteredMods = $derived.by(() => {
		let result = mods;
		if (activeTypeFilter !== 'all') {
			result = result.filter((mod) => mod.type === activeTypeFilter);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			result = result.filter(
				(mod) =>
					mod.name.toLowerCase().includes(q) ||
					mod.author.toLowerCase().includes(q) ||
					mod.description.toLowerCase().includes(q) ||
					mod.tags?.some((t) => t.includes(q)),
			);
		}
		return result;
	});

	async function loadRegistry() {
		loading = true;
		error = '';
		try {
			const registry = await fetchRegistry();
			mods = registry.mods;
		} catch (err) {
			console.error('Registry fetch failed:', err);
			if (err instanceof RegistryFetchError && err.httpStatus >= 500) {
				error = m.error_registry_fetch_server();
			} else {
				error = m.error_registry_fetch();
			}
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadRegistry();
		getStoredVaultFolderName().then((name) => {
			vaultFolderName = name;
		});
	});

	async function handleChangeFolder() {
		try {
			const target = await changeVaultTarget();
			vaultFolderName = getVaultFolderName(target);
		} catch {
			// User cancelled the picker -- nothing to do
		}
	}
</script>

<section class="browse">
	<div class="page-header">
		<h1>{m.browse_mods()}</h1>
		<div class="header-actions">
			{#if getInstallMethod() === 'vault-write'}
				{#if vaultFolderName}
					<span class="vault-folder-name">{vaultFolderName}</span>
				{/if}
				<button class="btn-secondary header-button" onclick={handleChangeFolder}>{m.change_vault_folder()}</button>
			{/if}
		</div>
	</div>

	<div class="controls">
		<input
			type="search"
			placeholder={m.search_placeholder()}
			bind:value={searchQuery}
			class="search-input"
		/>

		<div class="type-filters" role="group" aria-label="Filter by mod type">
			{#each TYPE_FILTERS as filter}
				<button
					class="btn-chip"
					class:active={activeTypeFilter === filter.value}
					aria-pressed={activeTypeFilter === filter.value}
					onclick={() => (activeTypeFilter = filter.value)}
				>
					{filter.label()}
				</button>
			{/each}
		</div>
	</div>

	{#if loading}
		<p class="status-message">{m.loading_registry()}</p>
	{:else if error}
		<div class="error-block">
			<p class="status-message error">{error}</p>
			<button class="btn-secondary retry-button" onclick={loadRegistry}>{m.retry()}</button>
		</div>
	{:else if filteredMods.length === 0}
		<p class="status-message">{m.no_mods_found()}</p>
	{:else}
		<ul class="mod-list">
			{#each filteredMods as mod (mod.id)}
				<li class="mod-card">
					<a href="{resolve('/mods/' + mod.id)}" class="mod-card-link">
						<div class="mod-info">
							<h2 class="mod-name">
								{#if mod.icon}<span class="mod-icon" aria-hidden="true">{mod.icon}</span>{/if}{mod.name}
							</h2>
							<p class="mod-author">{mod.author ? m.mod_detail_author({ author: mod.author }) : m.mod_detail_unknown_author()}</p>
							<p class="mod-description">{mod.description}</p>
						</div>
						<div class="mod-aside">
							<span class="badge">{mod.type}</span>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	<p class="make-your-own"><a href="{resolve('/docs/modding-guide')}">{m.make_your_own()}</a></p>
</section>

<style>
	.browse h1 {
		margin-bottom: 0;
		font-family: var(--font-display);
		color: var(--color-accent);
	}

	.page-header {
		margin-bottom: var(--spacing-md);
	}

	.header-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		align-items: center;
		margin-top: var(--spacing-sm);
	}

	.vault-folder-name {
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 10rem;
	}

	.header-button {
		white-space: nowrap;
		min-height: 2.5rem;
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-lg);
	}

	.search-input {
		font: inherit;
		font-size: var(--font-size-sm);
		padding: var(--spacing-sm) var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		width: 100%;
		min-height: 44px;
		transition: border-color var(--transition-fast);
	}

	.search-input:focus-visible {
		border-color: var(--color-primary);
	}

	.type-filters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}

	.mod-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-sm);
	}

	.mod-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
	}

	@media (hover: hover) {
		.mod-card:hover {
			border-color: var(--color-primary);
			box-shadow: var(--shadow-sm);
		}
	}

	.mod-card-link {
		display: block;
		padding: var(--spacing-sm) var(--spacing-md);
		color: inherit;
		text-decoration: none;
		position: relative;
	}

	.mod-card-link:hover {
		text-decoration: none;
	}

	.mod-icon {
		font-size: 1.1em;
		line-height: 1;
		margin-right: var(--spacing-xs);
	}

	.mod-info {
		flex: 1;
		min-width: 0;
	}

	.mod-name {
		font-family: var(--font-display);
		font-size: var(--font-size-base);
		font-weight: 600;
		margin-bottom: var(--spacing-xs);
	}

	.mod-author {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin-bottom: var(--spacing-xs);
	}

	.mod-description {
		font-size: var(--font-size-sm);
		line-height: var(--line-height-normal);
	}

	.mod-aside {
		position: absolute;
		top: var(--spacing-sm);
		right: var(--spacing-md);
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.make-your-own {
		text-align: center;
		margin-top: var(--spacing-lg);
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
	}

	.make-your-own a {
		color: var(--color-text-muted);
		text-decoration: underline;
		transition: color var(--transition-fast);
	}

	.make-your-own a:hover {
		color: var(--color-primary);
	}

	.error-block {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.retry-button {
		min-height: 2.5rem;
	}
</style>
