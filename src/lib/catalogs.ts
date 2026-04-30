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
 */

import * as m from '$lib/paraglide/messages.js';
import { getRegistryCampaignName } from './registry.js';

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

export function resolveCampaignDisplayName(id: string): string {
	return CAMPAIGN_MESSAGES[id]?.() ?? getRegistryCampaignName(id);
}

export function resolveProductDisplayName(id: string): string {
	return PRODUCT_MESSAGES[id]?.() ?? id;
}
