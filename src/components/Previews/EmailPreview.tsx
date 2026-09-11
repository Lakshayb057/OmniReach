import React from 'react';
import { Mail, ShieldCheck, ExternalLink } from 'lucide-react';

interface EmailPreviewProps {
  subject: string;
  htmlContent: string;
  fromName?: string;
  fromEmail?: string;
  leadPreview?: {
    name: string;
    contact: string;
    id: string;
  };
}

export const EmailPreview: React.FC<EmailPreviewProps> = ({
  subject,
  htmlContent,
  fromName = 'OmniReach Customer Engagement',
  fromEmail = 'broadcasts@omnireach.io',
  leadPreview = { name: 'Rahul Sharma', contact: '+91 98765 43210', id: 'OMNI2026A01001' },
}) => {
  let resolvedSubject = subject || 'Exclusive Pre-Approved Offers for {name} (Ref: {id})';
  resolvedSubject = resolvedSubject.replace(/{name}/gi, leadPreview.name);
  resolvedSubject = resolvedSubject.replace(/{contact}/gi, leadPreview.contact);
  resolvedSubject = resolvedSubject.replace(/{id}/gi, leadPreview.id);

  let resolvedHtml = htmlContent || `<p>Hello {name}, your special offer is ready!</p>`;
  resolvedHtml = resolvedHtml.replace(/{name}/gi, leadPreview.name);
  resolvedHtml = resolvedHtml.replace(/{contact}/gi, leadPreview.contact);
  resolvedHtml = resolvedHtml.replace(/{id}/gi, leadPreview.id);
  resolvedHtml = resolvedHtml.replace(/{unsubscribe_url}/gi, 'https://omnireach.io/unsubscribe');
  resolvedHtml = resolvedHtml.replace(/{contact_center_url}/gi, 'https://omnireach.io/contact-center');

  return (
    <div className="w-full bg-[#0f172a] rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col h-[560px]">
      {/* Email Client Top Bar */}
      <div className="bg-[#070b14] px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
          <span className="ml-2 font-semibold text-slate-300">AWS SES / Multi-SMTP Email Client</span>
        </div>
        <div className="flex items-center space-x-1 text-emerald-400 text-[11px] font-bold">
          <ShieldCheck size={14} />
          <span>DKIM & SPF Verified</span>
        </div>
      </div>

      {/* Email Meta Headers */}
      <div className="bg-[#0b0f19] px-4 py-3 border-b border-slate-800/80 space-y-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 w-14 font-medium">From:</span>
          <span className="font-bold text-white">{fromName}</span>
          <span className="text-slate-500 font-mono text-[11px]">&lt;{fromEmail}&gt;</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 w-14 font-medium">To:</span>
          <span className="text-slate-300 font-semibold">{leadPreview.name} &lt;lead@example.com&gt;</span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
          <span className="text-slate-500 w-14 font-medium">Subject:</span>
          <span className="font-bold text-blue-400 text-xs">{resolvedSubject}</span>
        </div>
      </div>

      {/* Email Body Content */}
      <div className="flex-1 bg-[#0f172a] p-6 overflow-y-auto text-xs text-slate-200 space-y-4">
        <div
          className="prose prose-invert prose-sm max-w-none text-slate-200"
          dangerouslySetInnerHTML={{ __html: resolvedHtml }}
        />

        {/* Universal Compliance Footer */}
        <div className="pt-6 mt-6 border-t border-slate-800 text-[10px] text-slate-500 space-y-1 text-center">
          <p>
            You are receiving this communication because you are registered with OmniReach Services.
          </p>
          <div className="flex items-center justify-center space-x-3 text-blue-400 font-medium">
            <a href="https://omnireach.io/contact-center" target="_blank" rel="noreferrer" className="hover:underline">
              Manage Contact Preferences
            </a>
            <span>•</span>
            <a href="https://omnireach.io/unsubscribe" target="_blank" rel="noreferrer" className="hover:underline text-rose-400">
              1-Click Unsubscribe
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
