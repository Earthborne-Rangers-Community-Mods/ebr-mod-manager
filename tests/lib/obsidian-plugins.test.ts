import { describe, it, expect } from 'vitest';
import {
	READ_ONLY_VIEW_PLUGIN_ID,
	readOnlyViewPluginFiles,
	injectReadOnlyView,
} from '$lib/obsidian-plugins.js';
import type { ExtractedFile } from '$lib/extraction.js';

const PLUGIN_DIR = `.obsidian/plugins/${READ_ONLY_VIEW_PLUGIN_ID}`;
const COMMUNITY_PLUGINS_PATH = '.obsidian/community-plugins.json';

function decode(data: Uint8Array): string {
	return new TextDecoder().decode(data);
}

function pathsOf(files: ExtractedFile[]): string[] {
	return files.map((f) => f.path);
}

describe('readOnlyViewPluginFiles', () => {
	it('returns the four bundled plugin files at the plugin directory', () => {
		const files = readOnlyViewPluginFiles();
		expect(pathsOf(files).sort()).toEqual(
			[
				`${PLUGIN_DIR}/main.js`,
				`${PLUGIN_DIR}/manifest.json`,
				`${PLUGIN_DIR}/styles.css`,
				`${PLUGIN_DIR}/data.json`,
			].sort(),
		);
	});

	it('bundles non-empty data for every file', () => {
		for (const file of readOnlyViewPluginFiles()) {
			expect(file.data.byteLength).toBeGreaterThan(0);
		}
	});

	it('bundles a manifest whose id matches the plugin id', () => {
		const manifest = readOnlyViewPluginFiles().find((f) => f.path.endsWith('manifest.json'));
		expect(manifest).toBeDefined();
		const parsed = JSON.parse(decode(manifest!.data));
		expect(parsed.id).toBe(READ_ONLY_VIEW_PLUGIN_ID);
	});

	it('produces fresh data buffers on each call (no shared mutable state)', () => {
		const first = readOnlyViewPluginFiles();
		const second = readOnlyViewPluginFiles();
		expect(first[0].data).not.toBe(second[0].data);
		expect(decode(first[0].data)).toBe(decode(second[0].data));
	});

	it('bundles a data.json that enables the plugin for all files', () => {
		const dataFile = readOnlyViewPluginFiles().find((f) => f.path.endsWith('data.json'));
		expect(dataFile).toBeDefined();
		const parsed = JSON.parse(decode(dataFile!.data));
		expect(parsed.enabled).toBe(true);
		expect(parsed.includeRules).toContain('**');
	});
});

