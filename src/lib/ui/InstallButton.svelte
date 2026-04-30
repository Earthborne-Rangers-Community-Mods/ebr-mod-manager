<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { downloadModZip, type DownloadProgress } from '$lib/download.js';
	import { extractModZipAsync, repackageModZipAsync } from '$lib/extraction.js';
	import {
		getInstallMethod,
		isAndroidBrowser,
		pickVaultTarget,
		checkVault,
		clearVault,
		writeVaultFiles,
		setInstalledMod,
	} from '$lib/vault.js';
	import { PathTraversalError, ModDownloadError, VaultDirectoryMissingError } from '$lib/errors.js';
	import { getToken } from '$lib/devsettings.js';
	import type { ModDetail } from '$lib/registry.js';

	interface Props {
		mod: ModDetail;
	}

	let { mod }: Props = $props();

	let downloading = $state(false);
	let downloadProgress = $state<DownloadProgress | null>(null);
	let downloadError = $state<string | null>(null);
	let downloadComplete = $state(false);
	let writeProgress = $state<string | null>(null);

	async function handleDownload() {
		if (downloading) return;
		downloading = true;
		downloadProgress = null;
		downloadError = null;
		downloadComplete = false;
		writeProgress = null;

		try {
			const token = getToken() ?? undefined;
			const method = getInstallMethod();

			if (method === 'vault-write') {
				const target = await pickVaultTarget(mod.id);
				const status = await checkVault(target);

				if (status === 'unrecognized') {
					downloadError = m.error_vault_safety();
					return;
				}

				if (status === 'existing-vault') {
					const ok = confirm(m.confirm_replace_vault({ modName: mod.name }));
					if (!ok) return;
				}

				const zipBuffer = await downloadModZip(mod, {
					token,
					onProgress: (p) => {
						downloadProgress = p;
					},
				});

				writeProgress = m.extracting_mod();
				const files = await extractModZipAsync(zipBuffer);

				writeProgress = m.clearing_vault();
				await clearVault(target, {
					onProgress: (deleted, total) => {
						writeProgress = m.clearing_vault_progress({ deleted, total });
					},
				});
				writeProgress = m.writing_vault_progress({ written: 0, total: files.length });
				await writeVaultFiles(target, files, {
					onProgress: (written, total) => {
						writeProgress = m.writing_vault_progress({ written, total });
					},
				});

				setInstalledMod({
					id: mod.id,
					name: mod.name,
					version: mod.latestVersion,
					commitHash: mod.commitHash,
				});

				downloadComplete = true;
			} else {
				const zipBuffer = await downloadModZip(mod, {
					token,
					onProgress: (p) => {
						downloadProgress = p;
					},
				});

				const cleanZip = await repackageModZipAsync(zipBuffer);
				const blob = new Blob([cleanZip as BlobPart], { type: 'application/zip' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${mod.id}.zip`;
				a.click();
				URL.revokeObjectURL(url);
				downloadComplete = true;
			}
		} catch (err) {
			console.error('Mod install failed:', err);
			if (err instanceof PathTraversalError) {
				downloadError = m.error_extraction_security();
			} else if (err instanceof VaultDirectoryMissingError) {
				downloadError = m.error_vault_removed();
			} else if (err instanceof DOMException && err.name === 'AbortError') {
				downloadError = null;
			} else if (err instanceof ModDownloadError) {
				if (err.httpStatus >= 500) {
					downloadError = m.error_download_server();
				} else if (err.httpStatus === 404 || err.httpStatus === 403) {
					downloadError = m.error_download_not_found();
				} else {
					downloadError = m.error_download_failed();
				}
			} else if (err instanceof TypeError && (err as TypeError).message.includes('fetch')) {
				downloadError = m.error_download_network();
			} else {
				downloadError = m.error_download_failed();
			}
		} finally {
			downloading = false;
			downloadProgress = null;
			writeProgress = null;
		}
	}
</script>

<div class="install-section">
	{#if isAndroidBrowser()}
		<span class="android-browser-message">{m.android_browser_install_blocked()}</span>
	{:else if downloading}
		<button class="install-button" disabled>
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
	{:else if downloadComplete}
		<span class="download-success">{m.vault_write_complete()}</span>
	{:else}
		<button class="install-button" onclick={handleDownload}>
			{m.install_button()}
		</button>
	{/if}
	{#if downloadError}
		<span class="download-error">{downloadError}</span>
	{/if}
</div>

<style>
	.install-section {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
	}

	.install-button {
		font-size: 1rem;
		padding: 0.625rem 2rem;
		min-height: 2.75rem;
		background: var(--color-primary);
		color: #fff;
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
		font-weight: 600;
		transition: opacity 0.15s;
		touch-action: manipulation;
	}

	.install-button:hover:not(:disabled) {
		opacity: 0.85;
	}

	.install-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.download-success {
		font-size: 0.875rem;
		color: #2a9d2a;
		font-weight: 500;
	}

	.download-error {
		font-size: 0.875rem;
		color: var(--color-error);
	}

	.android-browser-message {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		font-style: italic;
	}
</style>
