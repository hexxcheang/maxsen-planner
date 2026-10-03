import { useState, type FormEvent } from 'react';
import type { Product } from '@maxsen/domain';
import { Button, Dialog, Field, Input, Switch } from '@/components/ui';

interface Props {
  open: boolean;
  product: Product | null;
  categoryName: string;
  onOpenChange: (open: boolean) => void;
  onSave: (input: { name: string; hidden: boolean }) => void;
}

export function ProductEditorDialog({ open, product, categoryName, onOpenChange, onSave }: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width="sm"
      title={product ? 'Edit product' : 'Add product'}
      description={categoryName}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="product-editor" variant="primary">
            Save product
          </Button>
        </>
      }
    >
      {open && <ProductForm product={product} onSave={onSave} />}
    </Dialog>
  );
}

function ProductForm({ product, onSave }: { product: Product | null; onSave: Props['onSave'] }) {
  const [name, setName] = useState(product?.name ?? '');
  const [hidden, setHidden] = useState(product?.hidden ?? false);
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Enter a product name');
      return;
    }
    onSave({ name: name.trim(), hidden });
  };
  return (
    <form id="product-editor" onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Product name" error={error}>
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      {!product?.system && (
        <Switch
          checked={hidden}
          onCheckedChange={setHidden}
          label="Hidden"
          description="Hidden products leave the library and search. Existing plans keep them."
        />
      )}
      {product?.system && (
        <p className="text-meta text-ink-2">
          Added automatically to totals. It can be renamed but never hidden or deleted.
        </p>
      )}
    </form>
  );
}
