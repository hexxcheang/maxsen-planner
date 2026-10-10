import { Link } from 'react-router';
import { buttonClass } from '@/components/ui';
import { Page } from '@/components/Page';

export function NotFoundScreen() {
  return (
    <Page>
      <p className="text-meta text-ink-3">404</p>
      <h1 className="mt-1 text-title text-ink">Page not found</h1>
      <p className="mt-2 max-w-[60ch] text-body text-ink-2">
        The link may be out of date, or the project may have been deleted.
      </p>
      <Link to="/" className={`${buttonClass('primary')} mt-6`}>
        Go to projects
      </Link>
    </Page>
  );
}
