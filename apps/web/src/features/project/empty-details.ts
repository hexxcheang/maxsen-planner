import type { ProjectDetails } from '@maxsen/domain';

export const EMPTY_DETAILS: ProjectDetails = {
  title: '',
  customerName: '',
  customerContact: '',
  propertyAddress: '',
  propertyType: null,
  status: 'draft',
};
