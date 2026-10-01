import type { Settings } from '../types.ts';

/** Settings a fresh installation starts with (branding filled in by the admin). */
export const DEFAULT_SETTINGS: Settings = {
  branding: {
    logoFileId: null,
    whatsapp: '+65 8000 0000',
    website: 'maxsen.sg',
    showrooms: [
      { name: 'Tampines Showroom', address: '10 Tampines Central 1, #02-11, Singapore 529536' },
      { name: 'Yishun Showroom', address: '930 Yishun Avenue 2, #03-04, Singapore 769098' },
    ],
    contactWording:
      'Thank you for planning your home with Maxsen. Visit a showroom or message us on WhatsApp to discuss your layout.',
  },
  categoryStyles: {},
  favouriteVariantIds: [],
};

/** Settings used by the Phase A prototype: defaults plus a logo and shared favourites. */
export const SAMPLE_SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  branding: { ...DEFAULT_SETTINGS.branding, logoFileId: 'file_sample_logo' },
  favouriteVariantIds: [
    'var_nova_pro_2g_black',
    'var_nova_pro_3g_black',
    'var_nova_s8',
    'var_curtain_single',
    'var_luna_dl_3000',
    'var_lumi_cove_3000',
    'var_luna_track_black',
  ],
};
