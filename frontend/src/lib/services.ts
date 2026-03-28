// frontend/src/lib/services.ts
// Raulji Technologies service catalog

export const RAULJI_SERVICES = [
  { value: 'Website Development',       label: 'Website Development',       category: 'Development' },
  { value: 'Mobile Application',        label: 'Mobile Application',        category: 'Development' },
  { value: 'Custom Software',           label: 'Custom Software',           category: 'Development' },
  { value: 'E-commerce Website',        label: 'E-commerce Website',        category: 'Development' },
  { value: 'CRM / ERP Solution',        label: 'CRM / ERP Solution',        category: 'Development' },
  { value: 'Digital Marketing',         label: 'Digital Marketing',         category: 'Marketing' },
  { value: 'SEO Services',              label: 'SEO Services',              category: 'Marketing' },
  { value: 'Social Media Marketing',    label: 'Social Media Marketing',    category: 'Marketing' },
  { value: 'Google Ads / PPC',          label: 'Google Ads / PPC',          category: 'Marketing' },
  { value: 'Content Marketing',         label: 'Content Marketing',         category: 'Marketing' },
  { value: 'UI/UX Design',              label: 'UI/UX Design',              category: 'Design' },
  { value: 'Logo & Branding',           label: 'Logo & Branding',           category: 'Design' },
  { value: 'Business Development',      label: 'Business Development',      category: 'Consulting' },
  { value: 'Cloud Solutions',           label: 'Cloud Solutions',           category: 'Infrastructure' },
  { value: 'Other',                     label: 'Other',                     category: 'Other' },
];

export const SERVICE_VALUES = RAULJI_SERVICES.map(s => s.value);

export const SERVICE_OPTIONS = [
  { value: '', label: 'Select Service' },
  ...RAULJI_SERVICES.map(s => ({ value: s.value, label: s.label }))
];

export const SERVICE_COLOR: Record<string, string> = {
  'Website Development':    'bg-blue-50 text-blue-700',
  'Mobile Application':     'bg-indigo-50 text-indigo-700',
  'Custom Software':        'bg-violet-50 text-violet-700',
  'E-commerce Website':     'bg-pink-50 text-pink-700',
  'CRM / ERP Solution':     'bg-purple-50 text-purple-700',
  'Digital Marketing':      'bg-orange-50 text-orange-700',
  'SEO Services':           'bg-yellow-50 text-yellow-700',
  'Social Media Marketing': 'bg-red-50 text-red-700',
  'Google Ads / PPC':       'bg-amber-50 text-amber-700',
  'Content Marketing':      'bg-lime-50 text-lime-700',
  'UI/UX Design':           'bg-teal-50 text-teal-700',
  'Logo & Branding':        'bg-cyan-50 text-cyan-700',
  'Business Development':   'bg-emerald-50 text-emerald-700',
  'Cloud Solutions':        'bg-sky-50 text-sky-700',
  'Other':                  'bg-slate-100 text-slate-600',
};
