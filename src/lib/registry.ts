// --- Types ---

import { Capacitor } from '@capacitor/core';

import {
	RegistryFetchError,
	ModDetailFetchError,
	DescriptionFetchError,
	RegistryParseError,
	ModParseError,
	InvalidRepoUrlError,
} from './errors.js';

import type { ModType, BrowseMod, ModDetail, Registry } from './types.js';

export type { ModType, BrowseMod, IncludedMod, ModDetail, Registry } from './types.js';

// --- Configuration ---

const REGISTRY_OWNER = 'Earthborne-Rangers-Community-Mods';
const REGISTRY_REPO = 'ebr-mod-registry';
const REGISTRY_BRANCH = 'main';

const RAW_BASE = `https://raw.githubusercontent.com/${REGISTRY_OWNER}/${REGISTRY_REPO}/${REGISTRY_BRANCH}`;

// --- Campaign display names (derived from registry) ---

/** Map from campaign slug to display name, built from campaign-type mods in the registry. */
let campaignNameMap: Record<string, string> = {};

/** Get the display name for a campaign ID. Returns the slug if unknown. */
export function getRegistryCampaignName(id: string): string {
	return campaignNameMap[id] ?? id;
}

/** Rebuild the campaign name map from registry mods. Called after fetching the registry. */
function buildCampaignNameMap(mods: BrowseMod[]): void {
	const map: Record<string, string> = {};
	for (const mod of mods) {
		if (mod.type === 'campaign' || mod.type === 'one-day-mission') {
			map[mod.id] = mod.name;
		}
	}
	campaignNameMap = map;
}

// --- Fetching ---

/** Fetch and parse the browse-tier registry. */
export async function fetchRegistry(): Promise<Registry> {
	const url = `${RAW_BASE}/registry.json`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new RegistryFetchError(url, response.status, response.statusText);
	}
	const data: unknown = await response.json();
	return parseRegistry(data);
}

/** Fetch the detail-tier data for a specific mod. */
export async function fetchModDetail(modId: string): Promise<ModDetail> {
	const url = `${RAW_BASE}/mods/${encodeURIComponent(modId)}.json`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new ModDetailFetchError(modId, url, response.status, response.statusText);
	}
	const data: unknown = await response.json();
	validateModObject(data, modId);
	return data as ModDetail;
}

/** Filename of the per-mod description page. Lives at the repo root. */
export const DESCRIPTION_FILENAME = 'About this Mod.md';

/**
 * Fetch the About this Mod.md description page for a mod. Returns null if not found.
 *
 * When a GitHub PAT is provided, the request is routed through the GitHub Contents
 * API (via the /github-api dev proxy on web, or directly on native) with an
 * Authorization header so that private repos can be read. Without a token the
 * file is fetched anonymously from raw.githubusercontent.com, which only works
 * for public repos.
 */
export async function fetchDescription(
	mod: { repoUrl: string; commitHash: string },
	token?: string,
): Promise<string | null> {
	const url = token ? contentsApiUrl(mod, DESCRIPTION_FILENAME) : modFileUrl(mod, DESCRIPTION_FILENAME);
	const headers: Record<string, string> = {};
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
		headers['Accept'] = 'application/vnd.github.raw';
	}
	const response = await fetch(url, { headers });
	if (response.status === 404) {
		return null;
	}
	if (!response.ok) {
		throw new DescriptionFetchError(url, response.status, response.statusText);
	}
	return response.text();
}

/**
 * Build a GitHub Contents API URL for a file in a mod repo at a pinned commit.
 * Uses the /github-api dev proxy on web (CORS-friendly) and api.github.com
 * directly on native platforms. Suitable for authenticated requests against
 * private repos.
 */
function contentsApiUrl(
	mod: { repoUrl: string; commitHash: string },
	filePath: string,
): string {
	const { owner, repo } = parseRepoUrl(mod.repoUrl);
	const encodedPath = filePath
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/');
	const base = Capacitor.isNativePlatform() ? 'https://api.github.com' : '/github-api';
	return `${base}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${mod.commitHash}`;
}

// --- URL helpers ---

