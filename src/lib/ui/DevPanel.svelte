<script lang="ts">
	import {
		getToken,
		setToken,
		clearToken,
		getBaseContentToken,
		setBaseContentToken,
		clearBaseContentToken,
	} from '$lib/devsettings.js';
	import * as m from '$lib/paraglide/messages.js';

	let tokenInput = $state(getToken() ?? '');
	let saved = $state(false);
	let hasToken = $state(!!getToken());

	let baseContentTokenInput = $state(getBaseContentToken() ?? '');
	let baseContentSaved = $state(false);
	let hasBaseContentToken = $state(!!getBaseContentToken());

	function handleSave() {
		const trimmed = tokenInput.trim();
		if (trimmed) {
			setToken(trimmed);
		} else {
			clearToken();
		}
		hasToken = !!getToken();
		saved = true;
		setTimeout(() => (saved = false), 1500);
	}

	function handleClear() {
		clearToken();
		tokenInput = '';
		hasToken = false;
		saved = false;
	}

	function handleSaveBaseContent() {
		const trimmed = baseContentTokenInput.trim();
		if (trimmed) {
			setBaseContentToken(trimmed);
		} else {
			clearBaseContentToken();
		}
		hasBaseContentToken = !!getBaseContentToken();
		baseContentSaved = true;
		setTimeout(() => (baseContentSaved = false), 1500);
	}

	function handleClearBaseContent() {
		clearBaseContentToken();
		baseContentTokenInput = '';
		hasBaseContentToken = false;
		baseContentSaved = false;
	}

	let { onclose }: { onclose: () => void } = $props();
</script>

