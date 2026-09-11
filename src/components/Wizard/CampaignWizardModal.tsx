import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  X,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Send,
  Clock,
  Upload,
  FileSpreadsheet,
  Layers,
  MessageSquare,
  Mail,
  Smartphone,
  ShieldAlert,
  Sparkles,
  Download,
  AlertCircle,
  Eye,
  Shield,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { WhatsAppPreview } from '../Previews/WhatsAppPreview';
import { EmailPreview } from '../Previews/EmailPreview';

interface CampaignWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CampaignWizardModal: React.FC<CampaignWizardModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'email' | 'both'>('whatsapp');
  const [tags, setTags] = useState<string[]>(['Festive Offer', 'High Priority']);
  const [tagInput, setTagInput] = useState('');

  // Gateways & Templates
  const [gateways, setGateways] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedWhatsAppGateway, setSelectedWhatsAppGateway] = useState('');
  const [selectedWhatsAppSenderNumber, setSelectedWhatsAppSenderNumber] = useState('');
  const [selectedEmailGateway, setSelectedEmailGateway] = useState('');
  const [selectedWhatsAppTemplate, setSelectedWhatsAppTemplate] = useState('');
  const [selectedEmailTemplate, setSelectedEmailTemplate] = useState('');

  // Step 4: Ingestion State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [ingestionReport, setIngestionReport] = useState<any>(null);
  const [audienceOption, setAudienceOption] = useState<'upload' | 'master_repo'>('upload');
  const [totalAudienceCount, setTotalAudienceCount] = useState(0);

  // Step 6: Schedule State
  const [executionMode, setExecutionMode] = useState<'immediate' | 'scheduled'>('immediate');
  const [scheduledAt, setScheduledAt] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchGatewaysAndTemplates();
      fetchMasterCount();
      const future = new Date(Date.now() + 15 * 60 * 1000);
      setScheduledAt(future.toISOString().slice(0, 16));
    }
  }, [isOpen]);

  const fetchGatewaysAndTemplates = async () => {
    try {
      const [gwRes, tmplRes] = await Promise.all([
        axios.get('/api/gateways'),
        axios.get('/api/templates'),
      ]);
      if (gwRes.data.success) {
        setGateways(gwRes.data.gateways);
        const defaultWA = gwRes.data.gateways.find((g: any) => g.type === 'whatsapp_meta' && g.is_default) || gwRes.data.gateways.find((g: any) => g.type.includes('whatsapp'));
        const defaultEmail = gwRes.data.gateways.find((g: any) => (g.type === 'email_ses' || g.type === 'email_smtp') && g.is_default) || gwRes.data.gateways.find((g: any) => g.type.includes('email'));
        if (defaultWA) setSelectedWhatsAppGateway(defaultWA.id);
        if (defaultEmail) setSelectedEmailGateway(defaultEmail.id);
      }
      if (tmplRes.data.success) {
        setTemplates(tmplRes.data.templates);
        const defaultWATemplate = tmplRes.data.templates.find((t: any) => t.channel === 'whatsapp');
        const defaultEmailTemplate = tmplRes.data.templates.find((t: any) => t.channel === 'email');
        if (defaultWATemplate) setSelectedWhatsAppTemplate(defaultWATemplate.id);
        if (defaultEmailTemplate) setSelectedEmailTemplate(defaultEmailTemplate.id);
      }
    } catch (err) {
      console.error('Failed to load gateways/templates:', err);
    }
  };

  const fetchMasterCount = async () => {
    try {
      const res = await axios.get('/api/leads?limit=1');
      if (res.data.success) {
        setTotalAudienceCount(res.data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to count master leads:', err);
    }
  };

  if (!isOpen) return null;

  const steps = [
    { id: 1, name: 'Campaign Info' },
    { id: 2, name: 'Channels & Gateways' },
    { id: 3, name: 'Template Binding' },
    { id: 4, name: 'Data Ingestion' },
    { id: 5, name: 'Interactive Preview' },
    { id: 6, name: 'Dispatch & Countdown' },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadedFile(file);
      setIsLoading(true);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await axios.post('/api/leads/upload', formData);
        if (res.data.success) {
          setIngestionReport(res.data.report);
          setTotalAudienceCount(res.data.report.totalProcessed);
        }
      } catch (err) {
        console.error('Upload failed:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmitCampaign = async () => {
    setIsLoading(true);
    try {
      const payload = {
        name,
        description,
        channel,
        tags,
        whatsapp_gateway_id: channel === 'email' ? null : selectedWhatsAppGateway,
        whatsapp_phone_number_id: channel === 'email' ? null : selectedWhatsAppSenderNumber || undefined,
        email_gateway_id: channel === 'whatsapp' ? null : selectedEmailGateway,
        whatsapp_template_id: channel === 'email' ? null : selectedWhatsAppTemplate,
        email_template_id: channel === 'whatsapp' ? null : selectedEmailTemplate,
        execution_mode: executionMode,
        scheduled_at: executionMode === 'scheduled' ? scheduledAt : new Date().toISOString(),
      };

      const res = await axios.post('/api/campaigns', payload);
      if (res.data.success) {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      console.error('Failed to create campaign:', err);
      alert(err.response?.data?.message || 'Failed to dispatch campaign.');
    } finally {
      setIsLoading(false);
    }
  };

  const activeWhatsAppTemplateObj = templates.find((t) => t.id === selectedWhatsAppTemplate);
  const activeEmailTemplateObj = templates.find((t) => t.id === selectedEmailTemplate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-5xl bg-[#0f172a] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Wizard Header */}
        <div className="px-6 py-4 bg-[#070b14] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">6-Step Broadcast Campaign Wizard</h2>
              <p className="text-xs text-slate-400">Orchestrate multi-channel broadcasts across Meta WhatsApp & AWS SES</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="bg-[#0b0f19] px-6 py-3 border-b border-slate-800 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[650px]">
            {steps.map((s, idx) => (
              <div key={s.id} className="flex items-center space-x-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    currentStep === s.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40 ring-2 ring-blue-400/30'
                      : currentStep > s.id
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-[#070b14] text-slate-500 border border-slate-800'
                  }`}
                >
                  {currentStep > s.id ? <CheckCircle2 size={14} /> : s.id}
                </div>
                <span
                  className={`text-xs font-semibold ${
                    currentStep === s.id
                      ? 'text-blue-400'
                      : currentStep > s.id
                      ? 'text-slate-200'
                      : 'text-slate-500'
                  }`}
                >
                  {s.name}
                </span>
                {idx < steps.length - 1 && (
                  <div className="w-6 h-[1px] bg-slate-800 mx-1"></div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content Canvas */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: Campaign Information */}
          {currentStep === 1 && (
            <div className="space-y-4 max-w-2xl mx-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Campaign Broadcast Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Festive Q3 Pre-Approved Credit Card Blast"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Internal Description & Strategic Intent
                </label>
                <textarea
                  rows={3}
                  placeholder="Targeting pre-qualified leads with approved credit limits and interest rate drops..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Internal Tracking Tags
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Add tag and press enter (e.g. Diwali2026, Tier-1)"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    className="flex-1 bg-[#070b14] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3.5 py-2 bg-[#070b14] hover:bg-slate-800 text-xs font-semibold text-slate-300 rounded-xl transition-colors border border-slate-800"
                  >
                    Add Tag
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs rounded-lg flex items-center gap-1.5 font-semibold"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="text-blue-400 hover:text-blue-200"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Channel & Gateway Selection */}
          {currentStep === 2 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Select Target Broadcast Channel(s)
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'whatsapp', name: 'WhatsApp Only', icon: Smartphone, desc: 'Meta Cloud API / Baileys' },
                    { id: 'email', name: 'Email Only', icon: Mail, desc: 'AWS SES / Resend / Multi-SMTP' },
                    { id: 'both', name: 'OmniChannel (Both)', icon: Layers, desc: 'Coordinated WhatsApp + Email' },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setChannel(item.id as any)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          channel === item.id
                            ? 'bg-blue-600/15 border-blue-500 text-blue-400 shadow-md ring-2 ring-blue-500/20'
                            : 'bg-[#070b14] border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <Icon size={20} className="mb-2 text-current" />
                        <div className="text-xs font-bold text-slate-200">{item.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{item.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* WhatsApp Gateway Selection */}
              {(channel === 'whatsapp' || channel === 'both') && (() => {
                const currentWhatsAppGw = gateways.find((g) => String(g.id) === String(selectedWhatsAppGateway));
                const availableNumbers: any[] = currentWhatsAppGw?.credentials?.phone_numbers && Array.isArray(currentWhatsAppGw.credentials.phone_numbers) && currentWhatsAppGw.credentials.phone_numbers.length > 0
                  ? currentWhatsAppGw.credentials.phone_numbers
                  : currentWhatsAppGw?.credentials?.display_phone_number
                  ? [{
                      id: currentWhatsAppGw.credentials.phone_number_id,
                      display_phone_number: currentWhatsAppGw.credentials.display_phone_number,
                      verified_name: currentWhatsAppGw.credentials.verified_name || 'Verified Sender',
                      quality_rating: currentWhatsAppGw.quality_rating || 'GREEN',
                      status: 'Connected',
                    }]
                  : [];

                const activeNumberId = selectedWhatsAppSenderNumber || currentWhatsAppGw?.credentials?.phone_number_id || (availableNumbers[0]?.id || '');

                return (
                  <div className="p-4 bg-[#070b14] border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <Smartphone size={15} />
                        WhatsApp Gateway & Infrastructure
                      </label>
                      <span className="text-[10px] text-slate-500">Official Meta Cloud API (WABA)</span>
                    </div>
                    <select
                      value={selectedWhatsAppGateway}
                      onChange={(e) => {
                        setSelectedWhatsAppGateway(e.target.value);
                        const gw = gateways.find((g) => String(g.id) === String(e.target.value));
                        if (gw?.credentials?.phone_number_id) {
                          setSelectedWhatsAppSenderNumber(gw.credentials.phone_number_id);
                        }
                      }}
                      className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-semibold"
                    >
                      {gateways.filter((g) => g.type.includes('whatsapp')).length === 0 ? (
                        <option value="">⚠️ No WhatsApp Gateways Configured (Allocate in Superadmin Vault)</option>
                      ) : (
                        gateways
                          .filter((g) => g.type.includes('whatsapp'))
                          .map((gw) => (
                            <option key={gw.id} value={gw.id}>
                              {gw.type === 'whatsapp_baileys' ? '⚡ [Baileys Web] ' : '📱 [Meta WABA] '}
                              {gw.name} [{gw.company_name || 'OmniReach Global'}] • Quality: {gw.quality_rating} ({gw.is_default ? 'Default' : 'Secondary'})
                            </option>
                          ))
                      )}
                    </select>

                    {(() => {
                      const curGw = gateways.find((g) => String(g.id) === String(selectedWhatsAppGateway));
                      if (curGw?.type === 'whatsapp_baileys') {
                        return (
                          <div className="p-3 bg-gradient-to-r from-cyan-950/40 to-blue-950/40 border border-cyan-500/30 rounded-xl text-xs space-y-1.5 mt-2">
                            <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
                              <Shield size={14} />
                              <span>⚡ Baileys Anti-Ban Engine Active:</span>
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              Human typing simulation, polymorphic SHA-256 anti-hash variations, pre-flight number validation, and intelligent jitter pacing automatically protect your WhatsApp number.
                            </p>
                            <div className="text-[10px] text-cyan-400/90 font-medium">
                              💡 Pro-Tip: You can use Spintax like <code className="bg-cyan-950 px-1 py-0.5 rounded border border-cyan-800">{"{Hello|Hi|Greetings}"}</code> in message templates to generate unique wording per contact.
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Connected WhatsApp Sender Numbers / Channels Selector */}
                    {availableNumbers.length > 0 && (
                      <div className="pt-2 border-t border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>Choose Sender WhatsApp Line (Fetched from Meta):</span>
                          </span>
                          <span className="text-[10px] text-emerald-400 font-mono">
                            {availableNumbers.length} number{availableNumbers.length > 1 ? 's' : ''} connected
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {availableNumbers.map((pn: any) => {
                            const isSelected = activeNumberId === pn.id;
                            return (
                              <div
                                key={pn.id}
                                onClick={() => setSelectedWhatsAppSenderNumber(pn.id)}
                                className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                                  isSelected
                                    ? 'bg-emerald-500/15 border-emerald-500 text-white ring-1 ring-emerald-500/40 shadow-sm'
                                    : 'bg-[#0c1322] border-slate-800 text-slate-400 hover:border-slate-700'
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="font-mono font-bold text-white flex items-center gap-1.5">
                                    <span>{pn.display_phone_number}</span>
                                    {isSelected && <span className="text-[10px] text-emerald-400">✓ Active</span>}
                                  </div>
                                  <div className="text-[10px] text-slate-400">{pn.verified_name}</div>
                                </div>
                                <div className="text-right space-y-1">
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 block">
                                    {pn.quality_rating || 'GREEN'}
                                  </span>
                                  <span className="text-[9px] text-slate-500 block">
                                    {pn.status || 'Connected'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Email Gateway Selection */}
              {(channel === 'email' || channel === 'both') && (
                <div className="p-4 bg-[#070b14] border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                      <Mail size={15} />
                      Email Sender Gateway (AWS SES / Resend / Multi-SMTP)
                    </label>
                    <span className="text-[10px] text-slate-500">High-Throughput Pool</span>
                  </div>
                  <select
                    value={selectedEmailGateway}
                    onChange={(e) => setSelectedEmailGateway(e.target.value)}
                    className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {gateways.filter((g) => g.type.includes('email')).length === 0 ? (
                      <option value="">⚠️ No Email Gateways Configured (Allocate in Superadmin Vault)</option>
                    ) : (
                      gateways
                        .filter((g) => g.type.includes('email'))
                        .map((gw) => (
                          <option key={gw.id} value={gw.id}>
                            {gw.name} [{gw.company_name || 'OmniReach Global'}] ({gw.type === 'email_ses' ? 'AWS SES' : gw.type === 'email_resend' ? 'Resend API' : 'SMTP'})
                          </option>
                        ))
                    )}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Template Binding */}
          {currentStep === 3 && (
            <div className="space-y-6 max-w-2xl mx-auto">
              {/* WhatsApp Template Selector */}
              {(channel === 'whatsapp' || channel === 'both') && (
                <div className="p-4 bg-[#070b14] border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <MessageSquare size={15} />
                      Bind WhatsApp Approved Template
                    </label>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
                      Meta Graph API Synced
                    </span>
                  </div>
                  <select
                    value={selectedWhatsAppTemplate}
                    onChange={(e) => setSelectedWhatsAppTemplate(e.target.value)}
                    className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {templates.filter((t) => t.channel === 'whatsapp').length === 0 ? (
                      <option value="">⚠️ No WhatsApp Templates Found (Create in Templates Vault)</option>
                    ) : (
                      templates
                        .filter((t) => t.channel === 'whatsapp')
                        .map((tmpl) => (
                          <option key={tmpl.id} value={tmpl.id}>
                            {tmpl.name} ({tmpl.category}) - Meta Status: {tmpl.meta_status}
                          </option>
                        ))
                    )}
                  </select>
                  {activeWhatsAppTemplateObj && (
                    <div className="p-3 bg-[#0f172a] rounded-lg border border-slate-800 text-xs text-slate-300">
                      <div className="font-bold text-white mb-1">Body Preview:</div>
                      <div className="whitespace-pre-line text-slate-400 text-[11px]">
                        {activeWhatsAppTemplateObj.body_content}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Email Template Selector */}
              {(channel === 'email' || channel === 'both') && (
                <div className="p-4 bg-[#070b14] border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                      <Mail size={15} />
                      Bind Email Template
                    </label>
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30 font-bold">
                      Merge Tags Supported
                    </span>
                  </div>
                  <select
                    value={selectedEmailTemplate}
                    onChange={(e) => setSelectedEmailTemplate(e.target.value)}
                    className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    {templates.filter((t) => t.channel === 'email').length === 0 ? (
                      <option value="">⚠️ No Email Templates Found (Create in Templates Vault)</option>
                    ) : (
                      templates
                        .filter((t) => t.channel === 'email')
                        .map((tmpl) => (
                          <option key={tmpl.id} value={tmpl.id}>
                            {tmpl.name} - Subject: {tmpl.email_subject || 'Tailored Offer'}
                          </option>
                        ))
                    )}
                  </select>
                  {activeEmailTemplateObj && (
                    <div className="p-3 bg-[#0f172a] rounded-lg border border-slate-800 text-xs text-slate-300">
                      <div className="font-bold text-white mb-1">
                        Subject: {activeEmailTemplateObj.email_subject}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Dynamic merge tags: <code className="text-blue-400 font-bold">&#123;name&#125;</code>, <code className="text-blue-400 font-bold">&#123;contact&#125;</code>, <code className="text-blue-400 font-bold">&#123;id&#125;</code>, <code className="text-blue-400 font-bold">&#123;unsubscribe_url&#125;</code>, <code className="text-blue-400 font-bold">&#123;contact_center_url&#125;</code>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Data Ingestion & Validation */}
          {currentStep === 4 && (
            <div className="space-y-5 max-w-2xl mx-auto">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">Target Contact Audience</label>
                <a
                  href="/api/leads/sample-template"
                  target="_blank"
                  className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-bold"
                >
                  <Download size={13} />
                  Download Sample CSV Template
                </a>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => setAudienceOption('upload')}
                  className={`p-4 rounded-xl border cursor-pointer ${
                    audienceOption === 'upload'
                      ? 'bg-blue-600/15 border-blue-500 text-blue-400 ring-2 ring-blue-500/20 shadow-md'
                      : 'bg-[#070b14] border-slate-800 text-slate-400'
                  }`}
                >
                  <FileSpreadsheet size={20} className="mb-2 text-current" />
                  <div className="text-xs font-bold text-slate-200">Upload CSV / Excel File</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Instant zero-duplicate validation</div>
                </div>

                <div
                  onClick={() => setAudienceOption('master_repo')}
                  className={`p-4 rounded-xl border cursor-pointer ${
                    audienceOption === 'master_repo'
                      ? 'bg-blue-600/15 border-blue-500 text-blue-400 ring-2 ring-blue-500/20 shadow-md'
                      : 'bg-[#070b14] border-slate-800 text-slate-400'
                  }`}
                >
                  <Layers size={20} className="mb-2 text-current" />
                  <div className="text-xs font-bold text-slate-200">Existing Master Contacts</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {totalAudienceCount} active contacts ready
                  </div>
                </div>
              </div>

              {audienceOption === 'upload' && (
                <div className="border-2 border-dashed border-slate-700 hover:border-blue-500 bg-[#070b14] rounded-2xl p-6 text-center transition-colors">
                  <Upload size={32} className="mx-auto text-blue-400 mb-2" />
                  <div className="text-xs font-bold text-slate-200">
                    {uploadedFile ? uploadedFile.name : 'Drag & drop contact CSV/Excel file, or browse'}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Columns: Name, Phone (10+ digits), Email, Address, PAN, City
                  </div>
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="wizard-file-input"
                  />
                  <label
                    htmlFor="wizard-file-input"
                    className="mt-3 inline-block px-4 py-2 bg-[#0f172a] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-sm"
                  >
                    Select File
                  </label>
                </div>
              )}

              {/* Ingestion Validation Report */}
              {ingestionReport && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={16} />
                      Data Ingestion Validation Report
                    </div>
                    <span>{ingestionReport.totalProcessed} Contacts Ready</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-[#070b14] p-2 rounded-lg border border-slate-800 shadow-sm">
                      <div className="text-slate-400 text-[10px]">New Inserted</div>
                      <div className="font-bold text-emerald-400">{ingestionReport.newInserted}</div>
                    </div>
                    <div className="bg-[#070b14] p-2 rounded-lg border border-slate-800 shadow-sm">
                      <div className="text-slate-400 text-[10px]">Zero-Dup Updated</div>
                      <div className="font-bold text-blue-400">{ingestionReport.updatedExisting}</div>
                    </div>
                    <div className="bg-[#070b14] p-2 rounded-lg border border-slate-800 shadow-sm">
                      <div className="text-slate-400 text-[10px]">URN Mapped</div>
                      <div className="font-bold text-purple-400">{ingestionReport.matchedUrnCount}</div>
                    </div>
                    <div className="bg-[#070b14] p-2 rounded-lg border border-slate-800 shadow-sm">
                      <div className="text-slate-400 text-[10px]">Sequential FMCB</div>
                      <div className="font-bold text-cyan-400">{ingestionReport.newFmcbCount}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Interactive Live Preview */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-sm font-bold text-white">Side-by-Side Interactive Device Preview</h3>
                <p className="text-xs text-slate-400">Simulating live recipient personalization tokens</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {(channel === 'whatsapp' || channel === 'both') && (
                  <div>
                    <div className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
                      <Smartphone size={14} />
                      WhatsApp Live Mobile Chat Preview
                    </div>
                    <WhatsAppPreview
                      headerType={activeWhatsAppTemplateObj?.header_type}
                      headerContent={activeWhatsAppTemplateObj?.header_content}
                      bodyContent={activeWhatsAppTemplateObj?.body_content || 'Hello {name}, your offer is ready!'}
                      footerContent={activeWhatsAppTemplateObj?.footer_content}
                      buttons={activeWhatsAppTemplateObj?.buttons_json || []}
                    />
                  </div>
                )}

                {(channel === 'email' || channel === 'both') && (
                  <div>
                    <div className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-1.5">
                      <Mail size={14} />
                      Responsive HTML Email Preview
                    </div>
                    <EmailPreview
                      subject={activeEmailTemplateObj?.email_subject || 'OmniReach Exclusive Notification'}
                      htmlContent={activeEmailTemplateObj?.email_html || `<p>${activeEmailTemplateObj?.body_content || ''}</p>`}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 6: Dispatch & Reverse Countdown */}
          {currentStep === 6 && (
            <div className="space-y-5 max-w-xl mx-auto text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mx-auto">
                <Send size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Ready to Launch Broadcast</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Choose between immediate execution or queue with reverse countdown timer
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div
                  onClick={() => setExecutionMode('immediate')}
                  className={`p-4 rounded-xl border cursor-pointer ${
                    executionMode === 'immediate'
                      ? 'bg-blue-600/15 border-blue-500 text-blue-400 ring-2 ring-blue-500/20 shadow-md'
                      : 'bg-[#070b14] border-slate-800 text-slate-400'
                  }`}
                >
                  <Send size={20} className="mb-2 text-current" />
                  <div className="text-xs font-bold text-slate-200">Immediate Dispatch</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Executes now via 5s background poller</div>
                </div>

                <div
                  onClick={() => setExecutionMode('scheduled')}
                  className={`p-4 rounded-xl border cursor-pointer ${
                    executionMode === 'scheduled'
                      ? 'bg-blue-600/15 border-blue-500 text-blue-400 ring-2 ring-blue-500/20 shadow-md'
                      : 'bg-[#070b14] border-slate-800 text-slate-400'
                  }`}
                >
                  <Clock size={20} className="mb-2 text-current" />
                  <div className="text-xs font-bold text-slate-200">Schedule with Countdown</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Live reverse countdown on dashboard</div>
                </div>
              </div>

              {executionMode === 'scheduled' && (
                <div className="p-4 bg-[#070b14] border border-slate-800 rounded-xl text-left space-y-2">
                  <label className="text-xs font-semibold text-slate-300">Scheduled Execution Timestamp</label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                  <div className="text-[11px] text-amber-300 flex items-center gap-1 mt-1 font-medium">
                    <Clock size={13} />
                    <span>The background dispatch worker will trigger this automatically when the countdown reaches 00:00:00.</span>
                  </div>
                </div>
              )}

              <div className="p-4 bg-[#070b14] rounded-xl border border-slate-800 text-left space-y-1.5 text-xs">
                <div className="font-bold text-white">Campaign Summary:</div>
                <div className="text-slate-400 flex justify-between">
                  <span>Target Audience:</span>
                  <span className="text-slate-200 font-bold">{totalAudienceCount} Contacts</span>
                </div>
                <div className="text-slate-400 flex justify-between">
                  <span>Channel:</span>
                  <span className="text-blue-400 font-bold uppercase">{channel}</span>
                </div>
                <div className="text-slate-400 flex justify-between">
                  <span>Cooldown Safeguard:</span>
                  <span className="text-emerald-400 font-bold">1-Hour Duplicate Protection Active</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        <div className="px-6 py-4 bg-[#070b14] border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 1))}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
            <span>Previous</span>
          </button>

          <div className="text-xs text-slate-500 font-medium">
            Step {currentStep} of {steps.length}
          </div>

          {currentStep < 6 ? (
            <button
              type="button"
              disabled={currentStep === 1 && !name.trim()}
              onClick={() => setCurrentStep((prev) => Math.min(prev + 1, 6))}
              className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition-all"
            >
              <span>Next Step</span>
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              disabled={isLoading || !name.trim()}
              onClick={handleSubmitCampaign}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02]"
            >
              <Send size={15} />
              <span>{executionMode === 'immediate' ? 'Dispatch Broadcast Now 🚀' : 'Schedule Broadcast ⏳'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
