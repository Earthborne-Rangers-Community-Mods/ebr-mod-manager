<script lang="ts">
	import { resolve, asset } from '$app/paths';
	import '../app.css';
	import * as m from '$lib/paraglide/messages.js';
	import DevPanel from '$lib/ui/DevPanel.svelte';
	import ThemeToggle from '$lib/ui/ThemeToggle.svelte';
	import ObsidianButton from '$lib/ui/ObsidianButton.svelte';
	import ObsidianExplainer from '$lib/ui/ObsidianExplainer.svelte';
	import DisclaimerFooter from '$lib/ui/DisclaimerFooter.svelte';
	import { isDevPanelOpen, setDevPanelOpen } from '$lib/devsettings.js';
	import { obsidianIntroOpen } from '$lib/obsidian-intro.js';
	import { initTheme } from '$lib/theme.js';
	import { Capacitor } from '@capacitor/core';
	import { Browser } from '@capacitor/browser';

	let { children } = $props();

	let showDevPanel = $state(isDevPanelOpen());

	initTheme();

	function toggleDevPanel() {
		showDevPanel = !showDevPanel;
		setDevPanelOpen(showDevPanel);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.ctrlKey && e.key === '`') {
			e.preventDefault();
			toggleDevPanel();
		}
	}

	// On native (Capacitor) platforms, <a target="_blank"> is silently
	// dropped: the WebView fires onCreateWindow (Android) or
	// createWebViewWith (iOS), Capacitor doesn't implement either
	// delegate, and the navigation goes nowhere -- the click appears
	// dead. Intercept clicks on external http(s) links and route them
	// through the Capacitor Browser plugin (Custom Tabs on Android,
	// SFSafariViewController on iOS). On the web, links work as
	// authored and this handler is a no-op.
	function handleDocumentClick(e: MouseEvent) {
		if (!Capacitor.isNativePlatform()) return;
		if (e.defaultPrevented) return;
		if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
		const target = e.target;
		if (!(target instanceof Element)) return;
		const anchor = target.closest('a');
		if (!anchor) return;
		const href = anchor.getAttribute('href');
		if (!href || !/^https?:\/\//i.test(href)) return;
		e.preventDefault();
		void Browser.open({ url: href });
	}

	const TAP_COUNT = 5;
	const TAP_WINDOW_MS = 2000;
	let tapTimestamps: number[] = [];

	function handleHeaderTap(e: MouseEvent) {
		// Only enable the tap-to-open-dev-panel gesture on touch devices
		if (!('ontouchstart' in window)) return;
		const now = Date.now();
		tapTimestamps.push(now);
		// Keep only taps within the time window
		tapTimestamps = tapTimestamps.filter((t) => now - t < TAP_WINDOW_MS);
		if (tapTimestamps.length >= TAP_COUNT) {
			e.preventDefault();
			tapTimestamps = [];
			toggleDevPanel();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />
<svelte:document onclick={handleDocumentClick} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<header class="app-header" onclick={handleHeaderTap}>
	<div class="container header-inner">
		<a href="{resolve('/')}" class="logo">
			<img src={asset('/icon.png')} alt="" class="logo-icon" aria-hidden="true" />
			<span>{m.app_title()}</span>
		</a>
		<div class="header-actions">
			<ObsidianButton />
			<ThemeToggle />
		</div>
	</div>
</header>

<main class="container">
	{@render children()}
</main>

<DisclaimerFooter />

{#if $obsidianIntroOpen}
	<ObsidianExplainer />
{/if}

{#if showDevPanel}
	<DevPanel onclose={toggleDevPanel} />
{/if}

<style>
	.app-header {
		border-bottom: 1px solid var(--color-border);
		padding: var(--spacing-sm) 0;
		margin-bottom: var(--spacing-lg);
		-webkit-tap-highlight-color: transparent;
		user-select: none;
		background: var(--color-surface);
		transition: background var(--transition-normal), border-color var(--transition-normal);
	}

	.header-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: var(--spacing-sm);
	}

	.logo {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-sm);
		font-family: var(--font-display);
		font-size: var(--font-size-md);
		font-weight: 700;
		color: var(--color-accent);
		letter-spacing: 0.01em;
	}

	.logo-icon {
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
	}

	.logo:hover {
		text-decoration: none;
	}

	main {
		flex: 1;
		padding-bottom: var(--spacing-xl);
	}
</style>
