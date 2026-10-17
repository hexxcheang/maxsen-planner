import { useOutletContext } from 'react-router';
import type { ProjectOutletContext } from './ProjectLayout';

export const useCurrentProject = () => useOutletContext<ProjectOutletContext>().project;
