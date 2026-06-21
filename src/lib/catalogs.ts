/**
 * Display name resolution for campaign and product IDs.
 *
 * Resolution order for campaigns:
 *   1. i18n message (official campaigns)
 *   2. Registry-derived name (fan campaigns)
 *   3. Raw slug
 *
 * Resolution order for products:
 *   1. i18n message
 *   2. Raw slug
 *
 * Mod type descriptions resolve from i18n messages only (the type set is
 * closed), returning an empty string for an unknown type so callers can skip
 * rendering.
 */

import * as m from '$lib/paraglide/messages.js';
import { getRegistryCampaignName, type ModType } from './registry.js';

const CAMPAIGN_MESSAGES: Record<string, () => string> = {
	'lure-of-the-valley': m.campaign_lure_of_the_valley,
	'legacy-of-the-ancestors': m.campaign_legacy_of_the_ancestors,
	'spire-in-bloom': m.campaign_spire_in_bloom,
	'shadow-of-the-storm': m.campaign_shadow_of_the_storm,
	'animal-rescue': m.campaign_animal_rescue,
	'missing-person': m.campaign_missing_person,
	'predatory-instincts': m.campaign_predatory_instincts,
	'incandescent-sky': m.campaign_incandescent_sky,
};

const PRODUCT_MESSAGES: Record<string, () => string> = {
	'core-set': m.product_core_set,
	'legacy-of-the-ancestors': m.product_legacy_of_the_ancestors,
	'spire-in-bloom': m.product_spire_in_bloom,
	'shadow-of-the-storm': m.product_shadow_of_the_storm,
	'moments-in-the-valley': m.product_moments_in_the_valley,
	'stewards-of-the-valley': m.product_stewards_of_the_valley,
	'moments-on-the-path': m.product_moments_on_the_path,
	'ranger-card-doubler': m.product_ranger_card_doubler,
	'incandescent-sky': m.product_incandescent_sky,
};

/**
 * Known official product IDs, in catalog order. Derived from PRODUCT_MESSAGES so
 * the two never drift. PRODUCT_MESSAGES mirrors OFFICIAL_PRODUCTS in ebr-mod-tools
 * src/core/catalogs.js; keep that list in sync when Earthborne Games releases new
 * content. Drives the product-ownership checkboxes in the registry browser's
 * filters menu.
 */
export const KNOWN_PRODUCT_IDS: readonly string[] = Object.keys(PRODUCT_MESSAGES);

/**
 * Player-facing one-line description per mod type. The canonical wording lives
 * in the "Mod Types" table in EXECUTION-PLAN.md. Typed against the ModType union
 * so the compiler enforces an entry for every type.
 */
const MOD_TYPE_DESCRIPTION_MESSAGES: Record<ModType, () => string> = {
	campaign: m.mod_type_campaign_desc,
	enhancement: m.mod_type_enhancement_desc,
	'one-day-mission': m.mod_type_one_day_mission_desc,
	expansion: m.mod_type_expansion_desc,
	collection: m.mod_type_collection_desc,
	theme: m.mod_type_theme_desc,
};

/**
 * Player-facing singular display name per mod type. Used wherever a single mod's
 * type is shown to the player (e.g. the detail view's "Type" fact and the browse
 * filter's type options). Typed against ModType for the same exhaustiveness
 * guarantee.
 */
const MOD_TYPE_NAME_MESSAGES: Record<ModType, () => string> = {
	campaign: m.mod_type_campaign_name,
	enhancement: m.mod_type_enhancement_name,
	'one-day-mission': m.mod_type_one_day_mission_name,
	expansion: m.mod_type_expansion_name,
	collection: m.mod_type_collection_name,
	theme: m.mod_type_theme_name,
};

export function resolveCampaignDisplayName(id: string): string {
	return CAMPAIGN_MESSAGES[id]?.() ?? getRegistryCampaignName(id);
}

export function resolveProductDisplayName(id: string): string {
	return PRODUCT_MESSAGES[id]?.() ?? id;
}

export function resolveModTypeName(type: string): string {
	return MOD_TYPE_NAME_MESSAGES[type as ModType]?.() ?? type;
}

export function resolveModTypeDescription(type: string): string {
	return MOD_TYPE_DESCRIPTION_MESSAGES[type as ModType]?.() ?? '';
}
