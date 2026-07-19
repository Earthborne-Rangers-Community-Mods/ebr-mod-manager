<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { fetchRegistry, type BrowseMod, type ModType } from '$lib/registry.js';
	import { RegistryFetchError } from '$lib/errors.js';
	import { getLedger, entryFor, compareVersions, type DownloadLedger } from '$lib/ledger.js';
	import {
		getOwnedProducts,
		setOwnedProducts,
		ownsAllRequiredProducts,
	} from '$lib/owned-products.js';
	import ModTypeFilter from '$lib/ui/ModTypeFilter.svelte';
	import OwnedProductsFilter from '$lib/ui/OwnedProductsFilter.svelte';
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
	let typeFilterOn = $state(false);
	let selectedTypes = $state<Set<ModType>>(new Set());
	let vaultFolderName = $state<string | null>(null);
	let ledger = $state<DownloadLedger>({});
	let compatibleOnly = $state(false);
	let ownedProducts = $state<Set<string> | null>(null);

	const filteredMods = $derived.by(() => {
		let result = mods;
		if (typeFilterOn && selectedTypes.size > 0) {
			result = result.filter((mod) => selectedTypes.has(mod.type));
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
		if (compatibleOnly) {
			result = result.filter((mod) =>
				ownsAllRequiredProducts(mod.requiredProducts, ownedProducts),
			);
		}
		return result;
	});

	/** A previously-downloaded mod shows a badge when the registry is ahead of the ledger. */
	function modHasUpdate(mod: BrowseMod): boolean {
		const entry = entryFor(ledger, mod.id);
		return entry ? compareVersions(mod.latestVersion, entry.version) > 0 : false;
	}

	async function loadRegistry(forceRefresh = false) {
		loading = true;
		error = '';
		try {
			const registry = await fetchRegistry({ forceRefresh });
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
		ledger = getLedger();
		ownedProducts = getOwnedProducts();
		getStoredVaultFolderName().then((name) => {
			vaultFolderName = name;
		});
	});

	function toggleOwnedProduct(id: string, owned: boolean) {
		const next = new Set(ownedProducts ?? []);
		if (owned) {
			next.add(id);
		} else {
			next.delete(id);
		}
		ownedProducts = next;
		setOwnedProducts(next);
	}

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
			<button
				class="btn-secondary header-button refresh-button"
				onclick={() => loadRegistry(true)}
				disabled={loading}
				aria-label={m.refresh_registry()}
				title={m.refresh_registry()}
			>
				<svg
					class="refresh-icon"
					viewBox="0 0 24 24"
					width="18"
					height="18"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M21 12a9 9 0 1 1-2.64-6.36" />
					<polyline points="21 3 21 9 15 9" />
				</svg>
			</button>
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

		<div class="filter-toggles">
			<span class="filter-toggles-label">{m.filters_label()}</span>
			<button
				class="btn-chip"
				class:active={typeFilterOn}
				aria-pressed={typeFilterOn}
				aria-expanded={typeFilterOn}
				aria-controls="mod-types-section"
				onclick={() => (typeFilterOn = !typeFilterOn)}
			>
				{m.filter_mod_types()}
			</button>
			<button
				class="btn-chip"
				class:active={compatibleOnly}
				aria-pressed={compatibleOnly}
				aria-expanded={compatibleOnly}
				aria-controls="owned-products-section"
				onclick={() => (compatibleOnly = !compatibleOnly)}
			>
				{m.filter_compatible_only()}
			</button>
		</div>

		{#if typeFilterOn || compatibleOnly}
			<div
				class="filters-panel"
				role="region"
				aria-label={m.filters_region_label()}
			>
				{#if typeFilterOn}
					<ModTypeFilter id="mod-types-section" bind:selectedTypes />
				{/if}

				{#if compatibleOnly}
					<OwnedProductsFilter
						id="owned-products-section"
						{ownedProducts}
						onToggle={toggleOwnedProduct}
					/>
				{/if}
			</div>
		{/if}
	</div>

	{#if loading}
		<p class="status-message">{m.loading_registry()}</p>
	{:else if error}
		<div class="error-block">
			<p class="status-message error">{error}</p>
			<button class="btn-secondary retry-button" onclick={() => loadRegistry(true)}>{m.retry()}</button>
		</div>
	{:else if filteredMods.length === 0}
		<p class="status-message">{m.no_mods_found()}</p>
	{:else}
		<ul class="mod-list">
			{#each filteredMods as mod (mod.id)}
				<li class="mod-card">
					<a href="{resolve('/mods/[id]', { id: mod.id })}" class="mod-card-link">
						{#if mod.icon}<span class="mod-icon" aria-hidden="true">{mod.icon}</span>{/if}
						<div class="mod-info">
							<h2 class="mod-name">{mod.name}</h2>
							<p class="mod-author">{mod.author ? m.mod_detail_author({ author: mod.author }) : m.mod_detail_unknown_author()}</p>
							<p class="mod-description">{mod.description}</p>
						</div>
						<div class="mod-aside">
							{#if modHasUpdate(mod)}
								<span class="badge badge-update">{m.mod_update_available_badge()}</span>
							{/if}
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
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-sm);
		margin-bottom: var(--spacing-md);
	}

	.header-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		align-items: center;
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

	.refresh-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding-inline: var(--spacing-sm);
	}

	.refresh-icon {
		display: block;
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

	.filter-toggles {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-xs);
	}

	.filter-toggles-label {
		font-size: var(--font-size-sm);
		font-weight: 600;
		color: var(--color-text-muted);
		margin-right: var(--spacing-xs);
	}

	.filters-panel {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-md);
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-surface);
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
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
		padding: var(--spacing-sm) var(--spacing-md);
		color: inherit;
		text-decoration: none;
		position: relative;
	}

	.mod-card-link:hover {
		text-decoration: none;
	}

	.mod-icon {
		flex-shrink: 0;
		font-size: 1.75rem;
		line-height: 1;
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
