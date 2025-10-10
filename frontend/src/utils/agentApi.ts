import { agentApiBase } from 'src/config';
import { authHeader } from './api';

const trimmedBase = agentApiBase.endsWith('/')
  ? agentApiBase.slice(0, -1)
  : agentApiBase;
const baseUrl = `${trimmedBase}/api/agent`;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = {
    ...authHeader(false),
    ...(init.headers || {})
  };

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    const payload =
      contentType.includes('application/json')
        ? await response.json()
        : await response.text();
    const errorMessage =
      typeof payload === 'string'
        ? payload
        : payload?.message || 'Agent API request failed';
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

export function postChat<T>(body: unknown): Promise<T> {
  return request<T>('/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
}

export function getDrafts<T>(): Promise<T> {
  return request<T>('/drafts', {
    method: 'GET'
  });
}

export function confirmDraft<T>(draftId: number): Promise<T> {
  return request<T>(`/drafts/${draftId}/confirm`, {
    method: 'POST'
  });
}

export function declineDraft<T>(draftId: number): Promise<T> {
  return request<T>(`/drafts/${draftId}`, {
    method: 'DELETE'
  });
}
