<script lang="ts">
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages.js';
	import {
		fetchModDetail,
		fetchDescription,
		coverImageUrl,
		rewriteImagePaths,
		type ModDetail,
	} from '$lib/registry.js';
	import { renderMarkdown } from '$lib/markdown.js';
	import { resolveCampaignDisplayName, resolveProductDisplayName } from '$lib/catalogs.js';
	import { getToken } from '$lib/devsettings.js';
	import InstallButton from '$lib/ui/InstallButton.svelte';
	import ModDescription from '$lib/ui/ModDescription.svelte';

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
	<a href="/" class="back-link">&larr; {m.back_to_browse()}</a>

	{#if loading}
		<p class="status-message">{m.mod_detail_loading()}</p>
	{:else if error}
		<p class="status-message error">{error}</p>
	{:else if mod}
		<div class="detail-header">
			{#if coverImageUrl(mod)}
				<img
					class="cover-image"
					src={coverImageUrl(mod)}
					alt="{mod.name} cover image"
					loading="lazy"
				/>
			{/if}
			<div class="header-content">
				<div class="title-row">
					<div class="title-group">
						{#if mod.icon}
							<span class="mod-icon">{mod.icon}</span>
						{/if}
						<h1 class="mod-name">{mod.name}</h1>
					</div>
					<InstallButton {mod} />
				</div>
				<p class="mod-author">
					{mod.author ? m.mod_detail_author({ author: mod.author }) : m.mod_detail_unknown_author()}
					{#if mod.authorDiscord}
						<span class="discord-handle">{m.mod_detail_discord({ handle: mod.authorDiscord })}</span>
					{/if}
				</p>
				<p class="mod-version">{m.mod_detail_version({ version: mod.latestVersion })}</p>
				<div class="mod-badges">
					<span class="mod-type-badge">{mod.type}</span>
					{#if mod.safeToAddMidCampaign}
						<span class="mod-safety safe">{m.mod_detail_safe_mid_campaign()}</span>
					{:else}
						<span class="mod-safety unsafe">{m.mod_detail_not_safe_mid_campaign()}</span>
					{/if}
					{#if mod.language && mod.language !== 'en'}
						<span class="mod-language-badge">{m.mod_detail_language()}: {mod.language.toUpperCase()}</span>
					{/if}
				</div>
				{#if mod.updatedAt}
					<p class="mod-updated">{m.mod_detail_updated({ date: mod.updatedAt })}</p>
				{/if}
			</div>
		</div>

		<!-- Short description from the manifest. The full About this Mod.md -->
		<!-- (when available) renders at the bottom of the page below all -->
		<!-- metadata sections. -->
		<p class="mod-description">{mod.description}</p>

		<!-- Metadata sections -->
		<div class="metadata">
			{#if mod.campaigns.length > 0}
				<div class="meta-section">
					<h2>{m.mod_detail_campaigns()}</h2>
					<ul class="tag-list">
						{#each mod.campaigns as campaign}
							<li class="tag">{resolveCampaignDisplayName(campaign)}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if mod.requiredProducts.length > 0}
				<div class="meta-section">
					<h2>{m.mod_detail_required_products()}</h2>
					<ul class="tag-list">
						{#each mod.requiredProducts as product}
							<li class="tag">{resolveProductDisplayName(product)}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if mod.optionalProducts && mod.optionalProducts.length > 0}
				<div class="meta-section">
					<h2>{m.mod_detail_optional_products()}</h2>
					<ul class="tag-list">
						{#each mod.optionalProducts as product}
							<li class="tag">{resolveProductDisplayName(product)}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if !mod.safeToAddMidCampaign && mod.midCampaignNotes}
				<div class="meta-section">
					<h2>{m.mod_detail_mid_campaign_notes()}</h2>
					<p class="meta-notes">{mod.midCampaignNotes}</p>
				</div>
			{/if}

			{#if mod.includedMods && mod.includedMods.length > 0}
				<div class="meta-section">
					<h2>{m.mod_detail_built_from()}</h2>
					<ul class="included-mods-list">
						{#each mod.includedMods as included}
							<li class="included-mod">
								{m.mod_detail_built_from_entry({
									name: included.name,
									version: included.version,
									author: included.author,
								})}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if mod.tags && mod.tags.length > 0}
				<div class="meta-section">
					<h2>{m.mod_detail_tags()}</h2>
					<div class="tag-chips">
						{#each mod.tags as tag}
							<span class="tag-chip">{tag}</span>
						{/each}
					</div>
				</div>
			{/if}
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

	{:else}
		<p class="status-message">{m.mod_detail_not_found()}</p>
	{/if}
</section>

<style>
	.mod-detail {
		max-width: 720px;
	}

	.back-link {
		display: inline-block;
		font-size: 0.875rem;
		color: var(--color-primary);
		margin-bottom: 1.5rem;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.status-message {
		text-align: center;
		color: var(--color-text-muted);
		padding: 2rem 0;
	}

	.status-message.error {
		color: var(--color-error);
	}

	/* --- Header --- */

	.detail-header {
		margin-bottom: 1.25rem;
	}

	.cover-image {
		width: 100%;
		max-height: 300px;
		object-fit: cover;
		border-radius: var(--radius);
		margin-bottom: 1rem;
	}

	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.25rem;
	}

	.title-group {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.mod-icon {
		font-size: 2rem;
		line-height: 1;
	}

	.mod-name {
		font-size: 1.5rem;
		font-weight: 700;
	}

	.mod-author {
		font-size: 0.9375rem;
		color: var(--color-text-muted);
		margin-bottom: 0.25rem;
	}

	.discord-handle {
		margin-left: 0.5rem;
		font-size: 0.8125rem;
		opacity: 0.75;
	}

	.mod-version {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin-bottom: 0.5rem;
	}

	.mod-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 0.375rem;
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

	.mod-language-badge {
		font-size: 0.75rem;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		background: var(--color-border);
		color: var(--color-text-muted);
	}

	.mod-updated {
		font-size: 0.8125rem;
		color: var(--color-text-muted);
	}

	.mod-description {
		font-size: 1rem;
		line-height: 1.6;
		margin-bottom: 1.25rem;
	}

	/* --- Metadata --- */

	.metadata {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		margin-bottom: 2rem;
	}

	.meta-section h2 {
		font-size: 0.9375rem;
		font-weight: 600;
		margin-bottom: 0.375rem;
		color: var(--color-text);
	}

	/* --- About section --- */

	.about-heading {
		font-size: 1.75rem;
		font-weight: 700;
		margin-top: 1rem;
		margin-bottom: 0.75rem;
		color: var(--color-text);
	}

	.tag-list {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.tag {
		font-size: 0.8125rem;
		padding: 0.1875rem 0.625rem;
		border-radius: 999px;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		color: var(--color-text);
	}

	.meta-notes {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		line-height: 1.5;
	}

	.included-mods-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.included-mod {
		font-size: 0.875rem;
		padding: 0.375rem 0.75rem;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
	}

	.tag-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.tag-chip {
		font-size: 0.75rem;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		background: var(--color-border);
		color: var(--color-text-muted);
	}

</style>
