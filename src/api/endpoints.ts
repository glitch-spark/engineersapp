import { apiFetch } from './client';

// ---------- shared types ----------

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: 'admin' | 'staff' | 'accountant';
  image?: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: 'bearer';
  user: User;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export interface ProfileShape {
  username: string;
  email: string;
  image: string;
  birthday: string | null;
}

export interface TransactionListParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  userId?: string;
  search?: string;
  fromSearch?: string;
  toSearch?: string;
  userSearch?: string;
}

export interface TransactionSummary {
  monthly: { period: string; total: number; year: number }[];
  stats: {
    totalAmount: number;
    totalCount: number;
    avgAmount: number;
    minAmount: number;
    maxAmount: number;
  };
  statusBreakdown: Record<string, { count: number; total: number }>;
}

// ---------- helpers ----------

function qs(params?: object): string {
  if (!params) return '';
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );
  if (entries.length === 0) return '';
  const enc = (s: string) => encodeURIComponent(s);
  return '?' + entries.map(([k, v]) => `${enc(k)}=${enc(String(v))}`).join('&');
}

function postJSON<T>(path: string, body: unknown) {
  return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });
}

function putJSON<T>(path: string, body: unknown) {
  return apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

function del<T>(path: string) {
  return apiFetch<T>(path, { method: 'DELETE' });
}

// ---------- auth ----------

export const login = (body: { username: string; password: string }) =>
  postJSON<LoginResponse>('/auth/login', body);

export const register = (body: { username: string; email: string; password: string }) =>
  postJSON<{ ok: boolean }>('/auth/register', body);

export const me = () => apiFetch<User>('/auth/me');

// ---------- profile ----------

export const getProfile = () => apiFetch<{ user: ProfileShape }>('/profile');

export const updateProfile = (body: {
  username: string;
  email: string;
  image?: string;
  birthday?: string;
}) => putJSON<{ message: string; user: ProfileShape }>('/profile', body);

export const changePassword = (body: { currentPassword: string; newPassword: string }) =>
  putJSON<{ message: string }>('/profile/password', body);

// ---------- users (admin) ----------

export const listUsers = (params?: {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}) =>
  apiFetch<{ users: Record<string, unknown>[]; pagination: Pagination }>(
    `/users${qs(params)}`
  );

export const createUser = (body: Record<string, unknown>) =>
  postJSON<Record<string, unknown>>('/users', body);

export const updateUser = (id: string, body: Record<string, unknown>) =>
  putJSON<Record<string, unknown>>(`/users/${id}`, body);

export const deleteUser = (id: string) => del<{ ok: boolean }>(`/users/${id}`);

// ---------- accounts ----------

export const listAccounts = (params?: {
  page?: number;
  limit?: number;
  search?: string;
  userId?: string;
}) =>
  apiFetch<{ accounts: Record<string, unknown>[]; pagination: Pagination }>(
    `/accounts${qs(params)}`
  );

export const getAccount = (id: string) =>
  apiFetch<Record<string, unknown>>(`/accounts/${id}`);

export const createAccount = (body: Record<string, unknown>) =>
  postJSON<Record<string, unknown>>('/accounts', body);

export const updateAccount = (id: string, body: Record<string, unknown>) =>
  putJSON<Record<string, unknown>>(`/accounts/${id}`, body);

export const deleteAccount = (id: string) => del<{ ok: boolean }>(`/accounts/${id}`);

// ---------- transactions ----------

export const listTransactions = (params?: TransactionListParams) =>
  apiFetch<{ transactions: Record<string, unknown>[]; pagination: Pagination }>(
    `/transactions${qs(params)}`
  );

export const createTransaction = (body: Record<string, unknown>) =>
  postJSON<Record<string, unknown>>('/transactions', body);

export const updateTransaction = (id: string, body: Record<string, unknown>) =>
  putJSON<Record<string, unknown>>(`/transactions/${id}`, body);

export const deleteTransaction = (id: string) => del<{ ok: boolean }>(`/transactions/${id}`);

export const transactionSummary = (params?: { userId?: string; year?: number }) =>
  apiFetch<TransactionSummary>(`/transactions/summary${qs(params)}`);

// ---------- cardlinks ----------

export const listCardlinks = (params?: TransactionListParams) =>
  apiFetch<{ cardlinks: Record<string, unknown>[]; pagination: Pagination }>(
    `/cardlinks${qs(params)}`
  );

export const createCardlink = (body: Record<string, unknown>) =>
  postJSON<Record<string, unknown>>('/cardlinks', body);

export const updateCardlink = (id: string, body: Record<string, unknown>) =>
  putJSON<Record<string, unknown>>(`/cardlinks/${id}`, body);

export const deleteCardlink = (id: string) => del<{ ok: boolean }>(`/cardlinks/${id}`);

// ---------- weekly plans ----------

export const listWeeklyPlans = (params?: {
  page?: number;
  limit?: number;
  year?: number;
  weekNumber?: number;
  userId?: string;
}) =>
  apiFetch<{ plans: Record<string, unknown>[]; pagination: Pagination }>(
    `/weekly-plans${qs(params)}`
  );

export const getWeeklyPlan = (id: string) =>
  apiFetch<Record<string, unknown>>(`/weekly-plans/${id}`);

export const createWeeklyPlan = (body: Record<string, unknown>) =>
  postJSON<Record<string, unknown>>('/weekly-plans', body);

export const updateWeeklyPlan = (id: string, body: Record<string, unknown>) =>
  putJSON<Record<string, unknown>>(`/weekly-plans/${id}`, body);

export const deleteWeeklyPlan = (id: string) => del<{ message: string }>(`/weekly-plans/${id}`);

// ---------- accounts lookup (filter dropdowns) ----------

export const lookupAccounts = () =>
  apiFetch<{ accounts: { _id: string; name: string; email: string }[] }>('/accounts/lookup');

// ---------- users lookup (filter dropdowns; available to all authed users) ----------

export const lookupUsers = () =>
  apiFetch<{ users: { _id: string; name: string | null; email: string | null }[] }>('/users/lookup');

// ---------- interviews ----------

export interface InterviewListParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  accountId?: string;
  stage?: string;
  creatorId?: string;
  sort?: 'asc' | 'desc';
}

export const listInterviews = (params?: InterviewListParams) =>
  apiFetch<{ interviews: Record<string, unknown>[]; pagination: Pagination }>(
    `/interviews${qs(params)}`
  );

export const createInterview = (body: Record<string, unknown>) =>
  postJSON<Record<string, unknown>>('/interviews', body);

export const updateInterview = (id: string, body: Record<string, unknown>) =>
  putJSON<Record<string, unknown>>(`/interviews/${id}`, body);

export const deleteInterview = (id: string) => del<{ ok: boolean }>(`/interviews/${id}`);
