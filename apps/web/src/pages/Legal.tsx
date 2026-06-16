import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, FileText, Mail, Phone, Clock, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';

const GRIEVANCE_EMAIL   = 'grievance@deemona.in';
const GRIEVANCE_OFFICER = 'Abhishek Kumar';
const GRIEVANCE_ADDRESS = 'Deemona Internet Pvt. Ltd., New Delhi, India - 110001';
const GRIEVANCE_PHONE   = '+91-11-XXXX-XXXX';
const RESPONSE_TIME     = '24 hours';
const RESOLUTION_TIME   = '15 days';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 dark:border-gray-800">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
        <span className="font-semibold text-gray-900 dark:text-white">{title}</span>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400 space-y-2">{children}</div>}
    </div>
  );
}

export function TermsOfService() {
  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-brand" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Terms of Service</h1>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Last updated: June 2026 · Governed by Indian Law</p>
      </div>
      <div className="px-4 py-4 space-y-3 text-sm text-gray-600 dark:text-gray-400">
        <p>Welcome to Deemona. By using Deemona, you agree to these Terms of Service. These terms are governed by the laws of India, including the Information Technology Act, 2000 and the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.</p>
        <Section title="1. Acceptance of Terms">
          <p>By accessing or using Deemona, you confirm that you are at least 18 years of age, have read and understood these Terms, and agree to be bound by them.</p>
        </Section>
        <Section title="2. User Conduct & Prohibited Content">
          <p>You agree NOT to post content that promotes hatred, violence, or discrimination against any group based on religion, caste, gender, ethnicity, or sexual orientation; violates the sovereignty and integrity of India; threatens public order, decency, or morality; infringes on intellectual property rights; contains obscene or sexually explicit material; constitutes defamation or cyberbullying; spreads misinformation; or promotes terrorism.</p>
        </Section>
        <Section title="3. Content Moderation (IT Rules 2021)">
          <p>In compliance with Rule 4 of the IT Rules 2021, Deemona employs AI-based automated content moderation, maintains a human review process, acknowledges grievances within 24 hours, resolves grievances within 15 days, publishes monthly compliance reports, and cooperates with government authorities as required by law.</p>
        </Section>
        <Section title="4. Privacy & Data Protection">
          <p>We collect and process your personal data in accordance with our Privacy Policy and applicable Indian data protection laws. We do not sell your personal data to third parties.</p>
        </Section>
        <Section title="5. Governing Law & Dispute Resolution">
          <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in New Delhi, India.</p>
        </Section>
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
          <p>For questions: <a href="mailto:legal@deemona.in" className="text-brand hover:underline">legal@deemona.in</a></p>
        </div>
      </div>
    </div>
  );
}

export function PrivacyPolicy() {
  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-brand" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Privacy Policy</h1>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Last updated: June 2026</p>
      </div>
      <div className="px-4 py-4 space-y-3 text-sm text-gray-600 dark:text-gray-400">
        <p>This Privacy Policy explains how Deemona Internet Pvt. Ltd. collects, uses, and protects your personal information.</p>
        <Section title="1. Information We Collect">
          <p>Account information (name, email, phone), profile information (bio, location, photo), content you post, usage data (IP address, device type), and communications.</p>
        </Section>
        <Section title="2. How We Use Your Information">
          <p>To provide and improve our services, verify your identity, detect harmful content, send notifications, comply with legal obligations, and respond to law enforcement requests.</p>
        </Section>
        <Section title="3. Data Retention">
          <p>We retain your account data for the duration of your account and for 90 days after deletion, as required by the IT Rules 2021.</p>
        </Section>
        <Section title="4. Your Rights">
          <p>You have the right to access, correct, or delete your personal data, withdraw consent, and lodge a complaint with our Grievance Officer.</p>
        </Section>
        <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
          <p>For privacy concerns: <a href="mailto:privacy@deemona.in" className="text-brand hover:underline">privacy@deemona.in</a></p>
        </div>
      </div>
    </div>
  );
}

