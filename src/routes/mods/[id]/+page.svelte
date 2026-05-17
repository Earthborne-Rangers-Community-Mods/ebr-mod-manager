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
			<div class="safety-callout">
				<p class="safety-callout-title">{m.mod_detail_not_safe_mid_campaign()}</p>
				{#if mod.midCampaignNotes}
					<p class="safety-callout-notes">{mod.midCampaignNotes}</p>
				{/if}
			</div>
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

		<!-- Details section -->
		<div class="metadata">
			<div class="meta-section at-a-glance">
				<h3>{m.mod_detail_at_a_glance()}</h3>
				<dl class="facts">
					<dt>{m.mod_detail_type()}</dt>
					<dd class="capitalize">{mod.type}</dd>
					<dt>{m.mod_detail_version_label()}</dt>
					<dd>{mod.latestVersion}</dd>
					{#if mod.updatedAt}
						<dt>{m.mod_detail_updated_label()}</dt>
						<dd>{mod.updatedAt}</dd>
					{/if}
					{#if mod.language && mod.language !== 'en'}
						<dt>{m.mod_detail_language()}</dt>
						<dd>{mod.language.toUpperCase()}</dd>
					{/if}
				</dl>
			</div>

			{#if mod.campaigns.length > 0}
				<div class="meta-section span-2">
					<h3>{m.mod_detail_campaigns()}</h3>
					<ul class="tag-list">
						{#each mod.campaigns as campaign}
							<li class="tag">{resolveCampaignDisplayName(campaign)}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if mod.requiredProducts.length > 0}
				<div class="meta-section">
					<h3>{m.mod_detail_required_products()}</h3>
					<ul class="tag-list">
						{#each mod.requiredProducts as product}
							<li class="tag">{resolveProductDisplayName(product)}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if mod.optionalProducts && mod.optionalProducts.length > 0}
				<div class="meta-section">
					<h3>{m.mod_detail_optional_products()}</h3>
					<ul class="tag-list">
						{#each mod.optionalProducts as product}
							<li class="tag">{resolveProductDisplayName(product)}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if mod.includedMods && mod.includedMods.length > 0}
				<div class="meta-section">
					<h3>{m.mod_detail_built_from()}</h3>
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
					<h3>{m.mod_detail_tags()}</h3>
					<div class="tag-chips">
						{#each mod.tags as tag}
							<span class="tag-chip">{tag}</span>
						{/each}
					</div>
				</div>
			{/if}
		</div>

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
		font-size: var(--font-size-sm);
		color: var(--color-primary);
		margin-bottom: var(--spacing-lg);
		transition: color var(--transition-fast);
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.status-message {
		text-align: center;
		color: var(--color-text-muted);
		padding: var(--spacing-xl) 0;
	}

	.status-message.error {
		color: var(--color-error);
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

	/* --- Safety callout (shown when not safe to add mid-campaign) --- */

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

	/* --- Details / Metadata --- */

	.metadata {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--spacing-md) var(--spacing-lg);
		margin-top: var(--spacing-lg);
		margin-bottom: var(--spacing-xl);
		padding-top: var(--spacing-md);
		border-top: 1px solid var(--color-border);
	}

	@media (min-width: 600px) {
		.metadata {
			grid-template-columns: 1fr 1fr;
		}
	}

	.at-a-glance {
		grid-column: 1 / -1;
	}

	.span-2 {
		grid-column: 1 / -1;
	}

	.facts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--spacing-xs) var(--spacing-md);
		font-size: var(--font-size-sm);
	}

	.facts dt {
		color: var(--color-text-muted);
	}

	.facts dd {
		color: var(--color-text);
	}

	.facts .capitalize {
		text-transform: capitalize;
	}

	.meta-section h3 {
		font-family: var(--font-display);
		font-size: var(--font-size-sm);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		margin-bottom: var(--spacing-sm);
		color: var(--color-text-muted);
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

	.tag-list {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}

	.tag {
		font-size: var(--font-size-xs);
		padding: 3px var(--spacing-sm);
		border-radius: var(--radius-full);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		color: var(--color-text);
	}

	.included-mods-list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-xs);
	}

	.included-mod {
		font-size: var(--font-size-sm);
		padding: var(--spacing-xs) var(--spacing-sm);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
	}

	.tag-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-xs);
	}

	.tag-chip {
		font-size: var(--font-size-xs);
		padding: 2px var(--spacing-sm);
		border-radius: var(--radius-full);
		background: var(--color-border);
		color: var(--color-text-muted);
	}

</style>
