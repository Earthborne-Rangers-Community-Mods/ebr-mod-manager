<script lang="ts">
	import { Capacitor } from '@capacitor/core';
	import * as m from '$lib/paraglide/messages.js';
	import { fetchRegistry, type BrowseMod, type ModType } from '$lib/registry.js';
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
		} catch {
			error = m.error_registry_fetch();
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
				<button class="header-button" onclick={handleChangeFolder}>{m.change_vault_folder()}</button>
			{/if}
			<!-- Android doesn't support obsidian://choose-vault; use bare obsidian:// to just open the app -->
			<a class="header-button" href={Capacitor.isNativePlatform() ? 'obsidian://' : 'obsidian://choose-vault'}>{m.open_obsidian()}</a>
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
					class="filter-chip"
					class:active={activeTypeFilter === filter.value}
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
		<p class="status-message error">{error}</p>
	{:else if filteredMods.length === 0}
		<p class="status-message">{m.no_mods_found()}</p>
	{:else}
		<ul class="mod-list">
			{#each filteredMods as mod (mod.id)}
				<li class="mod-card">
					<a href="/mods/{mod.id}" class="mod-card-link">
						<div class="mod-icon">{mod.icon ?? ''}</div>
						<div class="mod-info">
							<h2 class="mod-name">{mod.name}</h2>
							<p class="mod-author">{mod.author ? m.mod_detail_author({ author: mod.author }) : m.mod_detail_unknown_author()}</p>
							<p class="mod-description">{mod.description}</p>
							<div class="mod-meta">
								<span class="mod-type-badge">{mod.type}</span>
								{#if mod.safeToAddMidCampaign}
									<span class="mod-safety safe">{m.mod_detail_safe_mid_campaign()}</span>
								{:else}
									<span class="mod-safety unsafe">{m.mod_detail_not_safe_mid_campaign()}</span>
								{/if}
							</div>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.browse h1 {
		margin-bottom: 0;
	}

	.page-header {
		margin-bottom: 1rem;
	}

	.header-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin-top: 0.5rem;
	}

	.vault-folder-name {
		font-size: 0.8125rem;
		color: var(--color-text-muted, #888);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 10rem;
	}

	.header-button {
		font-size: 0.875rem;
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		text-decoration: none;
		white-space: nowrap;
		cursor: pointer;
	}

	.header-button:hover {
		background: var(--color-surface-hover, var(--color-surface));
	}

	.controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.search-input {
		font: inherit;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
		color: var(--color-text);
		width: 100%;
	}

	.type-filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.filter-chip {
		font-size: 0.8125rem;
		padding: 0.3125rem 0.75rem;
		min-height: auto;
		background: var(--color-surface);
		color: var(--color-text-muted);
		border: 1px solid var(--color-border);
	}

	.filter-chip:hover {
		border-color: var(--color-primary);
		color: var(--color-primary);
		background: var(--color-surface);
	}

	.filter-chip.active {
		background: var(--color-primary);
		color: #fff;
		border-color: var(--color-primary);
	}

	.status-message {
		text-align: center;
		color: var(--color-text-muted);
		padding: 2rem 0;
	}

	.status-message.error {
		color: var(--color-error);
	}

	.mod-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.mod-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		transition: border-color 0.15s;
	}

	@media (hover: hover) {
		.mod-card:hover {
			border-color: var(--color-primary);
		}
	}

	.mod-card-link {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		color: inherit;
		text-decoration: none;
	}

	.mod-card-link:hover {
		text-decoration: none;
	}

	.mod-icon {
		font-size: 2rem;
		line-height: 1;
		flex-shrink: 0;
		width: 2.5rem;
		text-align: center;
	}

	.mod-info {
		flex: 1;
		min-width: 0;
	}

	.mod-name {
		font-size: 1.0625rem;
		font-weight: 600;
		margin-bottom: 0.125rem;
	}

	.mod-author {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin-bottom: 0.375rem;
	}

	.mod-description {
		font-size: 0.875rem;
		margin-bottom: 0.5rem;
	}

	.mod-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}

	.mod-type-badge {
		font-size: 0.75rem;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		background: var(--color-border);
		color: var(--color-text-muted);
		text-transform: capitalize;
	}

	.mod-safety {
		font-size: 0.75rem;
	}

	.mod-safety.safe {
		color: #2a9d2a;
	}

	.mod-safety.unsafe {
		color: var(--color-error);
	}
</style>
