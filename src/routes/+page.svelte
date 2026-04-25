<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { fetchRegistry, type BrowseMod, type ModType } from '$lib/registry.js';
	import { downloadModZip, type DownloadProgress } from '$lib/download.js';
	import { extractModZipAsync, repackageModZipAsync } from '$lib/extraction.js';
	import {
		isFileSystemAccessSupported,
		pickVaultDirectory,
		checkVaultDirectory,
		clearDirectory,
		writeVault,
		setInstalledMod,
	} from '$lib/vault.js';
	import { PathTraversalError, ModDownloadError } from '$lib/errors.js';
	import { getToken } from '$lib/devsettings.js';

	let mods = $state<BrowseMod[]>([]);
	let loading = $state(true);
	let error = $state('');
	let searchQuery = $state('');
	let activeTypeFilter = $state<ModType | 'all'>('all');

	// Track per-mod download state by mod id
	let downloadingId = $state<string | null>(null);
	let downloadProgress = $state<DownloadProgress | null>(null);
	let downloadError = $state<string | null>(null);
	let lastDownloadedId = $state<string | null>(null);
	let writeProgress = $state<string | null>(null);

	// Remembered directory handle (persists across downloads in the same session)
	let vaultDirHandle = $state<FileSystemDirectoryHandle | null>(null);

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
	});

	async function handleDownload(mod: BrowseMod) {
		if (downloadingId) return;
		downloadingId = mod.id;
		downloadProgress = null;
		downloadError = null;
		lastDownloadedId = null;
		writeProgress = null;
		try {
			const token = getToken() ?? undefined;

			// Pick vault directory while user gesture is still active (before async work)
			if (isFileSystemAccessSupported() && !vaultDirHandle) {
				vaultDirHandle = await pickVaultDirectory();
			}

			// Check folder contents before starting the download
			if (isFileSystemAccessSupported()) {
				const vaultStatus = await checkVaultDirectory(vaultDirHandle!);

				if (vaultStatus === 'unrecognized') {
					downloadError = m.error_vault_safety();
					vaultDirHandle = null;
					return;
				}

				if (vaultStatus === 'existing-vault') {
					const ok = confirm(m.confirm_replace_vault({ modName: mod.name }));
					if (!ok) return;
				}
			}

			const zipBuffer = await downloadModZip(mod, {
				token,
				onProgress: (p) => {
					downloadProgress = p;
				},
			});

			if (isFileSystemAccessSupported()) {
				const dirHandle = vaultDirHandle!;

				// Extract with security checks (off the main thread)
				writeProgress = m.extracting_mod();
				const files = await extractModZipAsync(zipBuffer);

				// Clear existing content and write new files
				await clearDirectory(dirHandle);
				writeProgress = m.writing_vault_progress({ written: 0, total: files.length });
				await writeVault(dirHandle, files, {
					onProgress: (written, total) => {
						writeProgress = m.writing_vault_progress({ written, total });
					},
				});

				// Track what's installed
				setInstalledMod({
					id: mod.id,
					name: mod.name,
					version: mod.latestVersion,
					commitHash: mod.commitHash,
				});

				lastDownloadedId = mod.id;
			} else {
				// Fallback: extract, filter unsafe content, re-zip, and trigger browser download
				writeProgress = m.extracting_mod();
				const cleanZip = await repackageModZipAsync(zipBuffer);
				const blob = new Blob([cleanZip], { type: 'application/zip' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${mod.id}.zip`;
				a.click();
				URL.revokeObjectURL(url);
				lastDownloadedId = mod.id;
			}
		} catch (err) {
			console.error('Mod install failed:', err);
			if (err instanceof PathTraversalError) {
				downloadError = m.error_extraction_security();
			} else if (err instanceof DOMException && err.name === 'AbortError') {
				// User cancelled the directory picker - not an error
				downloadError = null;
			} else if (err instanceof ModDownloadError) {
				if (err.httpStatus >= 500) {
					downloadError = m.error_download_server();
				} else if (err.httpStatus === 404 || err.httpStatus === 403) {
					downloadError = m.error_download_not_found();
				} else {
					downloadError = m.error_download_failed();
				}
			} else if (err instanceof TypeError && err.message.includes('fetch')) {
				// Network error (offline, DNS failure, etc.)
				downloadError = m.error_download_network();
			} else {
				downloadError = m.error_download_failed();
			}
		} finally {
			downloadingId = null;
			downloadProgress = null;
			writeProgress = null;
		}
	}
</script>

<section class="browse">
	<h1>{m.browse_mods()}</h1>

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
						<div class="mod-actions">
							{#if downloadingId === mod.id}
								<button class="play-button" disabled>
									{#if writeProgress}
										{writeProgress}
									{:else}
										{m.downloading()}
										{#if downloadProgress}
											{#if downloadProgress.totalBytes}
												({Math.round((downloadProgress.receivedBytes / downloadProgress.totalBytes) * 100)}%)
											{:else}
												({(downloadProgress.receivedBytes / 1024).toFixed(0)} KB)
											{/if}
										{/if}
									{/if}
								</button>
							{:else if lastDownloadedId === mod.id}
								<span class="download-success">{m.vault_write_complete()}</span>
							{:else}
								<button
									class="play-button"
									disabled={downloadingId !== null}
									onclick={() => handleDownload(mod)}
								>
									{m.install_button()}
								</button>
							{/if}
							{#if downloadError && downloadingId === null && lastDownloadedId !== mod.id}
								<span class="download-error">{downloadError}</span>
							{/if}
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.browse h1 {
		margin-bottom: 1rem;
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
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		cursor: pointer;
		transition: border-color 0.15s;
	}

	.mod-card:hover {
		border-color: var(--color-primary);
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

	.mod-actions {
		margin-top: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.play-button {
		font-size: 0.8125rem;
		padding: 0.375rem 1rem;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.play-button:hover:not(:disabled) {
		opacity: 0.85;
	}

	.play-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.download-success {
		font-size: 0.8125rem;
		color: #2a9d2a;
		font-weight: 500;
	}

	.download-error {
		font-size: 0.8125rem;
		color: var(--color-error);
	}
</style>
