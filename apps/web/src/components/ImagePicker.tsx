import { useRef, useState, type ReactNode } from 'react';
import { Upload } from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { putFile } from '@/lib/storage/file-store';

/** A button that stores a chosen PNG, JPG or SVG image and returns its file id. */
export function ImagePicker({
  label,
  onPicked,
  size = 'md',
}: {
  label: ReactNode;
  onPicked: (fileId: string) => void;
  size?: 'sm' | 'md';
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (!file.type.startsWith('image/')) {
            toast({ title: 'Choose a PNG, JPG or SVG image', tone: 'danger' });
            return;
          }
          setBusy(true);
          onPicked(await putFile(file));
          setBusy(false);
        }}
      />
      <Button
        size={size}
        icon={<Upload className="size-4" />}
        loading={busy}
        onClick={() => input.current?.click()}
      >
        {label}
      </Button>
    </>
  );
}
