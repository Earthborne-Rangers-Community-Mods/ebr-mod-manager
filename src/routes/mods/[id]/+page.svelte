<script lang="ts">
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages.js';
	import {
		fetchModDetail,
		fetchDescription,
		rewriteImagePaths,
		type ModDetail,
	} from '$lib/registry.js';
	import { ModDetailFetchError, isNetworkError } from '$lib/errors.js';
	import { renderMarkdown } from '$lib/markdown.js';
	import { getLedgerEntry, compareVersions } from '$lib/ledger.js';
	import { showObsidianIntro } from '$lib/obsidian-intro.js';
	import InstallButton from '$lib/ui/InstallButton.svelte';
	import ModDescription from '$lib/ui/ModDescription.svelte';
	import ModMetadata from '$lib/ui/ModMetadata.svelte';
	import BackLink from '$lib/ui/BackLink.svelte';

	let mod = $state<ModDetail | null>(null);
	let loading = $state(true);
	let error = $state('');
	let descriptionHtml = $state<string | null>(null);
	let installedVersion = $state<string | null>(null);

	/** The version the user last downloaded, when the registry is now ahead of it. */
	const updateFromVersion = $derived.by(() => {
		if (!mod || installedVersion === null) return null;
		return compareVersions(mod.latestVersion, installedVersion) > 0 ? installedVersion : null;
	});

	/** Read the ledger entry for the current mod into reactive state. */
	function refreshInstalledVersion(modId: string) {
		installedVersion = getLedgerEntry(modId)?.version ?? null;
	}

	/** After a successful install, re-read the ledger so the explainer clears. */
	function handleInstalled() {
		if (mod) refreshInstalledVersion(mod.id);
	}

	async function loadMod(modId: string) {
		loading = true;
		error = '';
		mod = null;
		descriptionHtml = null;

		try {
			mod = await fetchModDetail(modId);
			refreshInstalledVersion(modId);
		} catch (err) {
			console.error(`Failed to load mod '${modId}':`, err);
			if (err instanceof ModDetailFetchError && err.httpStatus === 404) {
				error = m.mod_detail_not_found();
			} else if (isNetworkError(err)) {
				error = m.error_mod_detail_network();
			} else {
				error = m.mod_detail_fetch_error();
			}
			loading = false;
			return;
		}
		loading = false;

		// Fetch the description page in the background. A missing or failed
		// fetch falls through to the manifest's short description -- the
		// detail view stays usable either way.
		const detail = mod;
		try {
			const md = await fetchDescription(detail);
			if (md !== null && mod === detail) {
				descriptionHtml = renderMarkdown(rewriteImagePaths(md, detail));
			}
		} catch (err) {
			// Network or fetch error -- silently fall back to mod.description,
			// but log so devs can spot misconfigured repoUrls.
			console.warn(`Failed to fetch description for mod '${detail.id}':`, err);
		}
	}

	$effect(() => {
		const modId = page.params.id;
		if (modId) {
			loadMod(modId);
		}
	});
</script>

