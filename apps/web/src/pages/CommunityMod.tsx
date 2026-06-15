import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Check, X, Ban, ChevronRight, Plus, Trash2, Users, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '@/services/api.client';
import { formatDistanceToNowStrict } from 'date-fns';

const modService = {
  getRules:       (slug: string) => api.get(`/api/communities/${slug}/mod/rules`),
  addRule:        (slug: string, data: any) => api.post(`/api/communities/${slug}/mod/rules`, data),
  deleteRule:     (slug: string, ruleId: string) => api.delete(`/api/communities/${slug}/mod/rules/${ruleId}`),
  getQueue:       (slug: string) => api.get(`/api/communities/${slug}/mod/queue`),
  reviewPost:     (slug: string, queueId: string, action: string, note?: string) =>
    api.post(`/api/communities/${slug}/mod/queue/${queueId}/review`, { action, note }),
  getBans:        (slug: string) => api.get(`/api/communities/${slug}/mod/bans`),
  banUser:        (slug: string, data: any) => api.post(`/api/communities/${slug}/mod/bans`, data),
  unbanUser:      (slug: string, userId: string) => api.delete(`/api/communities/${slug}/mod/bans/${userId}`),
  getReports:     (slug: string) => api.get(`/api/communities/${slug}/mod/reports`),
  toggleApproval: (slug: string, val: boolean) => api.patch(`/api/communities/${slug}/mod/approval`, { requires_approval: val }),
};

const TABS = ['queue', 'rules', 'bans', 'reports'] as const;
type Tab = typeof TABS[number];

