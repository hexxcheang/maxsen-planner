import { useState } from 'react';
import { Copy, Download, Zap } from 'lucide-react';
import {
  STAGE_LABEL,
  type Invoice,
  type PricingSettings,
  type Project,
  type Settings,
  type StageAmounts,
} from '@maxsen/domain';
import { Button, Dialog, useToast } from '@/components/ui';
import { useActions } from '@/lib/data/hooks';
import { QuotationTable } from '@/features/quote/QuotationTable';
import { money, quotationText, withRowEdit } from '@/features/quote/quotation';
import { buildQuotationPdf } from './build/generate';
import { ElectricalWorksDialog } from '@/features/electrical/ElectricalWorksDialog';
import { CustomItemForm } from '@/features/quote/CustomItemForm';
import { mergeExtraLines } from '@maxsen/domain';
import { copyText } from '@/lib/clipboard';

/**
 * The project's invoice as an editable quotation, like Quick quote: change any row's unit price
 * or give a discount (S$ or %). Edits are saved with the project and used by the invoice Excel,
 * the quotation PDF and every payment's amount; quantities stay in sync with Review totals.
 */
export function InvoicePricesDialog({
  open,
  onOpenChange,
  project,
  settings,
  pricing,
  base,
  invoice,
  amounts,
  number,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  settings: Settings;
  pricing: PricingSettings;
  base: Invoice;
  invoice: Invoice;
  amounts: StageAmounts;
  number: string;
}) {
  const actions = useActions();
  const { toast } = useToast();
  const [making, setMaking] = useState(false);
  const [addingWorks, setAddingWorks] = useState(false);
  const isExtra = (key: string) => key.startsWith('extra:');
  const extraId = (key: string) => key.slice('extra:'.length);
  const edits = project.exportSettings.priceEdits ?? {};
  const client = { name: project.customerName, contact: project.customerContact };

  const copy = async () => {
    try {
      await copyText(quotationText({ invoice, pricing, number, clientName: client.name }));
      toast({ title: 'Quotation copied', body: 'Paste it into WhatsApp or an email.' });
    } catch {
      toast({
        title: 'Couldn’t copy',
        body: 'Your browser blocked the clipboard.',
        tone: 'danger',
      });
    }
  };
  const downloadPdf = async () => {
    setMaking(true);
    try {
      const blob = await buildQuotationPdf({ client, invoice, pricing, number, settings });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quotation ${number}${client.name ? ` - ${client.name}` : ''}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error(e);
      toast({ title: 'The quotation couldn’t be made', tone: 'danger' });
    } finally {
      setMaking(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width="xl"
      title="Prices and discounts"
      description="Quantities follow Review totals. Add your own items not in the catalogue, change a unit price, or type a discount as S$ (50) or a percentage (10%); it’s saved with the project and used on every invoice."
      footer={
        <>
          {Object.keys(edits).length > 0 && (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() =>
                actions.updateExportSettings(project.id, (s) => {
                  delete s.priceEdits;
                })
              }
            >
              Reset to list prices
            </Button>
          )}
          <Button icon={<Zap className="size-4" />} onClick={() => setAddingWorks(true)}>
            Add electrical works
          </Button>
          <Button icon={<Copy className="size-4" />} onClick={() => void copy()}>
            Copy as text
          </Button>
          <Button
            icon={<Download className="size-4" />}
            loading={making}
            onClick={() => void downloadPdf()}
          >
            Download quotation (PDF)
          </Button>
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </>
      }
    >
      <div className="mb-4">
        <CustomItemForm
          onAdd={(line) =>
            actions.updateExportSettings(project.id, (s) => {
              s.extraLines = [...(s.extraLines ?? []), line];
            })
          }
        />
      </div>
      <QuotationTable
        base={base}
        invoice={invoice}
        edits={edits}
        onEdit={(key, patch) =>
          actions.updateExportSettings(project.id, (s) => {
            s.priceEdits = withRowEdit(s.priceEdits, key, patch);
          })
        }
        depositPercent={pricing.depositPercent}
        editable={isExtra}
        renamable={(key) =>
          (project.exportSettings.extraLines ?? []).some((l) => l.custom && l.id === extraId(key))
        }
        onDescription={(key, description) =>
          actions.updateExportSettings(project.id, (s) => {
            const l = s.extraLines?.find((x) => x.id === extraId(key));
            if (l) l.description = description;
          })
        }
        onQuantity={(key, quantity) =>
          actions.updateExportSettings(project.id, (s) => {
            const l = s.extraLines?.find((x) => x.id === extraId(key));
            if (l) l.quantity = quantity;
          })
        }
        onRemove={(key) =>
          actions.updateExportSettings(project.id, (s) => {
            s.extraLines = s.extraLines?.filter((x) => x.id !== extraId(key));
          })
        }
        footer={
          amounts.stage !== 'deposit' && (
            <>
              {amounts.stage !== 'full' && (
                <tr>
                  <td colSpan={4} className="py-1 text-right text-ink-2">
                    Already paid
                  </td>
                  <td className="tnum py-1 text-right text-ink-2">{money(-amounts.paid)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={4} className="py-1 text-right font-semibold text-ink">
                  {STAGE_LABEL[amounts.stage]} due
                </td>
                <td className="tnum py-1 text-right font-semibold text-ink">
                  {money(amounts.due)}
                </td>
              </tr>
            </>
          )
        }
      />
      <ElectricalWorksDialog
        open={addingWorks}
        onOpenChange={setAddingWorks}
        onAdd={(lines) =>
          actions.updateExportSettings(project.id, (s) => {
            s.extraLines = mergeExtraLines(s.extraLines, lines);
          })
        }
      />
    </Dialog>
  );
}
