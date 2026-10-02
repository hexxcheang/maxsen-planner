import { useState, type FormEvent } from 'react';
import { ImageUp } from 'lucide-react';
import type { Variant } from '@maxsen/domain';
import { Button, Dialog, Field, Input, NumberField, Switch, Textarea } from '@/components/ui';
import { fileUrl } from '@/lib/files';
import { ImagePicker } from '@/components/ImagePicker';

interface Props {
  open: boolean;
  variant: Variant | null;
  productName: string;
  onOpenChange: (open: boolean) => void;
  onSave: (input: {
    name: string;
    description: string;
    hidden: boolean;
    imageFileId: string | null;
    price: number | null;
  }) => void;
  /** LED strips are priced per metre. */
  perMetre?: boolean;
}

export function VariantEditorDialog({
  open,
  variant,
  productName,
  onOpenChange,
  onSave,
  perMetre = false,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={variant ? 'Edit variant' : 'Add variant'}
      description={productName}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="variant-editor" variant="primary">
            Save variant
          </Button>
        </>
      }
    >
      {open && <VariantForm variant={variant} onSave={onSave} perMetre={perMetre} />}
    </Dialog>
  );
}

function VariantForm({
  variant,
  onSave,
  perMetre,
}: {
  variant: Variant | null;
  onSave: Props['onSave'];
  perMetre: boolean;
}) {
  const [price, setPrice] = useState<number | null>(variant?.price ?? null);
  const [name, setName] = useState(variant?.name ?? '');
  const [description, setDescription] = useState(variant?.description ?? '');
  const [hidden, setHidden] = useState(variant?.hidden ?? false);
  const [imageFileId, setImageFileId] = useState<string | null>(variant?.imageFileId ?? null);
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter a variant name');
      return;
    }
    onSave({ name: name.trim(), description: description.trim(), hidden, imageFileId, price });
  };
  return (
    <form
      id="variant-editor"
      onSubmit={submit}
      noValidate
      className="grid grid-cols-[120px_1fr] gap-5"
    >
      <div className="flex flex-col gap-2">
        <span className="flex aspect-square items-center justify-center overflow-hidden rounded-chip border border-rule bg-paper">
          {imageFileId ? (
            <img src={fileUrl(imageFileId)} alt="" className="size-full object-contain" />
          ) : (
            <ImageUp aria-hidden className="size-6 text-ink-3" />
          )}
        </span>
        <ImagePicker
          size="sm"
          label={imageFileId ? 'Replace image' : 'Upload image'}
          onPicked={setImageFileId}
        />
      </div>
      <div className="flex flex-col gap-4">
        <Field label="Variant name" error={error}>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Customer description" hint="Shown in the product description PDF">
          <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field
          label={perMetre ? 'Price per metre (S$)' : 'Price (S$)'}
          optional
          hint="Used on the invoice only. Never shown to the client in the product description."
        >
          <NumberField
            value={price}
            min={0}
            precision={2}
            allowEmpty
            aria-label={perMetre ? 'Price per metre' : 'Price'}
            onChange={setPrice}
          />
        </Field>
        <Switch
          checked={hidden}
          onCheckedChange={setHidden}
          label="Hidden"
          description="Hidden variants leave the library, search and favourites. Existing plans keep them."
        />
      </div>
    </form>
  );
}
