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
