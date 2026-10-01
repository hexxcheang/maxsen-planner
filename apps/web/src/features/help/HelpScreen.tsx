import { PageHeader } from '@/components/ui';

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Upload the drawings',
    body: 'In Setup, add the customer’s floor plans as PDFs (any number of pages) or JPG and PNG images.',
  },
  {
    title: 'Select the pages you need',
    body: 'Every page appears as a thumbnail. Pick the pages that show usable floor plans and ignore the rest.',
  },
  {
    title: 'Crop and rotate',
    body: 'Turn each drawing upright in 90° steps and crop away title blocks or margins. Reset the crop at any time before you start planning.',
  },
  {
    title: 'Name the levels',
    body: 'Add a level for each floor, for example Level 1, Level 2 and Attic, put them in order and choose A4 or A3 and portrait or landscape for their export pages.',
  },
  {
    title: 'Assign Smart Home and Lighting plans',
    body: 'Each level can have a Smart Home Plan and a Lighting Plan. Choose a drawing for each one; once assigned, the drawing is locked as the plan’s background.',
  },
  {
    title: 'Place devices',
    body: 'In the planner, drag variants from the library onto the plan. Draw LED strips and track lights as paths, type in LED lengths and head counts, and add notes where they help.',
  },
  {
    title: 'Review totals',
    body: 'Check the consolidated list for the whole project. Adjust export quantities if needed; the plans themselves never change, and you’ll be warned if a later edit changes a figure you adjusted.',
  },
  {
    title: 'Export',
    body: 'Generate the marked floor plan PDF, the quantity Excel file and the product description PDF, one at a time or all together.',
  },
];

export function HelpScreen() {
  return (
    <div data-screen-ready className="px-[var(--gutter)] pt-7 pb-16">
      <div className="max-w-[720px]">
        <PageHeader
          title="How planning works"
          description="Eight steps take a project from the customer’s drawings to the three exports. Your work saves automatically as you go."
        />
        <ol aria-label="Workflow steps" className="flex flex-col border-t border-rule">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="grid grid-cols-[40px_1fr] gap-x-4 border-b border-rule py-5"
            >
              <span className="tnum pt-0.5 text-section text-brass-2" aria-hidden>
                {i + 1}
              </span>
              <div>
                <h2 className="text-section text-ink">{step.title}</h2>
                <p className="mt-1 max-w-[64ch] text-body text-ink-2">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
