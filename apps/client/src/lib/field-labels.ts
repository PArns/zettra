import type { Lang } from '../i18n';

/**
 * Human, localized labels for the seed supertag field names (which are stored lowercase-English).
 * Unknown fields (user-created) fall back to a capitalized version of their raw name. Kept out of
 * the strict i18n Catalog so adding a field label doesn't force a key in every language.
 */
const FIELD_LABELS: Record<Lang, Record<string, string>> = {
  en: {
    status: 'Status', due: 'Due', assignee: 'Assignee', priority: 'Priority',
    date: 'Date', location: 'Location', attendees: 'Attendees', agenda: 'Agenda',
    email: 'Email', company: 'Company', phone: 'Phone', subject: 'Subject',
    from: 'From', received: 'Received', title: 'Title', author: 'Author',
    url: 'URL', clipped: 'Clipped', Wiedervorlage: 'Follow-up',
  },
  de: {
    status: 'Status', due: 'Fällig', assignee: 'Zugewiesen', priority: 'Priorität',
    date: 'Datum', location: 'Ort', attendees: 'Teilnehmer', agenda: 'Agenda',
    email: 'E-Mail', company: 'Firma', phone: 'Telefon', subject: 'Betreff',
    from: 'Von', received: 'Erhalten', title: 'Titel', author: 'Autor',
    url: 'URL', clipped: 'Geclippt', Wiedervorlage: 'Wiedervorlage',
  },
  es: {
    status: 'Estado', due: 'Vence', assignee: 'Asignado', priority: 'Prioridad',
    date: 'Fecha', location: 'Lugar', attendees: 'Asistentes', agenda: 'Agenda',
    email: 'Correo', company: 'Empresa', phone: 'Teléfono', subject: 'Asunto',
    from: 'De', received: 'Recibido', title: 'Título', author: 'Autor',
    url: 'URL', clipped: 'Recortado', Wiedervorlage: 'Seguimiento',
  },
  fr: {
    status: 'Statut', due: 'Échéance', assignee: 'Assigné', priority: 'Priorité',
    date: 'Date', location: 'Lieu', attendees: 'Participants', agenda: 'Ordre du jour',
    email: 'E-mail', company: 'Entreprise', phone: 'Téléphone', subject: 'Objet',
    from: 'De', received: 'Reçu', title: 'Titre', author: 'Auteur',
    url: 'URL', clipped: 'Clippé', Wiedervorlage: 'Rappel',
  },
};

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Localized display label for a supertag field name; capitalized raw name if unknown. */
export function fieldLabel(name: string, lang: Lang): string {
  return FIELD_LABELS[lang]?.[name] ?? FIELD_LABELS.en[name] ?? capitalize(name);
}
