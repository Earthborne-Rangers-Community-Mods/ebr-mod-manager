// --- Types ---

import {
	RegistryFetchError,
	ModDetailFetchError,
	DescriptionFetchError,
	RegistryParseError,
	ModParseError,
	InvalidRepoUrlError,
} from './errors.js';

export type ModType =
	| 'campaign'
	| 'enhancement'
	| 'one-day-mission'
	| 'expansion'
	| 'collection'
	| 'theme';

/** Browse-tier mod data (from registry.json). */
export interface BrowseMod {
	id: string;
	name: string;
	repoUrl: string;
	type: ModType;
	commitHash: string;
	author: string;
	description: string;
	tags: string[];
	campaigns: string[];
	requiredProducts: string[];
	safeToAddMidCampaign: boolean;
	coverImage?: string;
	icon?: string;
	language: string;
	latestVersion: string;
	updatedAt: string;
}

/** Included mod reference (for collections and lineage). */
export interface IncludedMod {
	id: string;
	name: string;
	author: string;
	version: string;
	repoUrl: string;
}

/** Detail-tier mod data (from mods/<mod-id>.json). */
export interface ModDetail extends BrowseMod {
	authorDiscord?: string;
	midCampaignNotes?: string;
	optionalProducts?: string[];
	includedMods?: IncludedMod[];
}

/** The combined registry.json structure. */
export interface Registry {
	schemaVersion: number;
	mods: BrowseMod[];
}

// --- Configuration ---

const REGISTRY_OWNER = 'Earthborne-Rangers-Community-Mods';
const REGISTRY_REPO = 'ebr-mod-registry';
const REGISTRY_BRANCH = 'main';

const RAW_BASE = `https://raw.githubusercontent.com/${REGISTRY_OWNER}/${REGISTRY_REPO}/${REGISTRY_BRANCH}`;

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

/** Fetch Description.md for a mod. Returns null if not found. */
export async function fetchDescription(mod: {
	repoUrl: string;
	commitHash: string;
}): Promise<string | null> {
	const url = modFileUrl(mod, 'Description.md');
	const response = await fetch(url);
	if (response.status === 404) {
		return null;
	}
	if (!response.ok) {
		throw new DescriptionFetchError(url, response.status, response.statusText);
	}
	return response.text();
}

// --- URL helpers ---

/** Build a raw GitHub URL for a file in a mod repo at a pinned commit. */
export function modFileUrl(
	mod: { repoUrl: string; commitHash: string },
	filePath: string,
): string {
	const { owner, repo } = parseRepoUrl(mod.repoUrl);
	return `https://raw.githubusercontent.com/${owner}/${repo}/${mod.commitHash}/${filePath}`;
}

/** Build a cover image URL for a mod, or null if no cover image. */
export function coverImageUrl(mod: {
	repoUrl: string;
	commitHash: string;
	coverImage?: string;
}): string | null {
	if (!mod.coverImage) return null;
	return modFileUrl(mod, mod.coverImage);
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
		coverImage: typeof mod.coverImage === 'string' ? mod.coverImage : undefined,
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
