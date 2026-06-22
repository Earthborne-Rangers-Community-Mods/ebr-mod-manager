// SSR- and quota-safe localStorage access.
//
// localStorage is undefined during server rendering and can throw at runtime
// when storage is full or disabled (private-browsing quotas, blocked cookies).
// These wrappers centralize the `typeof localStorage === 'undefined'` guard and
// the try/catch so callers can read, write, and remove without repeating either
// and without having to remember which contexts are unsafe.

/** Read a key. Returns null when storage is unavailable or the read throws. */
export function getStorageItem(key: string): string | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

/**
 * Write a key. Returns true on success, false when storage is unavailable or
 * the write throws (quota exceeded, storage disabled).
 */
export function setStorageItem(key: string, value: string): boolean {
	if (typeof localStorage === 'undefined') return false;
	try {
		localStorage.setItem(key, value);
		return true;
	} catch {
		return false;
	}
}

/** Remove a key. No-op when storage is unavailable or the removal throws. */
export function removeStorageItem(key: string): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.removeItem(key);
	} catch {
		// Storage unavailable -- nothing to remove.
	}
}
