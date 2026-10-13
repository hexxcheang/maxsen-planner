import { useEffect } from 'react';
import { PageHeader } from '@/components/ui';
import { APP_VERSION } from '@/lib/version';

interface Topic {
  id: string;
  title: string;
  /** What the tab is for, in a sentence. */
  summary: string;
  /** How to do the usual things, in order. */
  steps?: { title: string; body: string }[];
  /** Things worth knowing. */
  notes?: string[];
}

const TOPICS: Topic[] = [
  {
    id: 'projects',
    title: 'Projects: planning a home',
    summary:
      'A project takes a client’s floor plans to a marked-up plan, a quantity list and a product description. Your work saves automatically as you go.',
    steps: [
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
        body: 'In the planner, drag variants from the library onto the plan. Draw LED strips and track lights as paths, type in LED lengths and head counts, and add notes where they help. Magic Plan can suggest rooms and devices to start from.',
      },
      {
        title: 'Review totals',
        body: 'Check the consolidated list for the whole project. Adjust export quantities if needed; the plans themselves never change, and you’ll be warned if a later edit changes a figure you adjusted.',
      },
      {
        title: 'Export',
        body: 'Generate the marked floor plan PDF, the quantity Excel file, the product description PDF and the client invoice, one at a time or all together.',
      },
    ],
    notes: [
      'Projects are shared: they save for the team about 15 seconds after you stop editing. The top bar says Saved for team, or Save now while a save is waiting.',
      'Projects someone else saved are under Saved by the team on the Projects page; Open brings one to your device. With admin unlocked, Delete removes one for everyone.',
      'If two people change the same project, the app asks whose version to keep. Nothing is overwritten silently.',
      'Deleting a shared project deletes it for everyone (the server keeps a copy that can be recovered).',
    ],
  },
  {
    id: 'leads',
    title: 'Leads',
    summary:
      'The team’s list of enquiries, from first contact until they become a project or are lost.',
    steps: [
      {
        title: 'Add a lead',
        body: 'New lead asks only for a name; phone and interest are optional. Everything else is filled in later as things progress.',
      },
      {
        title: 'Choose where it came from',
        body: 'Leads are split into MyDigitalLock and Maxsen leads. The switch at the top shows one list or both; a new lead starts in the list being shown.',
      },
      {
        title: 'Keep it moving',
        body: 'Open a lead to change its status, assign it, set a follow-up day, Last contacted and Expected reno date. Less used details are under More details.',
      },
      {
        title: 'Add notes',
        body: 'Notes are only ever added, never replaced, so everyone’s notes are kept with who wrote them.',
      },
      {
        title: 'Convert to project',
        body: 'When the client goes ahead, Convert to project starts a project with the lead’s details.',
      },
    ],
    notes: [
      'Statuses: New, Contacted, No reply yet, Meet-up set, Met / site visit done, Quoted, Considering quote, On hold (reno later), Won and Lost.',
      'Moving a lead to a stage where you spoke to them sets Last contacted to today. Change it if it was another day.',
      'Overdue follow-ups come first and are counted in red.',
      'Changes by anyone show at once on every device, without touching a lead someone has open. If someone else changed the lead you have open, you choose whose version to keep.',
      'Only the admin can delete a lead; everyone else marks it Lost.',
    ],
  },
  {
    id: 'timetable',
    title: 'Timetable',
    summary:
      'Sales meet-ups, site visits, deliveries, installations and integration appointments, week by week, the same for everyone.',
    steps: [
      {
        title: 'Unlock to schedule',
        body: 'Only the admin schedules. Admin: schedule asks for the admin passcode.',
      },
      {
        title: 'Add an appointment',
        body: 'Tap a day and time. Only the day and time are needed; the type, who’s going, project, client, address and notes (under More details) can be added later.',
      },
      {
        title: 'Message the people assigned',
        body: 'With WhatsApp the people assigned switched on (on the toolbar), saving an appointment offers a WhatsApp message for each person, with what, when, where (with a map link) and who else is going. Tap to open it in WhatsApp and send.',
      },
      {
        title: 'Filter the week',
        body: 'Appointment type shows one kind at a time. Each kind has its own colour; the legend is under the toolbar.',
      },
    ],
    notes: [
      'A warning triangle marks a person booked twice at the same time.',
      'People and their WhatsApp numbers come from the Team tab, which only the exclusive admin sees. Everyone else sees names only.',
      'Changes show on every device at once, with no reload.',
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    summary: 'Stock, kept as a record of every item going out, coming back and arriving.',
    steps: [
      {
        title: 'Take out',
        body: 'Installers say which site, pick the products and how many. Stock goes down at once.',
      },
      {
        title: 'Return unused',
        body: 'Items not installed go back to stock with Return unused.',
      },
      {
        title: 'Site checks',
        body: 'The inventory manager counts what was really used on each site and presses Confirm count. Stock follows the count and any difference is marked.',
      },
      {
        title: 'Restock and correct',
        body: 'The manager records stock arriving with Restock, and fixes after a physical count with Count correction.',
      },
    ],
    notes: [
      'Stock shows what’s in, what’s out but not checked yet, and flags items at or below their low-stock level.',
      'History lists every entry; the manager can remove one recorded by mistake.',
      'The inventory manager is whoever has the admin passcode. Products come from the shared catalogue.',
    ],
  },
  {
    id: 'claims',
    title: 'Claims',
    summary: 'Expenses paid for work, with their receipts, for the admin to approve.',
    steps: [
      {
        title: 'Make a claim',
        body: 'Add the date, amount and what it was for (optionally a category and the site), and a photo or PDF of each receipt.',
      },
      {
        title: 'Change or withdraw',
        body: 'A claim can be changed or withdrawn while it’s waiting.',
      },
      {
        title: 'Approve or reject (admin)',
        body: 'The admin approves a claim, or rejects it with a reason. Everyone sees where theirs stands.',
      },
      {
        title: 'Pay out',
        body: 'Download (Excel) saves the claims shown, for paying them.',
      },
    ],
    notes: ['Photos are made smaller before they’re sent, so they upload quickly on mobile data.'],
  },
  {
    id: 'team',
    title: 'Team',
    summary:
      'Everyone at Maxsen with their role and WhatsApp number, seen only by the exclusive admin (the owner). The timetable assigns and messages people from here.',
    steps: [
      {
        title: 'Unlock the exclusive admin',
        body: 'Use any Unlock admin button and enter the exclusive admin’s passcode. Team then shows in the menu. The admin’s passcode doesn’t open it.',
      },
      {
        title: 'Add or edit someone',
        body: 'Add person, or tap a name. Set the role, WhatsApp number, email, joined date and notes.',
      },
      {
        title: 'Check the WhatsApp number',
        body: 'A Singapore mobile (8 digits starting 8 or 9) gets +65 added. Numbers from elsewhere need their country code, e.g. +60. A good number shows Saved as +65 9123 4567; Test it opens their WhatsApp chat so you can check it’s the right person.',
      },
      {
        title: 'When someone leaves',
        body: 'Switch them off Active to keep their profile without offering them on the timetable. Remove deletes the profile for everyone.',
      },
    ],
    notes: [
      'A warning at the top lists anyone active with no WhatsApp number yet.',
      'Anyone assigned on the timetable who isn’t on the team yet is added to it.',
      'Everyone else sees only names on the timetable. The admin also gets the WhatsApp numbers, to message the people assigned.',
      'Locking admin or signing out removes the team’s details from that device.',
    ],
  },
  {
    id: 'quote',
    title: 'Quote',
    summary:
      'A quick quotation from a client’s message, or the next payment invoice from an old invoice.',
    steps: [
      {
        title: 'New quote',
        body: 'Paste the client’s message. The items are priced with the packages and add-ons; check each line, add anything not recognised by hand, or add your own item.',
      },
      {
        title: 'Choose the payment',
        body: 'Deposit, 2nd payment, Final or Full payment (the whole total, paid at once). Add a Total discount if one was agreed.',
      },
      {
        title: 'Send it',
        body: 'Copy as text to paste back into the chat, or download the quotation as PDF or Excel.',
      },
      {
        title: 'Old invoice: next payment',
        body: 'Open the old invoice as PDF or Excel (or paste its lines). Its lines, invoice number, discounts and what was paid are read in, and the 2nd or final payment is worked out. Lines marked Check this line need a look.',
      },
    ],
    notes: [
      'The final payment invoice carries the warranty and handover terms (including the app ownership handover).',
      'Prices and packages come from Admin › Pricing.',
      'Free gifts shown as “-” on an old invoice are read as S$0.',
    ],
  },
  {
    id: 'electrical',
    title: 'Electrical',
    summary:
      'Price electrical works at average Singapore rates, by quantity or by marking symbols on a floor plan.',
    steps: [
      {
        title: 'Enter the works',
        body: 'Search electrical works and set quantities. Rates are a guide; change any rate to match your electrician’s.',
      },
      {
        title: 'Or plot them on the plan',
        body: 'Add a floor plan drawing and place symbols on it. Counts flow into the quotation.',
      },
      {
        title: 'Adjust and quote',
        body: 'Add discounts or charges under Price adjustments, set the deposit, then download the quotation or the plan as PDF.',
      },
    ],
    notes: ['Rates are before GST.'],
  },
  {
    id: 'sample',
    title: 'Sample',
    summary: 'Turn a photo of a product into a picture of it installed in a home, for clients.',
    steps: [
      {
        title: 'Add the photo',
        body: 'Upload the product photo and say what it is.',
      },
      {
        title: 'Pick the scene',
        body: 'Choose the room, interior style and light, and add anything else. The product is kept as photographed.',
      },
    ],
    notes: ['Needs the Gemini key set up on the server.'],
  },
  {
    id: 'catalogue',
    title: 'Catalogue and Templates',
    summary:
      'The catalogue is the products offered in the planner library; templates are approved starting layouts for new projects.',
    notes: [
      'Catalogue: categories, products and variants with their customer descriptions. Hide a variant to stop offering it; projects keep the names and descriptions they were planned with.',
      'Templates: a new project copies the template’s levels and export settings, then gets its own drawings in Setup.',
      'The catalogue is shared with the whole team.',
    ],
  },
  {
    id: 'admin',
    title: 'Admin',
    summary: 'Settings for the whole team, behind the admin passcode. Changes apply straight away.',
    notes: [
      'Branding: company name, showrooms, contact details and bank details used on every export.',
      'Pricing: package prices and contents, add-ons, integration, deposit and 2nd payment percentages, the invoice number prefix, the delivery and payment terms and the final payment terms. Upload price catalogue updates prices from the client’s catalogue.',
      'Icon styles: how devices look on the exported plans.',
      'Favourites: variants the team uses most, offered first in the planner.',
      'Your data: restore the sample data or start with an empty workspace on this device.',
      'Admin-only actions elsewhere: scheduling the timetable, approving claims, the inventory manager’s steps and deleting leads.',
      'The Team tab needs the exclusive admin (the owner), a separate passcode above the admin’s.',
    ],
  },
];

