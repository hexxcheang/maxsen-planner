/**
 * Data hooks used by every screen. Each returns `{ data, isLoading }` so Phase B can back them
 * with TanStack Query against the API without changing a single screen.
 */
import { useMemo, useSyncExternalStore } from 'react';
import { CATEGORIES, computeTotals, type PlanType } from '@maxsen/domain';
import {
  filterProjects,
  levelsOf,
  plansOf,
  resolverFor,
  visibleVariantsFor,
  type SampleState,
} from './sample-store';
import { useStoreContext } from './store-context';

export interface Query<T> {
  data: T;
  isLoading: boolean;
}

function useSampleState(): SampleState {
  const { store } = useStoreContext();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

function useQuery<T>(select: (s: SampleState) => T, deps: unknown[]): Query<T> {
  const { loading } = useStoreContext();
  const state = useSampleState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => select(state), [state, ...deps]);
  return { data, isLoading: loading };
}

/** Mutations. Phase B replaces these with API calls behind the same names. */
export function useActions() {
  return useStoreContext().store.actions;
}

export function useProjects(search = '') {
  return useQuery((s) => filterProjects(s.projects, search), [search]);
}

export function useProject(projectId: string | undefined) {
  return useQuery((s) => s.projects.find((p) => p.id === projectId), [projectId]);
}

export function useLevels(projectId: string | undefined) {
  return useQuery((s) => (projectId ? levelsOf(s, projectId) : []), [projectId]);
}

export function usePlans(projectId: string | undefined) {
  return useQuery((s) => (projectId ? plansOf(s, projectId) : []), [projectId]);
}

export function useSourcePages(projectId: string | undefined) {
  return useQuery(
    (s) => ({
      files: s.sourceFiles.filter((f) => f.projectId === projectId),
      pages: s.sourcePages.filter((p) => p.projectId === projectId),
    }),
    [projectId],
  );
}

export function useCatalogue() {
  return useQuery(
    (s) => ({
      categories: CATEGORIES,
      products: s.products,
      variants: s.variants,
      visibleVariantsFor: (planType: PlanType) => visibleVariantsFor(s, planType),
    }),
    [],
  );
}

export function useSettings() {
  return useQuery((s) => s.settings, []);
}

export function useTemplates() {
  return useQuery((s) => s.templates, []);
}

export function useFavourites() {
  return useQuery((s) => {
    const byId = new Map(s.variants.map((v) => [v.id, v]));
    return s.settings.favouriteVariantIds.flatMap((id) => {
      const v = byId.get(id);
      return v ? [v] : [];
    });
  }, []);
}

/** Variant resolver for a project: its catalogue snapshot first, then the live catalogue. */
export function useResolver(projectId: string | undefined) {
  return useQuery(
    (s) =>
      resolverFor(
        s.projects.find((p) => p.id === projectId),
        s,
      ),
    [projectId],
  );
}

/** Live project-wide totals across every plan of every level. */
export function useProjectTotals(projectId: string | undefined) {
  return useQuery(
    (s) => {
      const project = s.projects.find((p) => p.id === projectId);
      if (!project) return [];
      return computeTotals(
        plansOf(s, project.id).map((p) => p.document),
        resolverFor(project, s),
      );
    },
    [projectId],
  );
}
