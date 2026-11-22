// Content taken from the "Livret d’Accueil UNSA STMicroelectronics" (version 1.1).

export const FEDERAL_FIGURES = [
  { value: '1993', label: 'Année de création de l’UNSA' },
  { value: '5e', label: 'force syndicale française en nombre d’adhérents' },
  { value: '22', label: 'fédérations et plus de 1 000 syndicats' },
  { value: '227+', label: 'sièges de conseillers prud’hommaux' },
  { value: '240', label: 'défenseurs syndicaux' },
  { value: '500+', label: 'conseillers du salarié' },
] as const;

export const ENGAGEMENT_LEVELS = [
  {
    level: 'Le sympathisant',
    role: 'Votant UNSA',
    points: ['Il soutient l’UNSA par son vote lors des élections professionnelles.'],
  },
  {
    level: 'L’adhérent',
    role: 'Cotisant UNSA',
    points: [
      'Accès à plus d’informations sur la vie de l’entreprise et de l’UNSA.',
      'Participation aux discussions et aux votes lors des assemblées générales.',
      'Bénéfice d’une aide juridique.',
    ],
  },
  {
    level: 'Le militant',
    role: 'Acteur syndical',
    points: [
      'Participation aux réunions de section et partage d’idées.',
      'Implication dans ses sujets d’intérêt (environnement, finances, mutuelle…).',
      'Participation aux actions terrain (tractage, affichage).',
    ],
  },
  {
    level: 'Le représentant',
    role: 'Élu ou mandaté',
    points: [
      'Accès à des informations importantes sur la vie de l’entreprise.',
      'Participation active aux négociations et aux échanges avec la Direction.',
      'Développement de compétences : analyse, communication, négociation, droit du travail, gestion de situations collectives, accompagnement des collègues.',
    ],
  },
] as const;

export const MANDATES = [
  {
    code: 'DS',
    title: 'Délégué syndical',
    text: 'Représente son syndicat auprès de l’employeur et assure la défense des salariés. Il formule des propositions, des revendications ou des réclamations et négocie les accords locaux.',
  },
  {
    code: 'RS',
    title: 'Représentant syndical au CSE',
    text: 'Salarié mandaté par une organisation syndicale représentative pour la représenter aux réunions du CSE. À ne pas confondre avec le DS : le DS peut revendiquer et négocier, le RS non.',
  },
  {
    code: 'DSC / DSCA',
    title: 'Délégué syndical central (et adjoints)',
    text: 'Représente l’UNSA auprès de la direction de l’entreprise et négocie les accords centraux. Le DSC signe — ou non — les accords négociés ; en son absence, un DSC adjoint le remplace.',
  },
  {
    code: 'RSC',
    title: 'Représentant syndical central',
    text: 'Salarié mandaté par son organisation syndicale représentative pour la représenter aux réunions du CSE Central.',
  },
] as const;

export interface Contact {
  readonly name: string;
  readonly role: string;
  readonly email: string;
}

export const CENTRAL_CONTACTS: readonly Contact[] = [
  {
    name: 'Claude Hû',
    role: 'Secrétaire général et délégué syndical central — ST Grenoble',
    email: 'claude.hu@st.com',
  },
  {
    name: 'Guy Bossan',
    role: 'Délégué syndical central adjoint — ST Crolles',
    email: 'guy.bossan@st.com',
  },
  {
    name: 'Sébastien Jacona',
    role: 'Délégué syndical central adjoint — ST Rousset',
    email: 'sebastien.jacona@st.com',
  },
];

export const SITE_CONTACTS: readonly (Contact & { site: string })[] = [
  { site: 'Crolles', name: 'Nawel Beghidja', role: 'Contact du site de Crolles', email: 'nawel.beghidja@st.com' },
  { site: 'Grenoble', name: 'Bruno Marcel', role: 'Contact du site de Grenoble', email: 'bruno.marcel@st.com' },
  { site: 'Sophia', name: 'Frédéric Bert', role: 'Contact du site de Sophia', email: 'frederic.bert@st.com' },
  { site: 'Rousset', name: 'Robinson David', role: 'Contact du site de Rousset', email: 'david.robinson@st.com' },
  { site: 'Tours', name: 'Laetitia Meyer', role: 'Contact du site de Tours', email: 'laetitia.meyer@st.com' },
];

export const GLOSSARY = {
  'Mandatés UNSA': [
    { term: 'DS', name: 'Délégué syndical', text: 'Négocie avec la direction de son site.' },
    {
      term: 'DSC',
      name: 'Délégué syndical central',
      text: 'Négocie avec la direction France. Pouvoir de signature des accords.',
    },
    {
      term: 'DSCA',
      name: 'Délégué syndical central adjoint',
      text: 'Négocie les accords centraux. En l’absence du DSC, pouvoir de signature des accords.',
    },
    {
      term: 'RSS',
      name: 'Représentant de section syndicale',
      text: 'Anime la section de son site lorsque l’UNSA n’est pas représentative.',
    },
    {
      term: 'RS',
      name: 'Représentant syndical',
      text: 'Représente l’UNSA au CSE de son site lorsque l’UNSA y est représentative.',
    },
    { term: 'RSC', name: 'Représentant syndical central', text: 'Représente l’UNSA au CSE Central.' },
    {
      term: 'RP',
      name: 'Représentant de proximité',
      text: 'Relais entre les salariés et le CSE pour faire remonter les questions du terrain.',
    },
  ],
  'Organisation syndicale': [
    { term: 'Central', name: 'Niveau entreprise', text: 'L’entreprise STMicroelectronics France.' },
    {
      term: 'Section',
      name: 'Niveau établissement',
      text: 'Les établissements (sites) : Crolles, Grenoble, Rousset, Sophia, Tours…',
    },
    {
      term: 'IRP',
      name: 'Instances représentatives du personnel',
      text: 'Ensemble des élus et des mandatés.',
    },
    { term: 'CSE', name: 'Comité social et économique', text: 'Instance principale de représentation du personnel.' },
    {
      term: 'OSR',
      name: 'Organisation syndicale représentative',
      text: 'Syndicat ayant obtenu plus de 10 % des suffrages exprimés.',
    },
    { term: 'ASC', name: 'Activités sociales et culturelles', text: 'Offres et services gérés par le CSE pour les salariés.' },
  ],
} as const;