export function HelpScreen() {
  // Open at a topic from a link such as /help#leads.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  return (
    <div data-screen-ready className="px-[var(--gutter)] pt-7 pb-16">
      <div className="max-w-[760px]">
        <PageHeader
          title="Help"
          description="How each part of the planner works. Tap a topic to jump to it."
        />
        <nav aria-label="Help topics" className="mb-6 flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth' });
                history.replaceState(null, '', `#${t.id}`);
              }}
              className="rounded-chip border border-rule bg-surface px-3 py-1 text-control text-ink hover:border-ink-3"
            >
              {t.title.split(':')[0]}
            </a>
          ))}
        </nav>
        {TOPICS.map((t) => (
          <section
            key={t.id}
            id={t.id}
            aria-labelledby={`${t.id}-title`}
            className="scroll-mt-4 border-t border-rule pt-6 pb-8"
          >
            <h2 id={`${t.id}-title`} className="text-section text-ink">
              {t.title}
            </h2>
            <p className="mt-1 max-w-[64ch] text-body text-ink-2">{t.summary}</p>
            {t.steps && (
              <ol aria-label={`${t.title.split(':')[0]} steps`} className="mt-4 flex flex-col">
                {t.steps.map((s, i) => (
                  <li
                    key={s.title}
                    className="grid grid-cols-[32px_1fr] gap-x-3 border-b border-rule py-3 last:border-b-0"
                  >
                    <span className="tnum pt-0.5 text-body text-brass-2" aria-hidden>
                      {i + 1}
                    </span>
                    <div>
                      <h3 className="text-body font-medium text-ink">{s.title}</h3>
                      <p className="mt-0.5 max-w-[64ch] text-body text-ink-2">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {t.notes && (
              <div className="mt-4 rounded-md border border-rule bg-surface px-4 py-3">
                <h3 className="text-meta font-medium tracking-wide text-ink-3 uppercase">
                  Good to know
                </h3>
                <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-control text-ink-2">
                  {t.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
        <p className="mt-2 text-meta text-ink-3">App version {APP_VERSION}</p>
      </div>
    </div>
  );
}
