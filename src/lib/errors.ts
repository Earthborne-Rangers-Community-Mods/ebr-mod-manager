// --- Network errors ---

/** Base class for all network-level failures (offline, DNS, connection refused, etc.). */
export class NetworkError extends Error {
	cause: unknown;
	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = 'NetworkError';
		this.cause = cause;
	}
}

// --- Fetch errors ---

export class RegistryFetchError extends Error {
	url: string;
	httpStatus: number;
	constructor(url: string, httpStatus: number, statusText: string) {
		super(`Registry fetch failed: ${httpStatus} ${statusText}`);
		this.name = 'RegistryFetchError';
		this.url = url;
		this.httpStatus = httpStatus;
	}
}

export class ModDetailFetchError extends RegistryFetchError {
	modId: string;
	constructor(modId: string, url: string, httpStatus: number, statusText: string) {
		super(url, httpStatus, statusText);
		this.name = 'ModDetailFetchError';
		this.modId = modId;
		this.message = `Mod detail fetch failed for '${modId}': ${httpStatus} ${statusText}`;
	}
}

export class DescriptionFetchError extends RegistryFetchError {
	constructor(url: string, httpStatus: number, statusText: string) {
		super(url, httpStatus, statusText);
		this.name = 'DescriptionFetchError';
		this.message = `Description fetch failed: ${httpStatus} ${statusText}`;
	}
}

// --- Parse errors ---

export class RegistryParseError extends Error {
	field: string;
	constructor(field: string, message: string) {
		super(message);
		this.name = 'RegistryParseError';
		this.field = field;
	}
}

export class ModParseError extends RegistryParseError {
	index: number;
	constructor(index: number, field: string) {
		super(field, `Invalid mod at index ${index}: missing or invalid '${field}'`);
		this.name = 'ModParseError';
		this.index = index;
	}
}

// --- URL errors ---

export class InvalidRepoUrlError extends Error {
	repoUrl: string;
	constructor(repoUrl: string) {
		super(`Invalid GitHub repo URL: ${repoUrl}`);
		this.name = 'InvalidRepoUrlError';
		this.repoUrl = repoUrl;
	}
}

// --- Download errors ---

export class ModDownloadError extends Error {
	commitHash: string;
	url: string;
	httpStatus: number;
	constructor(commitHash: string, url: string, httpStatus: number, statusText: string) {
		super(`Mod download failed for commit ${commitHash}: ${httpStatus} ${statusText}`);
		this.name = 'ModDownloadError';
		this.commitHash = commitHash;
		this.url = url;
		this.httpStatus = httpStatus;
	}
}

// --- Extraction errors ---

export class PathTraversalError extends Error {
	filePath: string;
	constructor(filePath: string) {
		super(`Path traversal detected: ${filePath}`);
		this.name = 'PathTraversalError';
		this.filePath = filePath;
	}
}

export class ZipHashMismatchError extends Error {
	expectedHash: string;
	actualHash: string;
	constructor(expectedHash: string, actualHash: string) {
		super(`Zip commit hash mismatch: expected ${expectedHash}, got ${actualHash}`);
		this.name = 'ZipHashMismatchError';
		this.expectedHash = expectedHash;
		this.actualHash = actualHash;
	}
}

// --- Vault errors ---

export class VaultDirectoryMissingError extends Error {
	constructor() {
		super('Vault directory no longer exists');
		this.name = 'VaultDirectoryMissingError';
	}
}

/** The filesystem ran out of space during a vault write. */
export class VaultQuotaExceededError extends Error {
	constructor() {
		super('Not enough storage space to install this mod');
		this.name = 'VaultQuotaExceededError';
	}
}

/** The app lost permission to write to the vault directory. */
export class VaultPermissionError extends Error {
	constructor() {
		super('Permission to write to the vault folder was denied');
		this.name = 'VaultPermissionError';
	}
}

// --- Helpers ---

/**
 * Determine whether an unknown error is a network-level failure (offline,
 * DNS resolution, connection refused, CORS, etc.). Network errors from
 * fetch() surface as TypeError in all major browsers.
 */
export function isNetworkError(err: unknown): boolean {
	if (err instanceof NetworkError) return true;
	if (err instanceof TypeError) {
		// fetch() throws TypeError for network failures. Match known browser
		// messages: "Failed to fetch" (Chrome), "NetworkError when attempting
		// to fetch resource" (Firefox), "Load failed" (Safari).
		const msg = err.message.toLowerCase();
		return msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed');
	}
	return false;
}

/**
 * Determine whether an unknown vault write error is a quota/storage issue.
 */
export function isQuotaError(err: unknown): boolean {
	if (err instanceof VaultQuotaExceededError) return true;
	if (err instanceof DOMException) {
		if (err.name === 'QuotaExceededError') return true;
		if (err.name === 'AbortError' && err.message.toLowerCase().includes('quota')) return true;
	}
	if (err instanceof Error) {
		const msg = err.message.toLowerCase();
		return msg.includes('quota') || msg.includes('no space') || msg.includes('disk full');
	}
	return false;
}

/**
 * Determine whether an unknown vault write error is a permission issue.
 */
export function isPermissionError(err: unknown): boolean {
	if (err instanceof VaultPermissionError) return true;
	if (err instanceof DOMException) {
		return err.name === 'NotAllowedError' || err.name === 'SecurityError';
	}
	if (err instanceof Error) {
		const msg = err.message.toLowerCase();
		return msg.includes('permission') || msg.includes('not allowed');
	}
	return false;
}
