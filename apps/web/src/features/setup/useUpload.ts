import { useState } from 'react';
import { useToast } from '@/components/ui';
import { useActions } from '@/lib/data/hooks';
import { rasterizeImage, rasterizePdf, type RasterPage } from '@/lib/images';
import { putFile } from '@/lib/storage/file-store';

const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg'];

/** Reads PDFs and images into page images, stores them, and records them on the project. */
export function useUpload(projectId: string) {
  const actions = useActions();
  const { toast } = useToast();
  const [progress, setProgress] = useState<string | null>(null);

  const upload = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!ACCEPTED.includes(file.type)) {
        toast({
          title: `${file.name} can’t be used`,
          body: 'Upload a PDF, JPG or PNG.',
          tone: 'danger',
        });
        continue;
      }
      try {
        const isPdf = file.type === 'application/pdf';
        setProgress(`Reading ${file.name}`);
        const pages: RasterPage[] = isPdf
          ? await rasterizePdf(file, (done, total) =>
              setProgress(`Reading ${file.name}, page ${done} of ${total}`),
            )
          : [await rasterizeImage(file)];
        const sourceId = await putFile(file);
        const stored = [];
        for (const p of pages) {
          stored.push({
            fileId: await putFile(p.blob),
            thumbnailFileId: await putFile(p.thumb),
            width: p.width,
            height: p.height,
          });
        }
        actions.addSourceFile(projectId, {
          name: file.name,
          kind: isPdf ? 'pdf' : 'image',
          fileId: sourceId,
          pages: stored,
        });
        toast({
          title: `${file.name} added`,
          body: `${pages.length} ${pages.length === 1 ? 'page' : 'pages'} ready to use.`,
        });
      } catch (e) {
        console.error(e);
        toast({
          title: `${file.name} couldn’t be read`,
          body: 'The file may be damaged or password protected.',
          tone: 'danger',
        });
      }
    }
    setProgress(null);
  };

  return { upload, progress };
}
