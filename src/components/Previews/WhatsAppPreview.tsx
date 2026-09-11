import React from 'react';
import { Phone, Video, MoreVertical, CheckCheck, ExternalLink, MessageSquare } from 'lucide-react';

interface WhatsAppPreviewProps {
  headerType?: string;
  headerContent?: string;
  bodyContent: string;
  footerContent?: string;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
  leadPreview?: {
    name: string;
    contact: string;
    id: string;
  };
}

export const WhatsAppPreview: React.FC<WhatsAppPreviewProps> = ({
  headerType = 'NONE',
  headerContent,
  bodyContent,
  footerContent,
  buttons = [],
  leadPreview = { name: 'Rahul Sharma', contact: '+91 98765 43210', id: 'OMNI2026A01001' },
}) => {
  // Resolve dynamic tokens for live preview
  let resolvedBody = bodyContent || 'Hello {name}, your special offer (ID: {id}) is ready!';
  resolvedBody = resolvedBody.replace(/{name}/gi, leadPreview.name);
  resolvedBody = resolvedBody.replace(/{contact}/gi, leadPreview.contact);
  resolvedBody = resolvedBody.replace(/{id}/gi, leadPreview.id);
  resolvedBody = resolvedBody.replace(/{unsubscribe_url}/gi, 'https://omnireach.io/unsubscribe');
  resolvedBody = resolvedBody.replace(/{contact_center_url}/gi, 'https://omnireach.io/contact-center');

  return (
    <div className="w-full max-w-sm mx-auto bg-[#0b141a] rounded-[32px] overflow-hidden shadow-2xl border-8 border-slate-950 flex flex-col h-[560px]">
      {/* Mobile Top Bar */}
      <div className="bg-[#1f2c34] px-4 py-3 flex items-center justify-between text-slate-100 shadow-md">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-md">
            OR
          </div>
          <div>
            <div className="text-xs font-bold flex items-center gap-1.5 text-white">
              OmniReach Verified
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            </div>
            <div className="text-[10px] text-emerald-400">Official Business Account</div>
          </div>
        </div>
        <div className="flex items-center space-x-3 text-slate-400">
          <Phone size={15} />
          <Video size={15} />
          <MoreVertical size={15} />
        </div>
      </div>

      {/* WhatsApp Chat Canvas */}
      <div className="flex-1 p-3 overflow-y-auto relative flex flex-col justify-end space-y-2 bg-[#0b141a] bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px]">
        {/* Encryption Notice */}
        <div className="text-center my-1">
          <span className="bg-[#182229] text-amber-300 text-[9px] px-2.5 py-1 rounded shadow-xs inline-block max-w-[260px] font-medium border border-amber-500/20">
            🔒 Messages and calls are end-to-end encrypted. No one outside of this chat can read them.
          </span>
        </div>

        {/* Chat Bubble */}
        <div className="bg-[#1f2c34] text-slate-100 rounded-2xl rounded-tl-none shadow-lg overflow-hidden self-start max-w-[90%] border border-slate-700/50">
          {/* Header Media / Text */}
          {headerType === 'TEXT' && headerContent && (
            <div className="px-3.5 pt-3 font-bold text-xs text-white border-b border-slate-700/50 pb-1">
              {headerContent}
            </div>
          )}
          {headerType === 'IMAGE' && (
            <div className="h-32 bg-[#182229] flex items-center justify-center overflow-hidden border-b border-slate-700/50">
              {headerContent ? (
                <img src={headerContent} alt="Header" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-slate-400 text-xs font-medium">
                  🖼️ Image Header Attached
                </div>
              )}
            </div>
          )}
          {headerType === 'DOCUMENT' && (
            <div className="p-3 bg-[#182229] border-b border-slate-700/50 flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center font-bold text-[10px]">
                PDF
              </div>
              <div className="text-xs font-semibold text-slate-200 truncate">
                {headerContent || 'OmniReach_Announcement.pdf'}
              </div>
            </div>
          )}

          {/* Message Body */}
          <div className="p-3.5 text-xs text-slate-200 whitespace-pre-line leading-relaxed">
            {resolvedBody}
          </div>

          {/* Footer Text */}
          {footerContent && (
            <div className="px-3.5 pb-2 text-[10px] text-slate-400 italic">
              {footerContent}
            </div>
          )}

          {/* Timestamp & Read Receipts */}
          <div className="px-3.5 pb-2 flex items-center justify-end space-x-1 text-[9px] text-slate-400 font-medium">
            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <CheckCheck size={13} className="text-blue-400" />
          </div>

          {/* Interactive CTA Buttons */}
          {buttons && buttons.length > 0 && (
            <div className="border-t border-slate-700/60 divide-y divide-slate-700/60 bg-[#182229]">
              {buttons.map((btn, idx) => (
                <div
                  key={idx}
                  className="py-2 px-3 text-center text-xs font-bold text-[#00a884] hover:bg-slate-700/40 cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                >
                  {btn.type === 'URL' && <ExternalLink size={13} />}
                  {btn.type === 'QUICK_REPLY' && <MessageSquare size={13} />}
                  <span>{btn.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Input Bottom Bar */}
      <div className="bg-[#1f2c34] px-3 py-2 flex items-center gap-2 border-t border-slate-700/50">
        <div className="flex-1 bg-[#182229] rounded-full px-3.5 py-1.5 text-xs text-slate-400 border border-slate-700 shadow-xs">
          Message
        </div>
        <div className="w-8 h-8 rounded-full bg-[#00a884] text-white flex items-center justify-center shadow-md">
          <MessageSquare size={14} />
        </div>
      </div>
    </div>
  );
};
