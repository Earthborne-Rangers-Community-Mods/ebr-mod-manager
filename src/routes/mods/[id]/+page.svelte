<script lang="ts">
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages.js';
	import {
		fetchModDetail,
		fetchDescription,
		rewriteImagePaths,
		type ModDetail,
	} from '$lib/registry.js';
	import { renderMarkdown } from '$lib/markdown.js';
	import { getToken } from '$lib/devsettings.js';
	import InstallButton from '$lib/ui/InstallButton.svelte';
	import ModDescription from '$lib/ui/ModDescription.svelte';
	import ModMetadata from '$lib/ui/ModMetadata.svelte';
	import SafetyCallout from '$lib/ui/SafetyCallout.svelte';
	import BackLink from '$lib/ui/BackLink.svelte';

	let mod = $state<ModDetail | null>(null);
	let loading = $state(true);
	let error = $state('');
	let descriptionHtml = $state<string | null>(null);

	async function loadMod(modId: string) {
		loading = true;
		error = '';
		mod = null;
		descriptionHtml = null;

		try {
			mod = await fetchModDetail(modId);
		} catch {
			error = m.mod_detail_fetch_error();
			loading = false;
			return;
		}
		loading = false;

		// Fetch the description page in the background. A missing or failed
		// fetch falls through to the manifest's short description -- the
		// detail view stays usable either way. When a GitHub PAT is set in
		// the dev panel we forward it so private mod repos can be read.
		const detail = mod;
		const token = getToken() ?? undefined;
		try {
			const md = await fetchDescription(detail, token);
			if (md !== null && mod === detail) {
				descriptionHtml = renderMarkdown(rewriteImagePaths(md, detail));
			}
		} catch (err) {
			// Network or fetch error -- silently fall back to mod.description,
			// but log so devs can spot misconfigured repoUrls / missing tokens.
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
		<p class="status-message error">{error}</p>
	{:else if mod}
		<div class="detail-header">
			<div class="header-content">
				<div class="title-row">
					<h1 class="mod-name">
						{#if mod.icon}<span class="mod-icon" aria-hidden="true">{mod.icon}</span>{/if}{mod.name}
					</h1>
					<InstallButton {mod} />
				</div>
				<p class="mod-author">
					{mod.author ? m.mod_detail_author({ author: mod.author }) : m.mod_detail_unknown_author()}
				</p>
				{#if mod.authorDiscord}
					<p class="discord-handle">
						<span class="discord-logo" aria-label="Discord" role="img"></span>
						{mod.authorDiscord}
					</p>
				{/if}
				<!-- Short description from the manifest. -->
				<p class="mod-description">{mod.description}</p>
			</div>
		</div>

		{#if !mod.safeToAddMidCampaign}
			<SafetyCallout notes={mod.midCampaignNotes} />
		{/if}

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
	.mod-detail {
		max-width: 720px;
	}

	/* --- Header --- */

	.detail-header {
		margin-bottom: var(--spacing-md);
	}

	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-xs);
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
</style>
