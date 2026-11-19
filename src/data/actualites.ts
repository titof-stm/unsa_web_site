import { getCollection, type CollectionEntry } from 'astro:content';

export type Actualite = CollectionEntry<'actualites'>;

export async function getActualites(): Promise<Actualite[]> {
  const entries = await getCollection('actualites', ({ data }) => !data.draft);
  return entries.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' });

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}
