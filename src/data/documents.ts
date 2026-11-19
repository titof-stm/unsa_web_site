// Links to the Google Drive folders shown on the "Documents" page.
// Use the share link of each folder (Drive → right-click the folder → Share → Copy link).
export interface DocumentFolder {
  readonly title: string;
  readonly description: string;
  readonly url: `https://drive.google.com/${string}`;
}

export const documentFolders: readonly DocumentFolder[] = [
  {
    title: 'Documents des adhérents',
    description: 'Tous les documents réservés aux adhérents : comptes rendus, guides, accords, etc.',
    url: 'https://drive.google.com/drive/folders/REPLACE_WITH_FOLDER_ID',
  },
];
