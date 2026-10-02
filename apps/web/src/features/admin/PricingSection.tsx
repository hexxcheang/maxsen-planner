import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { FileText, Upload } from 'lucide-react';
import { resolvePricing, type PricingSettings } from '@maxsen/domain';
import {
  Button,
  buttonClass,
  Field,
  Input,
  NumberField,
  Switch,
  Textarea,
  useToast,
} from '@/components/ui';
import { fileUrl } from '@/lib/files';
import { formatDateTime } from '@/lib/format';
import { useActions, useSettings } from '@/lib/data/hooks';
import { putFile } from '@/lib/storage/file-store';

function Group({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <>
      <div>
        <h3 className="text-control font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-meta text-ink-2">{note}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">{children}</div>
    </>
  );
}

const wide = 'col-span-2 max-[700px]:col-span-1';

/**
 * Packages, add-on rates and invoice details used to build the client invoice, plus the latest
 * price catalogue PDF for reference. Device prices themselves are set per variant in Catalogue.
 */
export function PricingSection() {
  const { data: settings } = useSettings();
  const actions = useActions();
  const { toast } = useToast();
  const [draft, setDraft] = useState<PricingSettings>(() => resolvePricing(settings));
  const fileInput = useRef<HTMLInputElement>(null);
  const saved = resolvePricing(settings);

  const set = <K extends keyof PricingSettings>(k: K, v: PricingSettings[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  const setIn = <K extends 'company' | 'switches' | 'lights' | 'led'>(
    k: K,
    patch: Partial<PricingSettings[K]>,
  ) => setDraft((d) => ({ ...d, [k]: { ...d[k], ...patch } }));
  const num = (v: number | null) => v ?? 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    actions.updateSettings((s) => {
      s.pricing = structuredClone({
        ...draft,
        catalogueFileId: saved.catalogueFileId,
        catalogueName: saved.catalogueName,
        catalogueUploadedAt: saved.catalogueUploadedAt,
      });
    });
    toast({ title: 'Pricing saved', body: 'New invoices use these packages and details.' });
  };

  const uploadCatalogue = async (file: File) => {
    const id = await putFile(file);
    actions.updateSettings((s) => {
      s.pricing = structuredClone({
        ...resolvePricing(s),
        catalogueFileId: id,
        catalogueName: file.name,
        catalogueUploadedAt: new Date().toISOString(),
      });
    });
    toast({
      title: 'Catalogue uploaded',
      body: 'Update the package prices below and device prices in Catalogue to match it.',
    });
  };

  return (
    <form
      onSubmit={submit}
      aria-label="Pricing"
      className="grid max-w-[980px] grid-cols-[220px_minmax(0,1fr)] gap-x-10 gap-y-8 max-[1180px]:grid-cols-1"
    >
      <div>
        <h3 className="text-control font-semibold text-ink">Price catalogue</h3>
        <p className="mt-1 text-meta text-ink-2">
          Keep your newest catalogue here for reference. Prices aren’t read from it automatically:
          update the packages below and each device’s price in Catalogue.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {saved.catalogueFileId ? (
          <a
            href={fileUrl(saved.catalogueFileId)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-control text-ink underline"
          >
            <FileText aria-hidden className="size-4 text-ink-2" />
            {saved.catalogueName}
          </a>
        ) : (
          <span className="text-meta text-ink-3">No catalogue uploaded yet</span>
        )}
        {saved.catalogueUploadedAt && (
          <span className="text-meta text-ink-3">
            uploaded {formatDateTime(saved.catalogueUploadedAt)}
          </span>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          aria-label="Upload price catalogue"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadCatalogue(f);
            e.target.value = '';
          }}
        />
        <Button
          size="sm"
          icon={<Upload className="size-3.5" />}
          onClick={() => fileInput.current?.click()}
        >
          {saved.catalogueFileId ? 'Upload newer catalogue' : 'Upload catalogue (PDF)'}
        </Button>
      </div>

      <Group
        title="Switch package"
        note="Every this many smart switches on a project make one package. Extra switches are charged at the add-on rate."
      >
        <Field label="Switches per package">
          <NumberField
            value={draft.switches.packageSize}
            min={1}
            onChange={(v) => setIn('switches', { packageSize: num(v) })}
          />
        </Field>
        <Field label="Package price (S$)">
          <NumberField
            value={draft.switches.packagePrice}
            min={0}
            precision={2}
            onChange={(v) => setIn('switches', { packagePrice: num(v) })}
          />
        </Field>
        <Field label="IR blasters included per package">
          <NumberField
            value={draft.switches.includesAircon}
            min={0}
            onChange={(v) => setIn('switches', { includesAircon: num(v) })}
          />
        </Field>
        <Field label="Gateways included per package">
          <NumberField
            value={draft.switches.includesGateways}
            min={0}
            onChange={(v) => setIn('switches', { includesGateways: num(v) })}
          />
        </Field>
        <Field label="Add-on line" className="col-span-1">
          <Input
            value={draft.switches.addOnName}
            onChange={(e) => setIn('switches', { addOnName: e.target.value })}
          />
        </Field>
        <Field label="Add-on price per switch (S$)">
          <NumberField
            value={draft.switches.addOnPrice}
            min={0}
            precision={2}
            onChange={(v) => setIn('switches', { addOnPrice: num(v) })}
          />
        </Field>
        <Field label="Package text on the invoice" className={wide}>
          <Textarea
            rows={6}
            value={draft.switches.description}
            onChange={(e) => setIn('switches', { description: e.target.value })}
          />
        </Field>
      </Group>

      <Group
        title="Light package"
        note="Downlights and surface lights together. {total} in the text becomes the number of lights the packages cover."
      >
        <Field label="Lights per package">
          <NumberField
            value={draft.lights.packageSize}
            min={1}
            onChange={(v) => setIn('lights', { packageSize: num(v) })}
          />
        </Field>
        <Field label="Package price (S$)">
          <NumberField
            value={draft.lights.packagePrice}
            min={0}
            precision={2}
            onChange={(v) => setIn('lights', { packagePrice: num(v) })}
          />
        </Field>
        <Field label="Add-on line">
          <Input
            value={draft.lights.addOnName}
            onChange={(e) => setIn('lights', { addOnName: e.target.value })}
          />
        </Field>
        <Field label="Add-on price per light (S$)">
          <NumberField
            value={draft.lights.addOnPrice}
            min={0}
            precision={2}
            onChange={(v) => setIn('lights', { addOnPrice: num(v) })}
          />
        </Field>
        <Field label="Integration per light (S$)">
          <NumberField
            value={draft.lights.integrationPrice}
            min={0}
            precision={2}
            onChange={(v) => setIn('lights', { integrationPrice: num(v) })}
          />
        </Field>
        <Switch
          checked={draft.lights.integrationWaived}
          onCheckedChange={(v) => setIn('lights', { integrationWaived: v })}
          label="Waive integration"
        />
        <Field label="Package text on the invoice" className={wide}>
          <Textarea
            rows={3}
            value={draft.lights.description}
            onChange={(e) => setIn('lights', { description: e.target.value })}
          />
        </Field>
      </Group>

      <Group
        title="LED strip package"
        note="{metres} and {drivers} in the text become what the packages cover. Extra metres and drivers are charged at the add-on rates."
      >
        <Field label="Metres per package">
          <NumberField
            value={draft.led.packageMetres}
            min={1}
            unit="m"
            onChange={(v) => setIn('led', { packageMetres: num(v) })}
          />
        </Field>
        <Field label="Drivers per package">
          <NumberField
            value={draft.led.packageDrivers}
            min={0}
            onChange={(v) => setIn('led', { packageDrivers: num(v) })}
          />
        </Field>
        <Field label="Package price (S$)">
          <NumberField
            value={draft.led.packagePrice}
            min={0}
            precision={2}
            onChange={(v) => setIn('led', { packagePrice: num(v) })}
          />
        </Field>
        <Field label="Integration per driver (S$)">
          <NumberField
            value={draft.led.integrationPrice}
            min={0}
            precision={2}
            onChange={(v) => setIn('led', { integrationPrice: num(v) })}
          />
        </Field>
        <Field label="Driver add-on line">
          <Input
            value={draft.led.driverAddOnName}
            onChange={(e) => setIn('led', { driverAddOnName: e.target.value })}
          />
        </Field>
        <Field label="Add-on price per driver set (S$)">
          <NumberField
            value={draft.led.driverAddOnPrice}
            min={0}
            precision={2}
            onChange={(v) => setIn('led', { driverAddOnPrice: num(v) })}
          />
        </Field>
        <Field label="Strip add-on line">
          <Input
            value={draft.led.metreAddOnName}
            onChange={(e) => setIn('led', { metreAddOnName: e.target.value })}
          />
        </Field>
        <Field label="Add-on price per metre (S$)">
          <NumberField
            value={draft.led.metreAddOnPrice}
            min={0}
            precision={2}
            onChange={(v) => setIn('led', { metreAddOnPrice: num(v) })}
          />
        </Field>
        <Switch
          checked={draft.led.integrationWaived}
          onCheckedChange={(v) => setIn('led', { integrationWaived: v })}
          label="Waive integration"
        />
        <Field label="Package text on the invoice" className={wide}>
          <Textarea
            rows={3}
            value={draft.led.description}
            onChange={(e) => setIn('led', { description: e.target.value })}
          />
        </Field>
      </Group>

      <Group
        title="Invoice details"
        note="The header, numbering, deposit and terms printed on every invoice."
      >
        <Field label="Company name">
          <Input
            value={draft.company.name}
            onChange={(e) => setIn('company', { name: e.target.value })}
          />
        </Field>
        <Field label="Registration line">
          <Input
            value={draft.company.regNo}
            onChange={(e) => setIn('company', { regNo: e.target.value })}
          />
        </Field>
        <Field label="Address (one line per row)" className={wide}>
          <Textarea
            rows={2}
            value={draft.company.address.join('\n')}
            onChange={(e) => setIn('company', { address: e.target.value.split('\n') })}
          />
        </Field>
        <Field label="Phone line">
          <Input
            value={draft.company.phone}
            onChange={(e) => setIn('company', { phone: e.target.value })}
          />
        </Field>
        <Field label="Email line">
          <Input
            value={draft.company.email}
            onChange={(e) => setIn('company', { email: e.target.value })}
          />
        </Field>
        <Field label="Website line">
          <Input
            value={draft.company.website}
            onChange={(e) => setIn('company', { website: e.target.value })}
          />
        </Field>
        <Field
          label="Invoice number prefix"
          hint="Followed by the date (yymmdd) and a 2-digit count."
        >
          <Input
            value={draft.invoicePrefix}
            onChange={(e) => set('invoicePrefix', e.target.value)}
          />
        </Field>
        <Field label="Deposit requested (%)">
          <NumberField
            value={draft.depositPercent}
            min={0}
            max={100}
            onChange={(v) => set('depositPercent', num(v))}
          />
        </Field>
        <Field label="Warranty line" className={wide}>
          <Input value={draft.warranty} onChange={(e) => set('warranty', e.target.value)} />
        </Field>
        <Field label="Delivery and payment terms" className={wide}>
          <Textarea rows={4} value={draft.terms} onChange={(e) => set('terms', e.target.value)} />
        </Field>
        <Field label="Bank details and contact" className={wide}>
          <Textarea
            rows={5}
            value={draft.bankDetails}
            onChange={(e) => set('bankDetails', e.target.value)}
          />
        </Field>
      </Group>

      <div />
      <div className="flex gap-3">
        <Button type="submit" variant="primary">
          Save pricing
        </Button>
        <button
          type="button"
          className={buttonClass('secondary', 'md')}
          onClick={() => setDraft(resolvePricing(settings))}
        >
          Discard changes
        </button>
      </div>
    </form>
  );
}
