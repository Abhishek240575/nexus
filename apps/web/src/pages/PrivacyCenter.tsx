import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Download, Trash2, User, Bell, ChevronDown, ChevronUp, Loader2, Check, AlertTriangle } from 'lucide-react';
import { api } from '@/services/api.client';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

const privacyService = {
  getCenter:        () => api.get('/api/privacy/center'),
  exportData:       () => api.post('/api/privacy/export'),
  requestDeletion:  (data: any) => api.post('/api/privacy/delete-account', data),
  cancelDeletion:   () => api.post('/api/privacy/delete-account/cancel'),
  executeDeletion:  (confirm: string) => api.post('/api/privacy/delete-account/execute', { confirm }),
  withdrawConsents: () => api.post('/api/privacy/consents/withdraw-all'),
  setNominee:       (data: any) => api.post('/api/privacy/nominee', data),
};

export default function PrivacyCenter() {
  const { logout } = useAuthStore();
  const navigate   = useNavigate();
  const queryClient = useQueryClient();

  const [activeSection, setActiveSection] = useState<string | null>('overview');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteReason,  setDeleteReason]  = useState('');
  const [showDeleteFinal, setShowDeleteFinal] = useState(false);
  const [exportData, setExportData]       = useState<any>(null);
  const [nomineeForm, setNomineeForm]     = useState({ nominee_name: '', nominee_email: '', nominee_phone: '', relationship: '' });
  const [msg, setMsg] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['privacy-center'], queryFn: privacyService.getCenter });
  const center = data?.data?.data;

  const exportMutation = useMutation({
    mutationFn: privacyService.exportData,
    onSuccess:  (res) => {
      setExportData(res.data.data.export);
      setMsg('Export ready — click Download to save your data.');
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: privacyService.withdrawConsents,
    onSuccess:  () => { setMsg('All optional consents withdrawn.'); queryClient.invalidateQueries({ queryKey: ['privacy-center'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => privacyService.requestDeletion({ reason: deleteReason }),
    onSuccess:  () => { setMsg('Account deletion scheduled in 30 days.'); queryClient.invalidateQueries({ queryKey: ['privacy-center'] }); },
  });

  const cancelDeleteMutation = useMutation({
    mutationFn: privacyService.cancelDeletion,
    onSuccess:  () => { setMsg('Deletion cancelled.'); queryClient.invalidateQueries({ queryKey: ['privacy-center'] }); },
  });

  const executeMutation = useMutation({
    mutationFn: () => privacyService.executeDeletion(deleteConfirm),
    onSuccess:  () => { logout(); navigate('/login'); },
  });

  const nomineeMutation = useMutation({
    mutationFn: () => privacyService.setNominee(nomineeForm),
    onSuccess:  () => { setMsg('Nominee saved.'); queryClient.invalidateQueries({ queryKey: ['privacy-center'] }); },
  });

  const toggle = (s: string) => setActiveSection(prev => prev === s ? null : s);

  const Section = ({ id, icon: Icon, title, children }: { id: string; icon: any; title: string; children: React.ReactNode }) => (
    <div className="border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden mb-3">
      <button onClick={() => toggle(id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
        <div className="flex items-center gap-3">
          <Icon size={18} className="text-brand" />
          <span className="font-semibold text-sm text-gray-900 dark:text-white">{title}</span>
        </div>
        {activeSection === id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {activeSection === id && <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800 pt-4">{children}</div>}
    </div>
  );

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-brand" /></div>;

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-4">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-brand" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Privacy Center</h1>
        </div>
        <p className="text-xs text-gray-500 mt-1">Manage your data, consents, and privacy rights under GDPR & DPDP Act 2023</p>
      </div>

      <div className="px-4 py-4">
        {msg && (
          <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
            <Check size={14} /> {msg}
          </div>
        )}

        {/* Overview */}
        <Section id="overview" icon={Shield} title="Your Privacy Overview">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-brand/5 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Account created</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {center?.account?.created_at ? format(new Date(center.account.created_at), 'dd MMM yyyy') : '—'}
              </p>
            </div>
            <div className="bg-brand/5 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">Active consents</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {center?.consents?.filter((c: any) => c.granted && !c.withdrawn_at).length || 0}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {center?.consents?.map((c: any) => (
              <div key={c.consent_type} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{c.consent_type.replace('_', ' ')} consent</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.granted && !c.withdrawn_at ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {c.granted && !c.withdrawn_at ? 'Granted' : 'Withdrawn'}
                </span>
              </div>
            ))}
          </div>
          <button onClick={() => withdrawMutation.mutate()} disabled={withdrawMutation.isPending}
            className="mt-4 text-sm text-orange-500 hover:underline">
            Withdraw all optional consents
          </button>
        </Section>

        {/* Data Export */}
        <Section id="export" icon={Download} title="Right to Access — Download Your Data">
          <p className="text-sm text-gray-500 mb-4">Download a complete copy of all data Deemona holds about you including posts, follows, bookmarks, and consent history.</p>
          {exportData ? (
            <div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 mb-3 text-xs text-gray-500 font-mono">
                {JSON.stringify({ profile: exportData.profile?.handle, posts: exportData.posts?.count, generated: exportData.export_generated_at }, null, 2)}
              </div>
              <a href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportData, null, 2))}`}
                download={`deemona-data-export-${new Date().toISOString().slice(0,10)}.json`}
                className="inline-flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-brand-dark">
                <Download size={14} /> Download JSON
              </a>
            </div>
          ) : (
            <button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}
              className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-brand-dark disabled:opacity-50">
              {exportMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {exportMutation.isPending ? 'Preparing export…' : 'Request data export'}
            </button>
          )}
        </Section>

        {/* Data Processors */}
        <Section id="processors" icon={Shield} title="Third-Party Data Processors">
          <p className="text-sm text-gray-500 mb-3">The following companies process your data on our behalf:</p>
          <div className="space-y-3">
            {center?.data_processors?.map((p: any) => (
              <div key={p.name} className="border border-gray-100 dark:border-gray-800 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{p.name}</span>
                  <span className="text-xs text-gray-400">{p.location}</span>
                </div>
                <p className="text-xs text-gray-500">{p.purpose}</p>
                <a href={p.policy_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand hover:underline">Privacy Policy</a>
              </div>
            ))}
          </div>
        </Section>

        {/* Retention Policy */}
        <Section id="retention" icon={Bell} title="Data Retention Policy">
          <div className="space-y-2">
            {center?.retention_policy && Object.entries(center.retention_policy).map(([key, val]) => (
              <div key={key} className="flex items-start gap-3 py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize w-32 flex-shrink-0">{key.replace('_', ' ')}</span>
                <span className="text-sm text-gray-500">{val as string}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Nominee (DPDP) */}
        <Section id="nominee" icon={User} title="Nominee Designation (DPDP India)">
          <p className="text-sm text-gray-500 mb-4">Under India's DPDP Act 2023, you can designate a person to exercise your data rights in the event of your death or incapacitation.</p>
          {center?.nominee ? (
            <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-3 mb-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white">{center.nominee.nominee_name}</p>
              <p className="text-xs text-gray-500">{center.nominee.nominee_email}</p>
              {center.nominee.relationship && <p className="text-xs text-gray-400">{center.nominee.relationship}</p>}
            </div>
          ) : null}
          <div className="space-y-2">
            {[
              { field: 'nominee_name', placeholder: 'Full name', label: 'Name' },
              { field: 'nominee_email', placeholder: 'email@example.com', label: 'Email' },
              { field: 'nominee_phone', placeholder: '+91 98765 43210', label: 'Phone (optional)' },
              { field: 'relationship', placeholder: 'e.g. Spouse, Parent, Sibling', label: 'Relationship' },
            ].map(({ field, placeholder, label }) => (
              <div key={field}>
                <label className="text-xs text-gray-500 mb-0.5 block">{label}</label>
                <input value={(nomineeForm as any)[field]} onChange={e => setNomineeForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
              </div>
            ))}
            <button onClick={() => nomineeMutation.mutate()} disabled={nomineeMutation.isPending || !nomineeForm.nominee_name || !nomineeForm.nominee_email}
              className="mt-2 bg-brand text-white px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50 hover:bg-brand-dark">
              {nomineeMutation.isPending ? 'Saving…' : center?.nominee ? 'Update nominee' : 'Set nominee'}
            </button>
          </div>
        </Section>

        {/* Account Deletion */}
        <Section id="deletion" icon={Trash2} title="Right to Erasure — Delete Account">
          {center?.pending_deletion ? (
            <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-orange-500" />
                <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">Deletion scheduled</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Your account will be permanently deleted on{' '}
                <strong>{format(new Date(center.pending_deletion.scheduled_for), 'dd MMM yyyy')}</strong>.
                You can cancel this before then.
              </p>
              <button onClick={() => cancelDeleteMutation.mutate()} disabled={cancelDeleteMutation.isPending}
                className="bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                Cancel deletion
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                Deleting your account will permanently erase your profile, posts, and personal data.
                You have a 30-day grace period to change your mind.
                Some anonymised data may be retained for legal and safety purposes.
              </p>
              <div className="mb-3">
                <label className="text-xs text-gray-500 mb-1 block">Reason for leaving (optional)</label>
                <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={2}
                  placeholder="Help us improve..."
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none resize-none" />
              </div>
              {!showDeleteFinal ? (
                <button onClick={() => setShowDeleteFinal(true)}
                  className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-red-600">
                  <Trash2 size={14} /> Request account deletion
                </button>
              ) : (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400 mb-2">Are you absolutely sure?</p>
                  <p className="text-xs text-gray-500 mb-3">Type <strong>DELETE MY ACCOUNT</strong> to confirm immediate deletion:</p>
                  <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE MY ACCOUNT"
                    className="w-full border border-red-300 dark:border-red-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-red-500 mb-3" />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowDeleteFinal(false); setDeleteConfirm(''); }}
                      className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-full text-sm">
                      Cancel
                    </button>
                    <button onClick={() => deleteConfirm === 'DELETE MY ACCOUNT' ? executeMutation.mutate() : deleteMutation.mutate()}
                      disabled={executeMutation.isPending || deleteMutation.isPending}
                      className="flex-1 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-red-600 disabled:opacity-50">
                      {executeMutation.isPending || deleteMutation.isPending ? 'Deleting…' :
                        deleteConfirm === 'DELETE MY ACCOUNT' ? 'Delete now' : 'Schedule deletion (30 days)'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