<section class="mod-detail">
	<BackLink />

	{#if loading}
		<p class="status-message">{m.mod_detail_loading()}</p>
	{:else if error}
		<div class="error-block">
			<p class="status-message error">{error}</p>
			<button class="btn-secondary retry-button" onclick={() => { if (page.params.id) loadMod(page.params.id); }}>{m.retry()}</button>
		</div>
	{:else if mod}
		<div class="detail-header">
			<div class="header-content">
				<div class="title-row">
					<div class="title-block">
						<h1 class="mod-name">
							{#if mod.icon}<span class="mod-icon" aria-hidden="true">{mod.icon}</span>{/if}{mod.name}
						</h1>
						<p class="mod-author">
							{mod.author ? m.mod_detail_author({ author: mod.author }) : m.mod_detail_unknown_author()}
						</p>
						{#if mod.authorDiscord}
							<p class="discord-handle">
								<span class="discord-logo" aria-label="Discord" role="img"></span>
								{mod.authorDiscord}
							</p>
						{/if}
					</div>
					<div class="install-column">
						<InstallButton {mod} oninstalled={handleInstalled} />
						<div class="playable-label">
							<span>{m.playable_in_obsidian()}</span>
							<button
								class="whats-that"
								type="button"
								onclick={showObsidianIntro}
								aria-label={m.whats_that()}
							>?</button>
						</div>
					</div>
				</div>
				<!-- Short description from the manifest. -->
				<p class="mod-description">{mod.description}</p>
				{#if updateFromVersion}
					<p class="update-notice">
						{m.mod_update_explainer({ latest: mod.latestVersion, installed: updateFromVersion })}
					</p>
				{/if}
			</div>
		</div>

		{#if descriptionHtml}
			<section class="about-section">
				<h2 class="about-heading">{m.mod_detail_description_heading()}</h2>
				<!-- About this Mod.md fetched from the mod repo at the pinned commit. -->
				<!-- Rendered inside a shadow root by ModDescription so the EBR -->
				<!-- base-content CSS snippets cannot leak into surrounding app styles. -->
				<ModDescription html={descriptionHtml} />
			</section>
		{/if}

		<ModMetadata {mod} />

	{:else}
		<p class="status-message">{m.mod_detail_not_found()}</p>
	{/if}
</section>

<style>
	/* --- Header --- */

	.detail-header {
		margin-bottom: var(--spacing-md);
	}

	.title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-xs);
		flex-wrap: wrap;
	}

	.title-block {
		flex: 1 1 auto;
	}

	.mod-icon {
		font-size: 1.1em;
		line-height: 1;
		margin-right: var(--spacing-xs);
	}

	.mod-name {
		font-family: var(--font-display);
		font-size: var(--font-size-lg);
		font-weight: 700;
		color: var(--color-accent);
	}

	.mod-author {
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin-bottom: var(--spacing-xs);
	}

	.install-column {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-xs);
	}

	.playable-label {
		display: flex;
		align-items: center;
		gap: 0.4em;
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.whats-that {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		width: 1.15rem;
		height: 1.15rem;
		min-height: 0;
		padding: 0;
		flex: none;
		border: 1px solid var(--color-border);
		border-radius: 50%;
		background: none;
		color: var(--color-text-muted);
		font-size: 0.7rem;
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
		touch-action: manipulation;
		transition: color var(--transition-fast), border-color var(--transition-fast);
	}

	.whats-that:hover {
		color: var(--color-primary);
		border-color: var(--color-primary);
	}

	.discord-handle {
		display: inline-flex;
		align-items: center;
		gap: 0.4em;
		font-size: var(--font-size-sm);
		color: var(--color-text-muted);
		margin-bottom: var(--spacing-xs);
	}

	.discord-logo {
		display: inline-block;
		width: 1.1em;
		height: 1.1em;
		background-color: currentColor;
		mask-image: url('/discord-logo.svg');
		mask-repeat: no-repeat;
		mask-position: center;
		mask-size: contain;
		-webkit-mask-image: url('/discord-logo.svg');
		-webkit-mask-repeat: no-repeat;
		-webkit-mask-position: center;
		-webkit-mask-size: contain;
	}

	.mod-description {
		font-size: var(--font-size-base);
		line-height: 1.6;
		margin-top: var(--spacing-sm);
	}

	.update-notice {
		margin-top: var(--spacing-sm);
		padding: var(--spacing-sm) var(--spacing-md);
		border-radius: var(--radius);
		background: var(--color-surface);
		border: 1px solid var(--color-primary);
		color: var(--color-text);
		font-size: var(--font-size-sm);
	}

	/* --- About section --- */

	.about-heading {
		font-family: var(--font-display);
		font-size: var(--font-size-lg);
		font-weight: 700;
		margin-bottom: var(--spacing-sm);
		color: var(--color-accent);
	}

	.about-section {
		margin-top: var(--spacing-lg);
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
