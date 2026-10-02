import { Lock, ShieldCheck } from 'lucide-react';
import {
  Button,
  EmptyState,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { Page } from '@/components/Page';
import { useAdmin } from '@/app/auth/auth-context';
import { BrandingSection } from './BrandingSection';
import { DataSection } from './DataSection';
import { FavouritesSection } from './FavouritesSection';
import { IconStylesSection } from './IconStylesSection';

export function AdminScreen() {
  const admin = useAdmin();
  if (!admin.unlocked) {
    return (
      <Page>
        <PageHeader title="Admin settings" />
        <EmptyState
          icon={<Lock />}
          title="Admin settings are locked"
          body="Branding, icon styles and shared favourites need the admin passcode."
          action={
            <Button
              variant="primary"
              icon={<ShieldCheck className="size-4" />}
              onClick={() => void admin.requireAdmin('open admin settings')}
            >
              Unlock admin
            </Button>
          }
        />
      </Page>
    );
  }
  return (
    <Page wide>
      <PageHeader
        title="Admin settings"
        description="Changes apply to the whole team straight away."
        actions={
          <Button icon={<Lock className="size-4" />} onClick={admin.lock}>
            Lock admin
          </Button>
        }
      />
      <Tabs defaultValue="branding">
        <TabsList label="Admin sections" className="mb-6">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="icons">Icon styles</TabsTrigger>
          <TabsTrigger value="favourites">Favourites</TabsTrigger>
          <TabsTrigger value="data">Your data</TabsTrigger>
        </TabsList>
        <TabsContent value="branding">
          <BrandingSection />
        </TabsContent>
        <TabsContent value="icons">
          <IconStylesSection />
        </TabsContent>
        <TabsContent value="favourites">
          <FavouritesSection />
        </TabsContent>
        <TabsContent value="data">
          <DataSection />
        </TabsContent>
      </Tabs>
    </Page>
  );
}
