import type { ExtractedFile } from './extraction.js';

// Trusted, version-pinned copy of the "Read Only View" Obsidian community plugin
// (https://github.com/mrKazzila/obsidian-read-only-plugin). The binary is
// vendored verbatim under ../../vendor/read-only-view and inlined here at build
// time, so it ships with the app and never travels with downloaded mod content.
// To update: drop the new release files into vendor/read-only-view and rebuild.
import mainJs from '../../vendor/read-only-view/main.js?raw';
import manifestJson from '../../vendor/read-only-view/manifest.json?raw';
import stylesCss from '../../vendor/read-only-view/styles.css?raw';
import dataJson from '../../vendor/read-only-view/data.json?raw';

/** Obsidian plugin id of the bundled read-only plugin. */
export const READ_ONLY_VIEW_PLUGIN_ID = 'read-only-view';

/** Vault-relative directory the plugin is installed into. */
const PLUGIN_DIR = `.obsidian/plugins/${READ_ONLY_VIEW_PLUGIN_ID}`;

/** Vault-relative root of all Obsidian plugins. */
const PLUGINS_ROOT = '.obsidian/plugins/';

/** Vault-relative path of Obsidian's enabled-community-plugins list. */
const COMMUNITY_PLUGINS_PATH = '.obsidian/community-plugins.json';

function utf8(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

/**
 * The bundled read-only-view plugin as a list of files ready for vault writing.
 * Each call produces fresh Uint8Array data so callers may transfer or mutate it
 * without affecting later calls.
 */
export function readOnlyViewPluginFiles(): ExtractedFile[] {
	return [
		{ path: `${PLUGIN_DIR}/main.js`, data: utf8(mainJs) },
		{ path: `${PLUGIN_DIR}/manifest.json`, data: utf8(manifestJson) },
		{ path: `${PLUGIN_DIR}/styles.css`, data: utf8(stylesCss) },
		{ path: `${PLUGIN_DIR}/data.json`, data: utf8(dataJson) },
	];
}

/**
 * Inject the trusted read-only-view plugin into an extracted mod file list.
 *
 * Run this after the security strip (extraction's plugin blocklist), never
 * before: the strip removes any plugin a mod tried to smuggle in, then this
 * adds back the one trusted plugin the app controls. As a defense in depth,
 * this independently re-enforces the plugin-related half of extraction's
 * blocklist (see `isBlocked` in extraction.ts): every `.obsidian/plugins/`
 * entry and any `community-plugins.json` in the input is dropped before the
 * trusted plugin is appended, so read-only-view is the only plugin that can
 * reach the vault even if the upstream strip ever regresses.
 *
 * Writes the plugin directory and a community-plugins.json that enables it, so
 * mod content opens read-only when the vault is first opened in Obsidian.
 */
export function injectReadOnlyView(files: ExtractedFile[]): ExtractedFile[] {
	const pluginsRootLower = PLUGINS_ROOT.toLowerCase();
	const communityPluginsLower = COMMUNITY_PLUGINS_PATH.toLowerCase();

	const kept = files.filter((file) => {
		const path = file.path.toLowerCase();
		return path !== communityPluginsLower && !path.startsWith(pluginsRootLower);
	});

	const communityPlugins: ExtractedFile = {
		path: COMMUNITY_PLUGINS_PATH,
		data: utf8(JSON.stringify([READ_ONLY_VIEW_PLUGIN_ID]) + '\n'),
	};

	return [...kept, ...readOnlyViewPluginFiles(), communityPlugins];
}
