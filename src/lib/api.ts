import { PWA } from '../config';

export interface SetInfo {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

export interface Session {
  readonly token: string;
  readonly exp: number;
  readonly sets: readonly SetInfo[];
}

export interface FolderEntry {
  readonly id: string;
  readonly name: string;
}

export interface FileEntry {
  readonly id: string;
  readonly name: string;
  readonly mime: string;
  readonly size: number;
  readonly modified: string;
}

export interface FolderListing {
  readonly folders: readonly FolderEntry[];
  readonly files: readonly FileEntry[];
}

export interface FileContent {
  readonly name: string;
  readonly mime: string;
  readonly base64: string;
}

/** Error codes: not-configured, network, server, auth (bad/expired/revoked key or session), rate, forbidden, too-large. */
export class ApiError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export const apiConfigured = (): boolean => PWA.apiUrl !== '';

type Envelope<T> = ({ ok: true } & T) | { ok: false; error: string };

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!apiConfigured()) throw new ApiError('not-configured');
  let response: Response;
  try {
    response = await fetch(PWA.apiUrl, {
      method: 'POST',
      // text/plain keeps this a "simple" CORS request: no preflight, which Apps Script cannot answer.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      redirect: 'follow',
    });
  } catch {
    throw new ApiError('network');
  }
  if (!response.ok) throw new ApiError('server');
  const data = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!data) throw new ApiError('server');
  if (!data.ok) throw new ApiError(data.error);
  return data;
}

export const login = (key: string, remember: boolean): Promise<Session> => call<Session>('login', { key, remember });

export const listFolder = (token: string, setId: string, folderId?: string): Promise<FolderListing> =>
  call<FolderListing>('list', folderId === undefined ? { token, setId } : { token, setId, folderId });

export const getFile = (token: string, setId: string, fileId: string): Promise<FileContent> =>
  call<FileContent>('file', { token, setId, fileId });

export const subscribe = (token: string, fcmToken: string): Promise<unknown> => call('subscribe', { token, fcmToken });

export const unsubscribe = (token: string, fcmToken: string): Promise<unknown> =>
  call('unsubscribe', { token, fcmToken });
