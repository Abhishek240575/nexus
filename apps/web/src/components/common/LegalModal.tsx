import { useState, useRef, useEffect } from 'react';
import { X, FileText, Shield, ChevronDown, ChevronUp, Check } from 'lucide-react';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 dark:border-gray-800">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
        <span className="font-semibold text-sm text-gray-900 dark:text-white">{title}</span>
        {open ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
      </button>
      {open && <div className="px-4 pb-3 text-xs text-gray-600 dark:text-gray-400 space-y-2 leading-relaxed">{children}</div>}
    </div>
  );
}

function TermsContent() {
  return (
    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-3 px-4 py-3">
      <p>Welcome to Deemona. By using Deemona, you agree to these Terms of Service. These terms are governed by the laws of India, including the Information Technology Act, 2000 and the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.</p>
      <Section title="1. Acceptance of Terms">
        <p>By accessing or using Deemona, you confirm that you are at least 18 years of age, have read and understood these Terms, and agree to be bound by them.</p>
      </Section>
      <Section title="2. User Conduct & Prohibited Content">
        <p>You agree NOT to post content that:</p>
        <ul className="list-disc ml-4 space-y-1 mt-1">
          <li>Promotes hatred, violence, or discrimination against any group</li>
          <li>Violates the sovereignty and integrity of India</li>
          <li>Contains obscene, pornographic, or sexually explicit material</li>
          <li>Constitutes defamation, harassment, or cyberbullying</li>
          <li>Spreads misinformation likely to cause panic or communal disharmony</li>
          <li>Promotes terrorism or extremist ideology</li>
          <li>Uses profanity or abusive language in any language</li>
        </ul>
      </Section>
      <Section title="3. Content Moderation (IT Rules 2021)">
        <p>In compliance with Rule 4 of the IT Rules, 2021, Deemona employs AI-based moderation, maintains human review, acknowledges grievances within 24 hours, and resolves them within 15 days.</p>
      </Section>
      <Section title="4. Privacy & Data Protection">
        <p>We collect and process your personal data in accordance with our Privacy Policy and applicable Indian data protection laws. We do not sell your personal data to third parties.</p>
      </Section>
      <Section title="5. Intellectual Property">
        <p>You retain ownership of content you post. By posting, you grant Deemona a non-exclusive, royalty-free license to display and distribute your content on the platform.</p>
      </Section>
      <Section title="6. Account Termination">
        <p>We reserve the right to suspend or terminate accounts that violate these Terms or applicable law. Suspended users may appeal through our Grievance Redressal mechanism.</p>
      </Section>
      <Section title="7. Limitation of Liability">
        <p>Deemona is an intermediary platform under the IT Act, 2000. We are not liable for user-generated content. Our liability is limited to the extent permitted by applicable Indian law.</p>
      </Section>
      <Section title="8. Governing Law">
        <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in New Delhi, India.</p>
      </Section>
      <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
        <p>Questions? Contact us at <span className="text-brand">legal@deemona.in</span></p>
      </div>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-3 px-4 py-3">
      <p>This Privacy Policy explains how Deemona Internet Pvt. Ltd. collects, uses, and protects your personal information in accordance with Indian data protection laws including the DPDP Act 2023.</p>
      <Section title="1. Information We Collect">
        <ul className="list-disc ml-4 space-y-1">
          <li><strong>Account:</strong> Name, email, date of birth</li>
          <li><strong>Profile:</strong> Bio, location, website, profile photo</li>
          <li><strong>Content:</strong> Posts, comments, messages, media you upload</li>
          <li><strong>Usage data:</strong> IP address, device type, browser, pages visited</li>
          <li><strong>Payment data:</strong> Processed by Razorpay — we do not store card details</li>
        </ul>
      </Section>
      <Section title="2. How We Use Your Information">
        <ul className="list-disc ml-4 space-y-1">
          <li>To provide, maintain, and improve our services</li>
          <li>To verify identity and prevent fraud</li>
          <li>To detect and remove harmful content via AI moderation</li>
          <li>To send service notifications</li>
          <li>To comply with legal obligations under Indian law</li>
        </ul>
      </Section>
      <Section title="3. Data Retention">
        <p>Account data is retained for the duration of your account. After deletion, data is anonymised immediately and backups purged within 30 days. Content moderation logs retained 180 days per IT Rules 2021.</p>
      </Section>
      <Section title="4. Data Sharing & Third Parties">
        <p>We do not sell your data. We share data with: Anthropic (AI moderation), Razorpay (payments), LiveKit (Spaces audio), Cloudflare (media storage), Render (hosting). All under data processing agreements.</p>
      </Section>
      <Section title="5. Your Rights (GDPR & DPDP)">
        <ul className="list-disc ml-4 space-y-1">
          <li>Access your personal data (data export in Privacy Center)</li>
          <li>Correct inaccurate data (edit profile)</li>
          <li>Delete your account and data (Privacy Center)</li>
          <li>Withdraw consent at any time (Privacy Center)</li>
          <li>Designate a nominee (DPDP India, Privacy Center)</li>
          <li>Lodge a complaint with our Grievance Officer</li>
        </ul>
      </Section>
      <Section title="6. Cookies">
        <p>We use essential cookies for authentication and security. Optional analytics cookies require your explicit consent via our cookie banner. You can manage cookie preferences at any time.</p>
      </Section>
      <Section title="7. Security">
        <p>We implement industry-standard security including encryption in transit (TLS), hashed passwords (bcrypt), rate limiting, and regular security audits.</p>
      </Section>
      <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
        <p>Privacy concerns? Contact: <span className="text-brand">privacy@deemona.in</span></p>
      </div>
    </div>
  );
}

