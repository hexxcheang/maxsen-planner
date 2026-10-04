import { Navigate, type RouteObject } from 'react-router';
import { AppShell } from './shell/AppShell';
import { RequireAuth } from './auth/RequireAuth';
import { PasscodeScreen } from '@/features/auth/PasscodeScreen';
import { DashboardScreen } from '@/features/dashboard/DashboardScreen';
import { NewProjectScreen } from '@/features/dashboard/NewProjectScreen';
import { ProjectLayout } from '@/features/project/ProjectLayout';
import { SetupScreen } from '@/features/setup/SetupScreen';
import { PlannerScreen } from '@/features/planner/PlannerScreen';
import { ReviewTotalsScreen } from '@/features/review/ReviewTotalsScreen';
import { ExportsScreen } from '@/features/exports/ExportsScreen';
import { QuoteScreen } from '@/features/quote/QuoteScreen';
import { ElectricalScreen } from '@/features/electrical/ElectricalScreen';
import { ProductSampleScreen } from '@/features/product-sample/ProductSampleScreen';
import { CatalogueScreen } from '@/features/catalogue/CatalogueScreen';
import { TemplatesScreen } from '@/features/templates/TemplatesScreen';
import { AdminScreen } from '@/features/admin/AdminScreen';
import { HelpScreen } from '@/features/help/HelpScreen';
import { StyleguideScreen } from '@/features/dev/StyleguideScreen';
import { NotFoundScreen } from '@/features/NotFoundScreen';

export const appRoutes: RouteObject[] = [
  { path: '/login', element: <PasscodeScreen /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardScreen /> },
      { path: 'projects/new', element: <NewProjectScreen /> },
      {
        path: 'projects/:projectId',
        element: <ProjectLayout />,
        children: [
          { index: true, element: <Navigate to="plan" replace /> },
          { path: 'setup', element: <SetupScreen /> },
          { path: 'plan', element: <PlannerScreen /> },
          { path: 'review', element: <ReviewTotalsScreen /> },
          { path: 'exports', element: <ExportsScreen /> },
        ],
      },
      { path: 'quote', element: <QuoteScreen /> },
      { path: 'electrical', element: <ElectricalScreen /> },
      { path: 'product-sample', element: <ProductSampleScreen /> },
      { path: 'catalogue', element: <CatalogueScreen /> },
      { path: 'templates', element: <TemplatesScreen /> },
      { path: 'admin', element: <AdminScreen /> },
      { path: 'help', element: <HelpScreen /> },
      ...(import.meta.env.DEV ? [{ path: 'dev/styleguide', element: <StyleguideScreen /> }] : []),
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
];
