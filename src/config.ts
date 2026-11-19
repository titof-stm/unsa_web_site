// Central site settings: edit this file to change the name, contact details, menu and social links.

export const SITE = {
  title: 'UNSA',
  description: 'UNSA — défendre, informer et accompagner les salariés.',
  lang: 'fr',
  contactEmail: 'contact@example.com',
  phone: '01 23 45 67 89',
  address: '1 rue de l’Exemple, 75000 Paris',
  // Online membership form (for example a Google Form). Leave empty to hide the button.
  membershipFormUrl: '',
} as const;

export interface NavItem {
  readonly label: string;
  readonly path: string;
}

export const NAV: readonly NavItem[] = [
  { label: 'Accueil', path: '' },
  { label: 'Qui sommes-nous', path: 'qui-sommes-nous/' },
  { label: 'Actualités', path: 'actualites/' },
  { label: 'Documents', path: 'documents/' },
  { label: 'Adhérer', path: 'adherer/' },
  { label: 'Contact', path: 'contact/' },
];

export type SocialNetwork = 'facebook' | 'x' | 'instagram' | 'linkedin' | 'youtube' | 'whatsapp';

export interface SocialLink {
  readonly network: SocialNetwork;
  readonly label: string;
  readonly url: string;
}

// Replace each URL with the real page. Remove a line to hide a network.
export const SOCIALS: readonly SocialLink[] = [
  { network: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/' },
  { network: 'x', label: 'X (Twitter)', url: 'https://x.com/' },
  { network: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/' },
  { network: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/' },
  { network: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/' },
  { network: 'whatsapp', label: 'WhatsApp', url: 'https://www.whatsapp.com/channel/' },
];

/** Prefixes a site-relative path with the deployment base (e.g. `/unsa_web_site/`). */
export function url(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  return base + path.replace(/^\//, '');
}