/** Build a raw GitHub URL for a file in a mod repo at a pinned commit. */
export function modFileUrl(
	mod: { repoUrl: string; commitHash: string },
	filePath: string,
): string {
	const { owner, repo } = parseRepoUrl(mod.repoUrl);
	// Encode each path segment so spaces and other reserved characters in
	// filenames (e.g. "About this Mod.md") produce valid URLs. We split on
	// '/' and encode segments individually so the path separators are
	// preserved.
	const encodedPath = filePath
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/');
	return `https://raw.githubusercontent.com/${owner}/${repo}/${mod.commitHash}/${encodedPath}`;
}

/** Rewrite relative image paths in markdown to absolute raw GitHub URLs. */
export function rewriteImagePaths(
	markdown: string,
	mod: { repoUrl: string; commitHash: string },
): string {
	return markdown.replace(
		/!\[([^\]]*)\]\((?!https?:\/\/)([^)]+)\)/g,
		(_, alt: string, path: string) => `![${alt}](${modFileUrl(mod, path)})`,
	);
}

// --- Parsing and validation ---

export function parseRegistry(data: unknown): Registry {
	if (!data || typeof data !== 'object') {
		throw new RegistryParseError('root', 'Registry data is not an object');
	}
	const obj = data as Record<string, unknown>;
	if (typeof obj.schemaVersion !== 'number') {
		throw new RegistryParseError('schemaVersion', 'Missing or invalid schemaVersion');
	}
	if (!Array.isArray(obj.mods)) {
		throw new RegistryParseError('mods', 'Missing or invalid mods array');
	}
	const mods: BrowseMod[] = [];
	for (let i = 0; i < obj.mods.length; i++) {
		try {
			mods.push(parseBrowseMod(obj.mods[i], i));
		} catch (err) {
			if (err instanceof ModParseError) {
				console.warn(`Skipping malformed mod at index ${i}: ${err.message}`);
				continue;
			}
			throw err;
		}
	}
	buildCampaignNameMap(mods);
	return { schemaVersion: obj.schemaVersion, mods };
}

const REQUIRED_STRING_FIELDS = [
	'id',
	'name',
	'repoUrl',
	'type',
	'commitHash',
] as const;

function parseBrowseMod(data: unknown, index: number): BrowseMod {
	if (!data || typeof data !== 'object') {
		throw new ModParseError(index, 'root');
	}
	const mod = data as Record<string, unknown>;
	for (const field of REQUIRED_STRING_FIELDS) {
		if (typeof mod[field] !== 'string') {
			throw new ModParseError(index, field);
		}
	}
	return {
		id: mod.id as string,
		name: mod.name as string,
		repoUrl: mod.repoUrl as string,
		type: mod.type as ModType,
		commitHash: mod.commitHash as string,
		author: typeof mod.author === 'string' ? mod.author : '',
		description: typeof mod.description === 'string' ? mod.description : '',
		tags: Array.isArray(mod.tags) ? (mod.tags as string[]) : [],
		campaigns: Array.isArray(mod.campaigns) ? (mod.campaigns as string[]) : [],
		requiredProducts: Array.isArray(mod.requiredProducts) ? (mod.requiredProducts as string[]) : [],
		safeToAddMidCampaign: typeof mod.safeToAddMidCampaign === 'boolean' ? mod.safeToAddMidCampaign : false,
		icon: typeof mod.icon === 'string' ? mod.icon : undefined,
		language: typeof mod.language === 'string' ? mod.language : 'en',
		latestVersion: typeof mod.latestVersion === 'string' ? mod.latestVersion : '',
		updatedAt: typeof mod.updatedAt === 'string' ? mod.updatedAt : '',
	};
}

function validateModObject(data: unknown, modId: string): void {
	if (!data || typeof data !== 'object') {
		throw new RegistryParseError('root', `Mod detail for '${modId}' is not an object`);
	}
	const obj = data as Record<string, unknown>;
	if (typeof obj.id !== 'string') {
		throw new RegistryParseError('id', `Mod detail for '${modId}': missing 'id'`);
	}
}

export function parseRepoUrl(repoUrl: string): { owner: string; repo: string } {
	const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
	if (!match) {
		throw new InvalidRepoUrlError(repoUrl);
	}
	return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}