<aside class="dev-panel">
	<div class="dev-header">
		<span class="dev-title">Dev Panel</span>
		<button class="dev-close" onclick={onclose}>X</button>
	</div>
	<p class="dev-explanation">
		{m.dev_panel_explanation()}
	</p>

	<details class="dev-pat-help">
		<summary>How to create a fine-grained PAT</summary>
		<p class="dev-hint">
			Both tokens below are
			<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">
				fine-grained personal access tokens</a>.
			Same general flow for both - only <em>Resource owner</em> and
			<em>Repository access</em> change.
		</p>
		<ol class="dev-steps">
			<li>
				Open
				<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">
					github.com/settings/personal-access-tokens/new</a>.
			</li>
			<li>
				Set <em>Resource owner</em>:
				<ul>
					<li><strong>Per-mod token</strong> - your own GitHub user (the mod author's account).</li>
					<li>
						<strong>Base-content token</strong> -
						<code>Earthborne-Rangers-Community-Mods</code>.
					</li>
				</ul>
			</li>
			<li>
				Under <em>Repository access</em>, choose
				<em>Only select repositories</em> and pick:
				<ul>
					<li><strong>Per-mod token</strong> - the mod's content repo.</li>
					<li><strong>Base-content token</strong> - <code>ebr-mod-base-content</code>.</li>
				</ul>
			</li>
			<li>
				Under <em>Permissions -> Repository permissions</em>, set
				<em>Contents</em> to <em>Read-only</em>. Leave everything else at
				<em>No access</em>.
			</li>
			<li>
				Submit. For the org-scoped base-content token, an org admin must
				<em>approve</em> the request before it works (visible under
				Org Settings -> Personal access tokens -> Pending requests).
			</li>
			<li>
				Copy the <code>github_pat_...</code> value and paste it into the
				matching field below.
			</li>
		</ol>
	</details>

	<div class="dev-body">
		<label class="dev-label">
			Per-mod repo token
			<p class="dev-hint">
				Used to read the mod's <code>About this Mod.md</code> and other
				files from its content repo at the pinned commit.
			</p>
			<div class="token-row">
				<input
					type="password"
					class="dev-input"
					placeholder="github_pat_..."
					bind:value={tokenInput}
				/>
				<button class="dev-btn" onclick={handleSave}>Save</button>
				<button class="dev-btn secondary" onclick={handleClear}>Clear</button>
			</div>
			{#if saved}
				<span class="dev-saved">Saved</span>
			{/if}
			{#if hasToken}
				<span class="dev-status set">Token set</span>
			{:else}
				<span class="dev-status unset">No token</span>
			{/if}
		</label>

		<label class="dev-label">
			Base-content (org) token
			<p class="dev-hint">
				Used to fetch the EBR base-content CSS snippets from
				<code>Earthborne-Rangers-Community-Mods/ebr-mod-base-content</code>
				while that repo is private. Separate from the per-mod token because
				it needs org-scope access.
			</p>
			<div class="token-row">
				<input
					type="password"
					class="dev-input"
					placeholder="github_pat_..."
					bind:value={baseContentTokenInput}
				/>
				<button class="dev-btn" onclick={handleSaveBaseContent}>Save</button>
				<button class="dev-btn secondary" onclick={handleClearBaseContent}>Clear</button>
			</div>
			{#if baseContentSaved}
				<span class="dev-saved">Saved</span>
			{/if}
			{#if hasBaseContentToken}
				<span class="dev-status set">Token set</span>
			{:else}
				<span class="dev-status unset">No token</span>
			{/if}
		</label>
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

	.dev-label {
		display: block;
		color: var(--color-text-muted);
		font-size: var(--font-size-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.dev-hint {
		font-weight: 400;
		text-transform: none;
		letter-spacing: normal;
		line-height: 1.4;
		margin: var(--spacing-xs) 0;
	}

	.dev-hint a {
		color: var(--color-primary);
	}

	.dev-steps {
		font-weight: 400;
		text-transform: none;
		letter-spacing: normal;
		line-height: 1.4;
		margin: var(--spacing-xs) 0 var(--spacing-xs) 1.25rem;
		padding: 0;
	}

	.dev-steps li {
		margin-bottom: var(--spacing-xs);
	}

	.dev-steps ul {
		font-weight: 400;
		text-transform: none;
		letter-spacing: normal;
		margin: 2px 0 var(--spacing-xs) var(--spacing-md);
		padding: 0;
		list-style: disc;
	}

	.dev-steps ul li {
		margin-bottom: 2px;
	}

	.dev-pat-help {
		margin-bottom: var(--spacing-sm);
		font-size: var(--font-size-xs);
		color: var(--color-text-muted);
	}

	.dev-pat-help summary {
		cursor: pointer;
		color: var(--color-primary);
		font-weight: 600;
		padding: var(--spacing-xs) 0;
	}

	.dev-pat-help summary:hover {
		text-decoration: underline;
	}

	.dev-steps a {
		color: var(--color-primary);
	}

	.dev-steps code,
	.dev-hint code {
		font-family: var(--font-mono, monospace);
		font-size: 0.85em;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 3px;
		padding: 0 var(--spacing-xs);
	}

	.dev-body > .dev-label + .dev-label {
		margin-top: var(--spacing-sm);
		padding-top: var(--spacing-sm);
		border-top: 1px solid var(--color-border);
	}

	.token-row {
		display: flex;
		gap: var(--spacing-xs);
		margin-top: var(--spacing-xs);
		align-items: center;
	}

	.dev-input {
		font: inherit;
		font-size: var(--font-size-sm);
		padding: var(--spacing-xs) var(--spacing-sm);
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		background: var(--color-bg);
		color: var(--color-text);
		flex: 1;
		max-width: 20rem;
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

	.dev-btn.secondary {
		background: var(--color-border);
		color: var(--color-text-muted);
	}

	.dev-btn:hover {
		opacity: 0.85;
	}

	.dev-saved {
		color: var(--color-success);
		margin-left: var(--spacing-sm);
		font-size: var(--font-size-xs);
	}

	.dev-status {
		display: inline-block;
		margin-top: var(--spacing-xs);
		font-size: var(--font-size-xs);
	}

	.dev-status.set {
		color: var(--color-success);
	}

	.dev-status.unset {
		color: var(--color-text-muted);
	}
</style>