export function GrievanceOfficer() {
  const [form, setForm] = useState({ name: '', email: '', type: 'content_removal', description: '', post_url: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 1000));
    setSubmitted(true);
    setSubmitting(false);
  };

  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-brand" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Grievance Redressal</h1>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">IT (Intermediary Guidelines) Rules, 2021 · Rule 4(2)</p>
      </div>
      <div className="px-4 py-4">
        <div className="bg-brand/5 border border-brand/20 rounded-2xl p-4 mb-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Shield size={16} className="text-brand" /> Grievance Officer
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <span className="font-medium w-20">Name:</span><span>{GRIEVANCE_OFFICER}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Mail size={14} className="text-brand flex-shrink-0" />
              <a href={`mailto:${GRIEVANCE_EMAIL}`} className="text-brand hover:underline">{GRIEVANCE_EMAIL}</a>
            </div>
            <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
              <Phone size={14} className="text-brand flex-shrink-0" /><span>{GRIEVANCE_PHONE}</span>
            </div>
            <div className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
              <span className="font-medium w-20 flex-shrink-0">Address:</span><span>{GRIEVANCE_ADDRESS}</span>
            </div>
          </div>
          <div className="flex gap-4 mt-4 pt-3 border-t border-brand/20">
            <div className="text-center flex-1">
              <div className="flex items-center justify-center gap-1 text-brand mb-0.5">
                <Clock size={12} /><span className="text-xs font-medium">Acknowledgement</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{RESPONSE_TIME}</p>
            </div>
            <div className="text-center flex-1">
              <div className="flex items-center justify-center gap-1 text-brand mb-0.5">
                <CheckCircle size={12} /><span className="text-xs font-medium">Resolution</span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{RESOLUTION_TIME}</p>
            </div>
          </div>
        </div>

        {submitted ? (
          <div className="text-center py-8">
            <CheckCircle size={48} className="mx-auto mb-3 text-green-500" />
            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1">Grievance Submitted</h3>
            <p className="text-sm text-gray-500 mb-2">We will acknowledge it within 24 hours and resolve it within 15 days.</p>
            <p className="text-xs text-gray-400">Reference ID: GR-{Date.now().toString().slice(-8)}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">Submit a Grievance</h2>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Your full name"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Your email address" type="email"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand" />
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none">
              <option value="content_removal">Content Removal Request</option>
              <option value="account_suspension">Account Suspension Appeal</option>
              <option value="privacy_violation">Privacy Violation</option>
              <option value="impersonation">Impersonation / Fake Account</option>
              <option value="harassment">Harassment / Abuse</option>
              <option value="misinformation">Misinformation / Fake News</option>
              <option value="copyright">Copyright / IP Infringement</option>
              <option value="other">Other</option>
            </select>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Describe your grievance in detail..." rows={4}
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-black text-gray-900 dark:text-white outline-none focus:border-brand resize-none" />
            <button onClick={handleSubmit}
              disabled={!form.name || !form.email || !form.description || submitting}
              className="w-full bg-brand text-white py-3 rounded-full font-semibold text-sm disabled:opacity-50 hover:bg-brand-dark transition-colors">
              {submitting ? 'Submitting...' : 'Submit Grievance'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CommunityGuidelines() {
  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-brand" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Community Guidelines</h1>
        </div>
      </div>
      <div className="px-4 py-4 space-y-4 text-sm text-gray-600 dark:text-gray-400">
        <p>Deemona is built for open, civil discourse. These guidelines help keep our platform safe and constructive for everyone.</p>
        {[
          { emoji: '🤝', title: 'Be Respectful', desc: 'Treat others with dignity. Disagree with ideas, not people. Personal attacks, harassment, and bullying are not allowed.' },
          { emoji: '🇮🇳', title: 'National Integrity', desc: 'Content that threatens the sovereignty, unity, or integrity of India is strictly prohibited and will be reported to authorities.' },
          { emoji: '🕊️', title: 'No Hate Speech', desc: 'Content promoting hatred against any religion, caste, community, gender, or sexual orientation is banned.' },
          { emoji: '✅', title: 'Share Accurate Information', desc: 'Do not spread misinformation or content designed to cause panic, communal disharmony, or public disorder.' },
          { emoji: '🔒', title: 'Respect Privacy', desc: 'Do not share private information of others without consent. This includes public figures.' },
          { emoji: '⚖️', title: 'Follow the Law', desc: 'All content must comply with Indian law, including IPC Sections 153A, 295A, 499, and 505.' },
          { emoji: '🔞', title: 'No Adult Content', desc: 'Deemona is not a platform for pornographic, obscene, or sexually explicit content.' },
          { emoji: '🚫', title: 'No Spam or Manipulation', desc: 'Coordinated inauthentic behaviour, bot networks, and artificial amplification of content are prohibited.' },
        ].map(({ emoji, title, desc }) => (
          <div key={title} className="flex gap-3">
            <span className="text-2xl flex-shrink-0">{emoji}</span>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
              <p className="mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-4 mt-4">
          <p className="font-semibold text-orange-700 dark:text-orange-400 mb-1">Consequences of Violations</p>
          <ul className="text-xs space-y-1 text-orange-600 dark:text-orange-300">
            <li>Content warning applied</li>
            <li>Content removed</li>
            <li>Temporary account suspension</li>
            <li>Permanent account ban</li>
            <li>Reporting to law enforcement (for serious violations)</li>
          </ul>
        </div>
        <p className="text-xs">To report a violation, use the report button on any post or contact our <Link to="/grievance" className="text-brand hover:underline">Grievance Officer</Link>.</p>
      </div>
    </div>
  );
}

export default function Legal() {
  return (
    <div>
      <div className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 z-10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-brand" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Legal & Compliance</h1>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">IT Act 2021 · Indian Law</p>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {[
          { to: '/terms',      icon: FileText,      label: 'Terms of Service',    desc: 'Usage rules and legal agreement' },
          { to: '/privacy',    icon: Shield,        label: 'Privacy Policy',       desc: 'How we collect and use your data' },
          { to: '/guidelines', icon: CheckCircle,   label: 'Community Guidelines', desc: 'Rules for respectful discourse' },
          { to: '/grievance',  icon: AlertTriangle, label: 'Grievance Redressal',  desc: 'File a complaint · IT Rules 2021 Rule 4(2)' },
        ].map(({ to, icon: Icon, label, desc }) => (
          <Link key={to} to={to}
            className="flex items-center gap-4 px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
            <div className="w-10 h-10 bg-brand/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Icon size={18} className="text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-white text-sm">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
            <ChevronDown size={16} className="text-gray-400 -rotate-90" />
          </Link>
        ))}
      </div>
      <div className="px-4 py-6 text-xs text-gray-400 space-y-1 border-t border-gray-100 dark:border-gray-800">
        <p className="font-medium text-gray-500 dark:text-gray-400">Compliance Status</p>
        <div className="flex items-center gap-2 mt-2"><CheckCircle size={12} className="text-green-500" /><span>IT (Intermediary Guidelines) Rules, 2021</span></div>
        <div className="flex items-center gap-2"><CheckCircle size={12} className="text-green-500" /><span>Information Technology Act, 2000</span></div>
        <div className="flex items-center gap-2"><CheckCircle size={12} className="text-green-500" /><span>Grievance Officer Appointed</span></div>
        <div className="flex items-center gap-2"><CheckCircle size={12} className="text-green-500" /><span>AI Content Moderation Active</span></div>
        <div className="flex items-center gap-2"><CheckCircle size={12} className="text-green-500" /><span>24-hour Grievance Acknowledgement</span></div>
      </div>
    </div>
  );
}
