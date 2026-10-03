import {
  nextZ,
  type CategoryId,
  type PlanDocument,
  type PlanElement,
  type VariantResolver,
} from '@maxsen/domain';

/**
 * Adds Magic Plan elements to a plan document on top of what is there. With `replace`, elements of
 * the chosen categories already on the plan are removed first; notes and other categories stay.
 */
export function mergeMagic(
  doc: PlanDocument,
  added: PlanElement[],
  options: { replace: boolean; categories: CategoryId[]; resolve: VariantResolver },
): PlanDocument {
  const drop = new Set(options.categories);
  const kept = options.replace
    ? doc.elements.filter((el) => {
        if (el.kind === 'note') return true;
        const categoryId = options.resolve(el.variantId)?.categoryId;
        return !categoryId || !drop.has(categoryId);
      })
    : doc.elements;
  let z = nextZ({ ...doc, elements: kept });
  return { ...doc, elements: [...kept, ...added.map((el) => ({ ...el, z: z++ }))] };
}
