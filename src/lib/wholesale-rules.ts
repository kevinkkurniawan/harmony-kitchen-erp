export interface WholesaleCategoryRule {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  isactive: boolean;
  version: number;
  tier1_minqty: number;
  tier2_minqty: number;
  tier3_minqty: number;
}

export interface WholesaleItemPrices {
  price: number;
  grosir1?: number | null;
  grosir2?: number | null;
  grosir3?: number | null;
  wholesaleCategory?: {
    id?: number;
    code?: string;
    version?: number;
    tier1_minqty: number;
    tier2_minqty: number;
    tier3_minqty: number;
  } | null;
}

export interface EffectivePriceResult {
  effectivePrice: number;
  priceSource: 'RETAIL' | 'GROSIR_1' | 'GROSIR_2' | 'GROSIR_3' | 'OVERRIDE_GROSIR_1';
  tier?: 1 | 2 | 3;
  wholesaleCategoryId?: number;
  wholesaleVersion?: number;
  isOverrideApplied?: boolean;
}

export function validateWholesaleThresholds(tier1: number, tier2: number, tier3: number): string | null {
  if (tier1 <= 0) {
    return 'Threshold Tier 1 harus berupa bilangan positif (> 0).';
  }
  if (tier2 <= tier1) {
    return 'Threshold Tier 2 harus lebih besar dari Tier 1.';
  }
  if (tier3 <= tier2) {
    return 'Threshold Tier 3 harus lebih besar dari Tier 2.';
  }
  return null;
}

/**
 * Pure wholesale tier calculator matching the ERP/POS contract exactly.
 */
export function calculateEffectivePrice(
  item: WholesaleItemPrices,
  qty: number,
  isCartOverrideGrosir1 = false
): EffectivePriceResult {
  const retailPrice = Number(item.price) || 0;
  const g1 = item.grosir1 !== null && item.grosir1 !== undefined ? Number(item.grosir1) : null;
  const g2 = item.grosir2 !== null && item.grosir2 !== undefined ? Number(item.grosir2) : null;
  const g3 = item.grosir3 !== null && item.grosir3 !== undefined ? Number(item.grosir3) : null;

  // 1. Handle Override Grosir 1
  if (isCartOverrideGrosir1) {
    if (g1 !== null && g1 > 0) {
      return {
        effectivePrice: g1,
        priceSource: 'OVERRIDE_GROSIR_1',
        tier: 1,
        wholesaleCategoryId: item.wholesaleCategory?.id,
        wholesaleVersion: item.wholesaleCategory?.version,
        isOverrideApplied: true,
      };
    }
    // Ineligible item fallback to retail
    return {
      effectivePrice: retailPrice,
      priceSource: 'RETAIL',
      isOverrideApplied: false,
    };
  }

  // 2. Normal Tier Evaluation based on Wholesale Category thresholds
  const rule = item.wholesaleCategory;
  if (rule && qty > 0) {
    if (rule.tier3_minqty > 0 && qty >= rule.tier3_minqty && g3 !== null && g3 > 0) {
      return {
        effectivePrice: g3,
        priceSource: 'GROSIR_3',
        tier: 3,
        wholesaleCategoryId: rule.id,
        wholesaleVersion: rule.version,
      };
    }

    if (rule.tier2_minqty > 0 && qty >= rule.tier2_minqty && g2 !== null && g2 > 0) {
      return {
        effectivePrice: g2,
        priceSource: 'GROSIR_2',
        tier: 2,
        wholesaleCategoryId: rule.id,
        wholesaleVersion: rule.version,
      };
    }

    if (rule.tier1_minqty > 0 && qty >= rule.tier1_minqty && g1 !== null && g1 > 0) {
      return {
        effectivePrice: g1,
        priceSource: 'GROSIR_1',
        tier: 1,
        wholesaleCategoryId: rule.id,
        wholesaleVersion: rule.version,
      };
    }
  }

  // 3. Fallback to Retail Price
  return {
    effectivePrice: retailPrice,
    priceSource: 'RETAIL',
  };
}
