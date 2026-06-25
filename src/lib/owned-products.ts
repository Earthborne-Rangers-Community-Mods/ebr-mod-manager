// Owned-products library: a localStorage-backed list of the Earthborne Rangers
// products the user owns. Used by the registry browser to filter out mods the
// user cannot play (those whose requiredProducts are not fully owned).
//
// The store distinguishes two states:
//   - Not configured: the key is absent. The user has never set their library.
//     The browser treats this as "all products owned" so nothing is hidden.
//   - Configured: the key is present (even as an empty list). The user's
//     explicit selection is honored, including owning nothing.

const OWNED_PRODUCTS_KEY = 'ebr-owned-products';

/**
 * Read the user's owned-products selection.
 *
 * Returns a Set of product ids when the library has been configured, or null
 * when it has never been configured (callers treat null as "all owned"). An
 * empty Set means the user explicitly owns nothing -- distinct from null.
 */
export function getOwnedProducts(): Set<string> | null {
	if (typeof localStorage === 'undefined') return null;
	let raw: string | null;
	try {
		raw = localStorage.getItem(OWNED_PRODUCTS_KEY);
	} catch {
		return null;
	}
	if (raw === null) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!Array.isArray(parsed)) return null;
	return new Set(parsed.filter((id): id is string => typeof id === 'string'));
}

/** True when the user has configured a valid product library at least once. */
export function isProductLibraryConfigured(): boolean {
	return getOwnedProducts() !== null;
}

/** Persist the user's owned-products selection, marking the library configured. */
export function setOwnedProducts(ids: Iterable<string>): void {
	if (typeof localStorage === 'undefined') return;
	const unique = [...new Set(ids)];
	try {
		localStorage.setItem(OWNED_PRODUCTS_KEY, JSON.stringify(unique));
	} catch {
		// Storage full or unavailable -- selection simply does not persist.
	}
}

/**
 * Forget the user's owned-products selection, returning the library to the
 * unconfigured state (every mod treated as compatible again).
 */
export function clearOwnedProducts(): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.removeItem(OWNED_PRODUCTS_KEY);
	} catch {
		// Storage unavailable -- nothing to clear.
	}
}

/**
 * Whether the user owns every product a mod requires.
 *
 * When `owned` is null (library not configured), every mod is considered
 * compatible so nothing is hidden before the user opts in.
 */
export function ownsAllRequiredProducts(
	requiredProducts: string[],
	owned: Set<string> | null,
): boolean {
	if (owned === null) return true;
	return requiredProducts.every((id) => owned.has(id));
}
