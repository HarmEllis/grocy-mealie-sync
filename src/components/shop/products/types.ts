import { toast } from 'sonner';
import type { ShopOverview } from '@/lib/shop/overview';
import type { TargetOption } from '@/lib/shop/targets';
import type { productInventory } from '@/lib/shop/product-inventory';
import type { ShopProduct } from '../catalog-options';

export type QueueTab = 'todo' | 'mapped' | 'attention';
export type StatusFilter = 'all' | 'unit_changed' | 'unconfirmed' | 'discontinued';

/**
 * Server filters for a queue view. To map and Mapped narrow by mapping, Needs attention by reason; a specific
 * status always narrows by that reason, so the totals and pages stay correct for every combination.
 */
export function queueFilters(tab: QueueTab, status: StatusFilter): { mapped: 'all' | 'mapped' | 'unmapped'; attention: '' | 'any' | Exclude<StatusFilter, 'all'> } {
  return {
    mapped: tab === 'todo' ? 'unmapped' : tab === 'mapped' ? 'mapped' : 'all',
    attention: status !== 'all' ? status : tab === 'attention' ? 'any' : '',
  };
}

export interface Mapping {
  id: string; providerId: string; retailerProductId: string; retailerProductName: string;
  targetKind: string; targetId: string; targetName: string; role: string;
  packageBaseAmount: number | null; packageBaseUnitId: string | null; packageBaseUnitName: string | null;
  confirmed: boolean; fulfilsAllDemand?: boolean;
}
export interface Suggestion { id: string; providerId: string; retailerProductId: string; targetKind: string; targetId: string; targetName: string; score: number }
export interface SearchStatus { id: string; providerId: string; targetKind: string; targetId: string; targetName: string; status: string; resultCount: number; lastError: string | null }
export interface CatalogData { mappings: Mapping[]; products: ShopProduct[]; suggestions: Suggestion[]; searches?: SearchStatus[] }
export type Inventory = Awaited<ReturnType<typeof productInventory>>;
export type Provider = { id: string; name: string; installationId: string | null; installations: ShopOverview['installations'] };
export type Draft = { providerId: string; product: ShopProduct; role: 'preferred' | 'alternative'; mapping?: Mapping; replaces?: Mapping };

export function canChooseProduct(catalog: CatalogData, providerId: string, product: ShopProduct, target: TargetOption, role: 'preferred' | 'alternative', currentId?: string) {
  const existing = catalog.mappings.find(mapping => mapping.providerId === providerId && mapping.retailerProductId === product.externalId);
  if (existing && !forTarget(existing, target)) { toast.error(`Already mapped to ${existing.targetName}`, { description: 'Remove that mapping first to move this product.' }); return false; }
  if (role === 'alternative' && existing && existing.id !== currentId) { toast.error('This product is already linked to this ingredient.'); return false; }
  return true;
}

export function sourceLabel(target: TargetOption) { return target.source === 'grocy_mealie' ? 'G+M' : target.kind === 'grocy_product' ? 'G' : 'M'; }
export function forTarget(mapping: { targetKind: string; targetId: string }, target: TargetOption) { return (mapping.targetKind === target.kind && mapping.targetId === target.id) || (target.kind === 'grocy_product' && mapping.targetKind === 'mealie_food' && Boolean(target.linkedFoods?.some(food => food.id === mapping.targetId))); }
export function conversionLabel(mapping: Mapping, product?: ShopProduct) {
  return `1 ${product?.measure === 'weight' ? 'kg' : 'package'} = ${mapping.packageBaseAmount ?? '?'} ${mapping.packageBaseUnitName ?? 'items'}`;
}

/**
 * The mapping that acts as the preferred product of one retailer for a target, and the rest. A direct mapping wins
 * over a legacy one on the linked Mealie food, like in the inventory and the list projection; the shadowed legacy
 * mapping is listed with the alternatives even though its stored role is still `preferred`.
 */
export function effectiveMappings(mappings: Mapping[], providerId: string, target: TargetOption): { main: Mapping | undefined; alternatives: Mapping[] } {
  const own = mappings.filter(mapping => mapping.providerId === providerId && forTarget(mapping, target));
  const main = own.find(mapping => mapping.role === 'preferred' && mapping.targetKind === target.kind && mapping.targetId === target.id) ?? own.find(mapping => mapping.role === 'preferred');
  return { main, alternatives: own.filter(mapping => mapping.id !== main?.id) };
}