export default function CommunityMod() {
  const { slug }    = useParams<{ slug: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab]   = useState<Tab>('queue');
  const [note, setNote] = useState('');
  const [newRule, setNewRule] = useState({ title: '', description: '' });
  const [banForm, setBanForm] = useState({ user_id: '', reason: '', expires_hours: 168 });

  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['mod-queue', slug],
    queryFn:  () => modService.getQueue(slug!),
    enabled:  tab === 'queue',
  });

  const { data: rulesData } = useQuery({
    queryKey: ['community-rules', slug],
    queryFn:  () => modService.getRules(slug!),
    enabled:  tab === 'rules',
  });

  const { data: bansData } = useQuery({
    queryKey: ['community-bans', slug],
    queryFn:  () => modService.getBans(slug!),
    enabled:  tab === 'bans',
  });

  const { data: reportsData } = useQuery({
    queryKey: ['community-reports', slug],
    queryFn:  () => modService.getReports(slug!),
    enabled:  tab === 'reports',
  });

  const reviewMutation = useMutation({
    mutationFn: ({ queueId, action }: { queueId: string; action: string }) =>
      modService.reviewPost(slug!, queueId, action, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mod-queue', slug] });
      setNote('');
    },
  });

  const addRuleMutation = useMutation({
    mutationFn: (data: any) => modService.addRule(slug!, data),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['community-rules', slug] });
      setNewRule({ title: '', description: '' });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId: string) => modService.deleteRule(slug!, ruleId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['community-rules', slug] }),
  });

  const banMutation = useMutation({
    mutationFn: (data: any) => modService.banUser(slug!, data),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['community-bans', slug] });
      setBanForm({ user_id: '', reason: '', expires_hours: 168 });
    },
  });

  const unbanMutation = useMutation({
    mutationFn: (userId: string) => modService.unbanUser(slug!, userId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['community-bans', slug] }),
  });

  const queue   = queueData?.data?.data ?? [];
  const rules   = rulesData?.data?.data ?? [];
  const bans    = bansData?.data?.data ?? [];
  const reports = reportsData?.data?.data ?? [];

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <Link to={`/communities/${slug}`} className="text-brand hover:underline text-sm">← c/{slug}</Link>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <Shield size={18} className="text-brand" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Mod Panel</h1>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                tab === t ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}>{t === 'queue' ? `📋 Queue (${queue.length})` : t === 'rules' ? `📜 Rules` : t === 'bans' ? `🚫 Bans` : `⚠️ Reports`}</button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">

        {/* MOD QUEUE */}
        {tab === 'queue' && (
          <>
            {queueLoading && <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-brand" /></div>}
            {queue.length === 0 && !queueLoading && (
              <div className="text-center py-12 text-gray-400">
                <Check size={32} className="mx-auto mb-2 opacity-30" />
                <p>No pending posts</p>
              </div>
            )}
            {queue.map((item: any) => (
              <div key={item.id} className="border border-gray-100 dark:border-gray-800 rounded-2xl p-4 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <img src={item.author_avatar || `https://ui-avatars.com/api/?name=${item.author_handle}&background=1d9bf0&color=fff&size=32`}
                    className="w-8 h-8 rounded-full" alt={item.author_handle} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{item.author_name || item.author_handle}</p>
                    <p className="text-xs text-gray-400">{formatDistanceToNowStrict(new Date(item.created_at), { addSuffix: true })}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200 mb-3">{item.content}</p>
                <input value={note} onChange={e => setNote(e.target.value)}
                  placeholder="Review note (optional)"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs bg-white dark:bg-black text-gray-900 dark:text-white outline-none mb-2" />
                <div className="flex gap-2">
                  <button onClick={() => reviewMutation.mutate({ queueId: item.id, action: 'approve' })}
                    disabled={reviewMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white py-2 rounded-full text-xs font-medium transition-colors disabled:opacity-50">
                    <Check size={12} /> Approve
                  </button>
                  <button onClick={() => reviewMutation.mutate({ queueId: item.id, action: 'reject' })}
                    disabled={reviewMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white py-2 rounded-full text-xs font-medium transition-colors disabled:opacity-50">
                    <X size={12} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* RULES */}
        {tab === 'rules' && (
          <>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 mb-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Add Rule</h3>
              <input value={newRule.title} onChange={e => setNewRule(r => ({ ...r, title: e.target.value }))}
                placeholder="Rule title"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
              <textarea value={newRule.description} onChange={e => setNewRule(r => ({ ...r, description: e.target.value }))}
                placeholder="Description (optional)" rows={2}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand resize-none" />
              <button onClick={() => addRuleMutation.mutate(newRule)}
                disabled={!newRule.title || addRuleMutation.isPending}
                className="flex items-center gap-1.5 bg-brand text-white px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50 hover:bg-brand-dark transition-colors">
                <Plus size={14} /> Add Rule
              </button>
            </div>
            {rules.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No rules yet</p>
            ) : rules.map((rule: any) => (
              <div key={rule.id} className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-800">
                <span className="w-6 h-6 bg-brand/10 text-brand rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{rule.rule_number}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{rule.title}</p>
                  {rule.description && <p className="text-xs text-gray-500 mt-0.5">{rule.description}</p>}
                </div>
                <button onClick={() => deleteRuleMutation.mutate(rule.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </>
        )}

        {/* BANS */}
        {tab === 'bans' && (
          <>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-4 mb-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Ban User</h3>
              <input value={banForm.user_id} onChange={e => setBanForm(f => ({ ...f, user_id: e.target.value }))}
                placeholder="User ID (UUID)"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
              <input value={banForm.reason} onChange={e => setBanForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Reason"
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
              <select value={banForm.expires_hours} onChange={e => setBanForm(f => ({ ...f, expires_hours: Number(e.target.value) }))}
                className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none">
                <option value={24}>24 hours</option>
                <option value={168}>7 days</option>
                <option value={720}>30 days</option>
                <option value={0}>Permanent</option>
              </select>
              <button onClick={() => banMutation.mutate(banForm)}
                disabled={!banForm.user_id || banMutation.isPending}
                className="flex items-center gap-1.5 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50 hover:bg-red-600 transition-colors">
                <Ban size={14} /> Ban User
              </button>
            </div>
            {bans.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No banned users</p>
            ) : bans.map((ban: any) => (
              <div key={ban.id} className="flex items-center gap-3 py-3 border-b border-gray-100 dark:border-gray-800">
                <img src={ban.avatar_url || `https://ui-avatars.com/api/?name=${ban.handle}&background=ef4444&color=fff&size=36`}
                  className="w-9 h-9 rounded-full opacity-60" alt={ban.handle} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">@{ban.handle}</p>
                  {ban.reason && <p className="text-xs text-gray-500">{ban.reason}</p>}
                  {ban.expires_at && <p className="text-xs text-orange-500">Expires {formatDistanceToNowStrict(new Date(ban.expires_at), { addSuffix: true })}</p>}
                </div>
                <button onClick={() => unbanMutation.mutate(ban.user_id)}
                  className="text-xs text-brand hover:underline">Unban</button>
              </div>
            ))}
          </>
        )}

        {/* REPORTS */}
        {tab === 'reports' && (
          <>
            {reports.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
                <p>No pending reports</p>
              </div>
            ) : reports.map((report: any) => (
              <div key={report.id} className="border border-orange-100 dark:border-orange-900/30 rounded-2xl p-4 mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-orange-500" />
                  <span className="text-xs font-medium text-orange-600">{report.reason}</span>
                  <span className="text-xs text-gray-400 ml-auto">{formatDistanceToNowStrict(new Date(report.created_at), { addSuffix: true })}</span>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200 mb-1 line-clamp-3">{report.post_content}</p>
                {report.description && <p className="text-xs text-gray-500 italic">{report.description}</p>}
                <p className="text-xs text-gray-400 mt-2">Reported by @{report.reporter_handle}</p>
              </div>
            ))}
          </>
        )}

      </div>
    </div>
  );
}
