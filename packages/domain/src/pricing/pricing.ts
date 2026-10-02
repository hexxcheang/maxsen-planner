/**
 * How Maxsen prices a job: packages for switches, lights and LED strips (from the price catalogue),
 * add-on rates beyond a package, and the company details printed on the invoice. Everything here is
 * editable in Admin › Pricing; these defaults come from the current catalogue and invoice template.
 */
import type { Settings } from '../types.ts';

export interface PricingSettings {
  company: {
    name: string;
    regNo: string;
    address: string[];
    phone: string;
    email: string;
    website: string;
  };
  /** Bank and contact paragraph at the foot of the invoice. */
  bankDetails: string;
  /** Delivery and payment terms paragraph. */
  terms: string;
  /** Warranty line printed (in blue) under the items. */
  warranty: string;
  /** Share of the total asked as deposit, in percent. */
  depositPercent: number;
  /** Invoice numbers are this prefix plus the date (yymmdd) and a 2-digit count. */
  invoicePrefix: string;
  switches: {
    packageSize: number;
    packagePrice: number;
    /** Invoice text for the package. */
    description: string;
    /** Aircon IR blasters and gateways each package includes (not charged separately). */
    includesAircon: number;
    includesGateways: number;
    addOnName: string;
    addOnPrice: number;
  };
  lights: {
    packageSize: number;
    packagePrice: number;
    /** Invoice text; {total} becomes the number of lights the packages cover. */
    description: string;
    addOnName: string;
    addOnPrice: number;
    integrationName: string;
    integrationPrice: number;
    integrationWaived: boolean;
  };
  led: {
    packageMetres: number;
    packageDrivers: number;
    packagePrice: number;
    /** Invoice text; {metres} and {drivers} become what the packages cover. */
    description: string;
    driverAddOnName: string;
    driverAddOnPrice: number;
    metreAddOnName: string;
    metreAddOnPrice: number;
    integrationName: string;
    integrationPrice: number;
    integrationWaived: boolean;
  };
  /** The latest price catalogue PDF, kept for reference. */
  catalogueFileId: string | null;
  catalogueName: string | null;
  catalogueUploadedAt: string | null;
}

export const DEFAULT_PRICING: PricingSettings = {
  company: {
    name: 'MAXSEN SMART HOME',
    regNo: 'Company Reg. No. 202433824M',
    address: ['9004 Tampines St 93, #2-122', 'Singapore 528838'],
    phone: '(+65) 89881882',
    email: 'Email: hexiang@maxsen.sg',
    website: 'Website: http://www.maxsen.sg',
  },
  bankDetails:
    'Bank details as follow:\n  - Beneficiary: Maxsen Smart Home Pte. Ltd.\n  - Bank: Oversea-Chinese Banking Corporation (OCBC)\n  - UEN.: 202433824M\nWe accept both cheque payment, bank transfer, PayNow. If you have any questions about this invoice, please contact Cheang He Xiang, 89881882, hexiang@maxsen.sg.',
  terms:
    'Delivery Terms: The services/items will commence after receiving 60% deposit.\nPayment Terms: Next, 30% to be paid on the starting date of installation of the proposed devices in the above statement. Last, 10% to be paid before the integration of all stated smart home devices into the smartlife application. Grant Total in the final invoice is subjected to changes made during the Installation process. ',
  warranty: '2 Years On-Site Warranty for All Devices Stated in the Invoice.',
  depositPercent: 60,
  invoicePrefix: 'MXN-HX-',
  switches: {
    packageSize: 10,
    packagePrice: 1990,
    description:
      'Nova Package\n10 x Nova Smart Series Switches \n4 x IR/RF Blasters\n1 x Ultra Gateway\nOn-Site Wiring Liaison with Your Electrician\nElectrical & Network Planning\nSmart Home Integration\nHands-On Usage Tutorial\nApp Integration of Add-On Devices\nWith Installation & Integration\nPackage Discounted to $1990 from $2690',
    includesAircon: 4,
    includesGateways: 1,
    addOnName: 'Add-On Per Nova+ Pro Smart Switch with Installation',
    addOnPrice: 180,
  },
  lights: {
    packageSize: 12,
    packagePrice: 988,
    description:
      'Luna Premier Light Package of 12 Downlights Sets \nwith 1 Nova+ Smart Portable Dimmer/Switch\n(Total {total} Selection of Smart Heat Sink Luna Downlights/Surface Lights/Tracklights)',
    addOnName:
      'Add On Per Luna Smart Light Selection (Was $118 Per Light Discounted to $78 with Package Price)',
    addOnPrice: 78,
    integrationName: 'Integration of Per Smart Lighting',
    integrationPrice: 15,
    integrationWaived: true,
  },
  led: {
    packageMetres: 30,
    packageDrivers: 6,
    packagePrice: 988,
    description:
      'Luna Cove LED Package of 30 Meters , 6 Driver + Smart Controller Set with 1 Nova+ Smart Portable Dimmer/Switch\n(Total {metres}Meters, {drivers} Drivers + Smart Controller)',
    driverAddOnName: 'Add-On Per Smart Control + Driver Set',
    driverAddOnPrice: 78,
    metreAddOnName: 'Add-On Per 1 Meter of Smart Lumi LED COB Strip',
    metreAddOnPrice: 18,
    integrationName: 'Integration of Per Smart Lighting',
    integrationPrice: 15,
    integrationWaived: true,
  },
  catalogueFileId: null,
  catalogueName: null,
  catalogueUploadedAt: null,
};

/** The pricing in effect: saved settings over the defaults. */
export function resolvePricing(settings: Pick<Settings, 'pricing'>): PricingSettings {
  const p = settings.pricing;
  if (!p) return DEFAULT_PRICING;
  return {
    ...DEFAULT_PRICING,
    ...p,
    company: { ...DEFAULT_PRICING.company, ...p.company },
    switches: { ...DEFAULT_PRICING.switches, ...p.switches },
    lights: { ...DEFAULT_PRICING.lights, ...p.lights },
    led: { ...DEFAULT_PRICING.led, ...p.led },
  };
}
