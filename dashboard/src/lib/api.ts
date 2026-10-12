import { useQuery } from '@tanstack/react-query';

const API_BASE = '/v1';

const DASHBOARD_KEY = 'dev-key-123'; // In production, this would be injected via env/vite variables

export async function fetcher(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${endpoint.replace(/^\/v1/, '')}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${DASHBOARD_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Fetch failed');
  }
  return res.json();
}

export async function fetchDecisions() {
  const res = await fetch(`${API_BASE}/decisions`, {
    headers: { 'Authorization': `Bearer ${DASHBOARD_KEY}` }
  });
  if (!res.ok) throw new Error('Failed to fetch decisions');
  return res.json();
}

export async function fetchPolicy() {
  const res = await fetch(`${API_BASE}/policy`, {
    headers: { 'Authorization': `Bearer ${DASHBOARD_KEY}` }
  });
  if (!res.ok) throw new Error('Failed to fetch policy');
  return res.json();
}

export async function fetchModelInfo() {
  const res = await fetch(`${API_BASE}/model`);
  if (!res.ok) throw new Error('Failed to fetch model info');
  return res.json();
}

export function useModelInfo() {
  return useQuery({ queryKey: ['modelInfo'], queryFn: fetchModelInfo });
}

export function usePolicy() {
  return useQuery({ queryKey: ['policy'], queryFn: fetchPolicy });
}

export function usePendingApprovalsCount() {
  return useQuery({
    queryKey: ['pendingApprovalsCount'],
    queryFn: async () => {
      try {
        const res = await fetcher('/v1/decisions?status=pending&limit=100');
        return res.decisions?.length || 0;
      } catch {
        return 0;
      }
    },
    refetchInterval: 5000,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ['systemHealth'],
    queryFn: async () => {
      try {
        await fetchModelInfo();
        return true;
      } catch {
        return false;
      }
    },
    refetchInterval: 10000,
  });
}
