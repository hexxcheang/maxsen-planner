import { migratePlanDocument } from '@maxsen/domain';
import { addNewSampleCategories, type Persistence, type SampleState } from '../data/sample-store';

const KEY = 'maxsen.mvp.state.v1';

/** Keeps the whole workspace in localStorage so work survives reloads on this device. */
export const localPersistence: Persistence = {
  load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return null;
      const state = JSON.parse(raw) as SampleState;
      if (!Array.isArray(state.projects) || !Array.isArray(state.plans) || !state.settings)
        return null;
      // Validate every plan document; a corrupt save falls back to fresh sample data.
      for (const plan of state.plans) plan.document = migratePlanDocument(plan.document);
      return addNewSampleCategories(state);
    } catch (e) {
      console.warn('Saved data could not be read; starting from sample data.', e);
      return null;
    }
  },
  save(state) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save to this browser (storage may be full).', e);
    }
  },
};