describe('injectReadOnlyView', () => {
	const modFiles: ExtractedFile[] = [
		{ path: 'ebr-mod.json', data: new TextEncoder().encode('{}') },
		{ path: 'Missions/mission-1.md', data: new TextEncoder().encode('# Mission') },
		{ path: '.obsidian/snippets/ebr-symbols.css', data: new TextEncoder().encode('.x{}') },
	];

	it('preserves the original mod files', () => {
		const result = injectReadOnlyView(modFiles);
		for (const original of modFiles) {
			expect(pathsOf(result)).toContain(original.path);
		}
	});

	it('adds the plugin directory files', () => {
		const result = injectReadOnlyView(modFiles);
		expect(pathsOf(result)).toContain(`${PLUGIN_DIR}/main.js`);
		expect(pathsOf(result)).toContain(`${PLUGIN_DIR}/manifest.json`);
		expect(pathsOf(result)).toContain(`${PLUGIN_DIR}/styles.css`);
		expect(pathsOf(result)).toContain(`${PLUGIN_DIR}/data.json`);
	});

	it('enables only read-only-view in community-plugins.json', () => {
		const result = injectReadOnlyView(modFiles);
		const community = result.find((f) => f.path === COMMUNITY_PLUGINS_PATH);
		expect(community).toBeDefined();
		expect(JSON.parse(decode(community!.data))).toEqual([READ_ONLY_VIEW_PLUGIN_ID]);
	});

	it('overrides a community-plugins.json that slipped past the strip', () => {
		const withSmuggled: ExtractedFile[] = [
			...modFiles,
			{
				path: COMMUNITY_PLUGINS_PATH,
				data: new TextEncoder().encode(JSON.stringify(['evil-plugin'])),
			},
		];
		const result = injectReadOnlyView(withSmuggled);

		const community = result.filter((f) => f.path === COMMUNITY_PLUGINS_PATH);
		expect(community).toHaveLength(1);
		expect(JSON.parse(decode(community[0].data))).toEqual([READ_ONLY_VIEW_PLUGIN_ID]);
	});

	it('overrides plugin-directory files that slipped past the strip', () => {
		const withSmuggled: ExtractedFile[] = [
			...modFiles,
			{ path: `${PLUGIN_DIR}/main.js`, data: new TextEncoder().encode('alert(1)') },
		];
		const result = injectReadOnlyView(withSmuggled);

		const mains = result.filter((f) => f.path === `${PLUGIN_DIR}/main.js`);
		expect(mains).toHaveLength(1);
		expect(decode(mains[0].data)).not.toBe('alert(1)');
	});

	it('drops smuggled entries regardless of path casing', () => {
		const withSmuggled: ExtractedFile[] = [
			...modFiles,
			{
				path: `.obsidian/plugins/${READ_ONLY_VIEW_PLUGIN_ID.toUpperCase()}/main.js`,
				data: new TextEncoder().encode('alert(1)'),
			},
			{ path: '.OBSIDIAN/Community-Plugins.json', data: new TextEncoder().encode('["x"]') },
		];
		const result = injectReadOnlyView(withSmuggled);

		for (const file of result) {
			expect(decode(file.data)).not.toBe('alert(1)');
			expect(decode(file.data)).not.toBe('["x"]');
		}
	});

	it('drops a smuggled non-read-only plugin that slipped past the strip', () => {
		const withSmuggled: ExtractedFile[] = [
			...modFiles,
			{ path: '.obsidian/plugins/evil-plugin/main.js', data: new TextEncoder().encode('alert(1)') },
			{ path: '.obsidian/plugins/evil-plugin/manifest.json', data: new TextEncoder().encode('{}') },
		];
		const result = injectReadOnlyView(withSmuggled);

		// No plugin path survives except the trusted read-only-view directory.
		const pluginPaths = pathsOf(result).filter((p) => p.startsWith('.obsidian/plugins/'));
		for (const p of pluginPaths) {
			expect(p.startsWith(`${PLUGIN_DIR}/`)).toBe(true);
		}
		for (const file of result) {
			expect(decode(file.data)).not.toBe('alert(1)');
		}
	});

	it('does not mutate the input array', () => {
		const input = [...modFiles];
		const length = input.length;
		injectReadOnlyView(input);
		expect(input).toHaveLength(length);
	});

	it('returns exactly input.length + 5 files (no duplicates)', () => {
		const result = injectReadOnlyView(modFiles);
		expect(result).toHaveLength(modFiles.length + 5);
	});

	it('returns exactly 5 files when input is empty', () => {
		const result = injectReadOnlyView([]);
		expect(result).toHaveLength(5);
	});

	it('collapses multiple smuggled community-plugins.json entries to exactly one', () => {
		const withMultiple: ExtractedFile[] = [
			...modFiles,
			{ path: COMMUNITY_PLUGINS_PATH, data: new TextEncoder().encode('["a"]') },
			{ path: COMMUNITY_PLUGINS_PATH, data: new TextEncoder().encode('["b"]') },
		];
		const result = injectReadOnlyView(withMultiple);
		const community = result.filter((f) => f.path === COMMUNITY_PLUGINS_PATH);
		expect(community).toHaveLength(1);
		expect(JSON.parse(decode(community[0].data))).toEqual([READ_ONLY_VIEW_PLUGIN_ID]);
	});
});