interface LegalModalProps {
  type:      'terms' | 'privacy';
  onAccept:  () => void;
  onClose:   () => void;
}

export default function LegalModal({ type, onAccept, onClose }: LegalModalProps) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track scroll position
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
    if (atBottom) setScrolledToBottom(true);
  };

  useEffect(() => {
    // Also mark as scrolled if content is short enough to not need scrolling
    const el = scrollRef.current;
    if (el && el.scrollHeight <= el.clientHeight) setScrolledToBottom(true);
  }, []);

  const isTerms = type === 'terms';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-950 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            {isTerms ? <FileText size={18} className="text-brand" /> : <Shield size={18} className="text-brand" />}
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">
                {isTerms ? 'Terms of Service' : 'Privacy Policy'}
              </h2>
              <p className="text-xs text-gray-400">Please read before accepting</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} onScroll={handleScroll}
          className="flex-1 overflow-y-auto min-h-0">
          {isTerms ? <TermsContent /> : <PrivacyContent />}
        </div>

        {/* Scroll hint */}
        {!scrolledToBottom && (
          <div className="px-5 py-2 bg-amber-50 dark:bg-amber-900/10 border-t border-amber-100 dark:border-amber-900/30 flex-shrink-0">
            <p className="text-xs text-amber-700 dark:text-amber-400 text-center">
              Please scroll to the bottom to read the full document before accepting
            </p>
          </div>
        )}

        {/* Accept footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
              disabled={!scrolledToBottom}
              className="mt-0.5 w-4 h-4 text-brand border-gray-300 rounded focus:ring-brand disabled:opacity-40" />
            <span className={`text-xs leading-relaxed ${scrolledToBottom ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}`}>
              I have read and agree to Deemona's {isTerms ? 'Terms of Service' : 'Privacy Policy'}
            </span>
          </label>
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 py-2.5 rounded-full text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
              Cancel
            </button>
            <button onClick={() => { if (accepted) onAccept(); }}
              disabled={!accepted || !scrolledToBottom}
              className="flex-1 bg-brand text-white py-2.5 rounded-full text-sm font-semibold disabled:opacity-40 hover:bg-brand-dark transition-colors flex items-center justify-center gap-1.5 disabled:cursor-not-allowed">
              <Check size={14} />
              I Accept
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
