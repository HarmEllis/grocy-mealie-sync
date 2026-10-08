export interface ShopProduct {
  providerId: string;
  externalId: string;
  name: string;
  packageAmount: number | null;
  packageUnit: string | null;
  measure: string;
  availability?: string;
  availabilityCheckedAt?: string | null;
}

export function productLabel(product: ShopProduct): string {
  const packageLabel = product.measure === 'weight' ? 'per kg' : product.packageAmount && product.packageUnit ? `${product.packageAmount} ${product.packageUnit}` : '';
  const status = product.availability === 'temporarily_unavailable' ? ' · temporarily out of stock' : product.availability === 'discontinued' ? ' · discontinued' : '';
  return `${product.name}${packageLabel ? ` · ${packageLabel}` : ''}${status}`;
}

/** Known choices stay useful offline; omission from search never removes them. */
export function catalogOptions(products: ShopProduct[], providerId: string, query: string, suggestedIds: ReadonlySet<string> = new Set()) {
  const needle = query.trim().toLocaleLowerCase();
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return products.filter(product => product.providerId === providerId && product.availability !== 'discontinued'
    && (!needle || product.name.toLocaleLowerCase().includes(needle) || product.externalId.includes(needle)))
    .sort((a, b) => Number(suggestedIds.has(b.externalId)) - Number(suggestedIds.has(a.externalId)) || collator.compare(a.name, b.name))
    .map(product => ({ value: product.externalId, label: productLabel(product) }));
}
