import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, FileCheck, AlertCircle, Loader2, Newspaper, Crown } from 'lucide-react';
import { api } from '@/services/api.client';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const complianceService = {
  getAuditLogs:    () => api.get('/api/compliance/audit-logs'),
  getModSummary:   () => api.get('/api/compliance/moderation-summary'),
  updateLegal:     (data: any) => api.patch('/api/compliance/legal-protection', data),
};

const ACTION_LABELS: Record<string, string> = {
  'subscription.checkout_started': 'Subscription checkout started',
  'subscription.activated':        'Subscription activated',
  'subscription.cancelled':        'Subscription cancelled',
  'subscription.expired':          'Subscription expired',
  'badge.awarded':                 'Badge awarded',
  'tip.received':                  'Tip received',
};

export default function Compliance() {
  const queryClient = useQueryClient();
  const [isJournalist, setIsJournalist] = useState(false);
  const [credUrl, setCredUrl] = useState('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: logsData, isLoading: logsLoading, error: logsError } = useQuery({
    queryKey: ['compliance-audit-logs'], queryFn: complianceService.getAuditLogs,
  });
  const { data: summaryData } = useQuery({
    queryKey: ['compliance-mod-summary'], queryFn: complianceService.getModSummary,
  });

  const legalMutation = useMutation({
    mutationFn: () => complianceService.updateLegal({
      is_journalist: isJournalist, press_credential_url: credUrl || undefined, legal_protection_note: note || undefined,
    }),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500); },
  });

  const forbidden = (logsError as any)?.response?.status === 403;
  const logs    = logsData?.data?.data ?? [];
  const summary = summaryData?.data?.data;

  if (forbidden) {
    return (
      <div className="px-4 py-16 text-center max-w-sm mx-auto">
        <Shield size={40} className="mx-auto mb-3 text-gray-300" />
        <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Compliance Dashboard</h1>
        <p className="text-sm text-gray-500 mb-5">
          This dashboard — audit logs, moderation breakdowns, and journalist legal-protection metadata — is available on the Enterprise plan.
        </p>
        <Link to="/premium" className="inline-flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-brand-dark transition-colors">
          <Crown size={14} /> Upgrade to Enterprise
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-4">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-brand" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Compliance Dashboard</h1>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">Enterprise · audit trail and legal protection tools</p>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-3 px-4 py-4">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-white">{summary.total_posts}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total posts</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-green-600">{summary.moderation_breakdown?.PASS || 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">Passed moderation</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-red-500">{(summary.moderation_breakdown?.BLOCK || 0) + (summary.moderation_breakdown?.FLAG || 0)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Flagged / blocked</p>
          </div>
        </div>
      )}

      {/* Journalist legal protection metadata */}
      <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-1.5">
          <Newspaper size={14} className="text-brand" /> Journalist legal-protection metadata
        </h2>
        <p className="text-xs text-gray-500 mb-3">
          This metadata is contextual only — it does not exempt content from moderation or the Grievance Redressal process, and is not legal advice.
        </p>
        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <input type="checkbox" checked={isJournalist} onChange={e => setIsJournalist(e.target.checked)} className="rounded" />
          <span className="text-sm text-gray-700 dark:text-gray-300">I am a verified journalist / press member</span>
        </label>
        <input value={credUrl} onChange={e => setCredUrl(e.target.value)}
          placeholder="Press credential URL (optional)"
          className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand mb-2" />
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
          placeholder="Legal protection note (optional, e.g. outlet affiliation)"
          className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand resize-none mb-3" />
        <button onClick={() => legalMutation.mutate()} disabled={legalMutation.isPending}
          className="bg-brand text-white px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50 hover:bg-brand-dark transition-colors">
          {legalMutation.isPending ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
        </button>
      </div>

      {/* Audit log */}
      <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
          <FileCheck size={14} className="text-brand" /> Audit log
        </h2>
        {logsLoading && <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-brand" /></div>}
        {!logsLoading && logs.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No audit events recorded yet.</p>
        )}
        <div className="space-y-2">
          {logs.map((log: any) => (
            <div key={log.id} className="flex items-start gap-3 py-2 border-b border-gray-50 dark:border-gray-900 last:border-0">
              <AlertCircle size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-white">{ACTION_LABELS[log.action] || log.action}</p>
                <p className="text-xs text-gray-400 mt-0.5">{format(new Date(log.created_at), 'MMM d, yyyy · h:mm a')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
