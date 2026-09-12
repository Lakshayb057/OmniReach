import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileCode2,
  PlusCircle,
  Smartphone,
  Mail,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sparkles,
  ExternalLink,
  Layers,
  X,
  Building2,
  Globe,
  Radio,
  Send,
  Zap,
  Edit3,
  Phone,
  MessageSquare,
  Link2,
} from 'lucide-react';
import { WhatsAppPreview } from '../components/Previews/WhatsAppPreview';
import { EmailPreview } from '../components/Previews/EmailPreview';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';

export const TemplatesStudio: React.FC = () => {
  const { user, isSuperadmin } = useAuth();

  const [templates, setTemplates] = useState<any[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  
  // Persisted active channel tab in localStorage
  const [activeChannel, setActiveChannel] = useState<'all' | 'whatsapp' | 'email'>(
    () => (localStorage.getItem('templates_channel_tab') as any) || 'all'
  );
  
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingTemplateId, setSyncingTemplateId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // New/Edit Template Form State
  const [name, setName] = useState('');
  const [targetCompany, setTargetCompany] = useState(isSuperadmin ? 'OmniReach Global' : (user?.company_name || 'Acme Enterprise'));
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('MARKETING');
  const [metaLanguage, setMetaLanguage] = useState('en_US');
  const [headerType, setHeaderType] = useState('NONE');
  const [headerContent, setHeaderContent] = useState('');
  const [bodyContent, setBodyContent] = useState('');
  const [footerContent, setFooterContent] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailHtml, setEmailHtml] = useState('');
  const [buttons, setButtons] = useState<Array<{ type: string; text: string; url?: string; phone_number?: string }>>([]);

  useEffect(() => {
    localStorage.setItem('templates_channel_tab', activeChannel);
    fetchTemplates();
    fetchCompanies();
  }, [activeChannel, selectedCompanyFilter]);

  const fetchCompanies = async () => {
    try {
      const res = await axios.get('/api/auth/companies');
      if (res.data.success) {
        setCompanies(res.data.companies);
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get('/api/templates', {
        params: {
          channel: activeChannel !== 'all' ? activeChannel : undefined,
          company_name: selectedCompanyFilter !== 'all' ? selectedCompanyFilter : undefined,
        },
      });
      if (res.data.success) {
        setTemplates(res.data.templates);
        if (res.data.templates.length > 0 && !selectedTemplate) {
          setSelectedTemplate(res.data.templates[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncAllMeta = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await axios.post('/api/templates/sync-all', {
        company_name: selectedCompanyFilter !== 'all' ? selectedCompanyFilter : undefined,
      });
      if (res.data.success) {
        setSyncFeedback(res.data.message);
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
        fetchTemplates();
        setTimeout(() => setSyncFeedback(null), 5000);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to sync with Meta Cloud API.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncMeta = async (id: string) => {
    setSyncingTemplateId(id);
    try {
      const res = await axios.post(`/api/templates/${id}/sync-meta`);
      if (res.data.success) {
        setSyncFeedback(res.data.message || `Live Meta Status: ${res.data.meta_status}`);
        fetchTemplates();
        if (selectedTemplate?.id === id) {
          setSelectedTemplate(res.data.template);
        }
        setTimeout(() => setSyncFeedback(null), 4000);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Meta template status check failed.');
    } finally {
      setSyncingTemplateId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this template?')) return;
    try {
      await axios.delete(`/api/templates/${id}`);
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (err) {
      alert('Failed to delete template.');
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalBody = channel === 'whatsapp' ? bodyContent : (emailHtml || '<p>Hello {name}</p>');
    if (!name) {
      alert('Template name is required.');
      return;
    }
    if (channel === 'whatsapp' && !bodyContent) {
      alert('WhatsApp Body Content is required.');
      return;
    }
    if (channel === 'email' && (!emailSubject || !emailHtml)) {
      alert('Email Subject line and HTML content are required.');
      return;
    }

    setIsCreating(true);
    try {
      const payload = {
        name,
        company_name: isSuperadmin ? targetCompany : (user?.company_name || 'OmniReach Global'),
        channel,
        category: channel === 'whatsapp' ? category : 'MARKETING',
        meta_language: channel === 'whatsapp' ? metaLanguage : 'en_US',
        header_type: channel === 'whatsapp' ? headerType : 'NONE',
        header_content: channel === 'whatsapp' ? (headerContent || null) : null,
        body_content: finalBody,
        footer_content: channel === 'whatsapp' ? (footerContent || null) : null,
        email_subject: channel === 'email' ? emailSubject : null,
        email_html: channel === 'email' ? emailHtml : null,
        buttons_json: channel === 'whatsapp' ? buttons : [],
      };

      let res;
      if (editingTemplateId) {
        res = await axios.put(`/api/templates/${editingTemplateId}`, payload);
      } else {
        res = await axios.post('/api/templates', payload);
      }

      if (res.data.success) {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        setShowCreateModal(false);
        setSyncFeedback(
          editingTemplateId
            ? 'Template updated successfully!'
            : res.data.message ||
              (channel === 'whatsapp'
                ? 'Template created and submitted to Meta WhatsApp Manager in real-time!'
                : 'Email template created and registered successfully!')
        );
        if (res.data.template) {
          setSelectedTemplate(res.data.template);
        }
        resetForm();
        fetchTemplates();
        setTimeout(() => setSyncFeedback(null), 5000);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || (editingTemplateId ? 'Failed to update template.' : 'Failed to create template.'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditTemplate = (tmpl: any) => {
    setEditingTemplateId(tmpl.id);
    setName(tmpl.name);
    setChannel(tmpl.channel || 'whatsapp');
    setCategory(tmpl.category || 'MARKETING');
    setMetaLanguage(tmpl.meta_language || 'en_US');
    setHeaderType(tmpl.header_type || 'NONE');
    setHeaderContent(tmpl.header_content || '');
    setBodyContent(tmpl.body_content || '');
    setFooterContent(tmpl.footer_content || '');
    setEmailSubject(tmpl.email_subject || '');
    setEmailHtml(tmpl.email_html || '');
    setButtons(Array.isArray(tmpl.buttons_json) ? tmpl.buttons_json : []);
    setTargetCompany(tmpl.company_name || 'OmniReach Global');
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setEditingTemplateId(null);
    setName('');
    setBodyContent('');
    setHeaderContent('');
    setFooterContent('');
    setEmailSubject('');
    setEmailHtml('');
    setButtons([]);
    setChannel(activeChannel === 'email' ? 'email' : 'whatsapp');
    setTargetCompany(isSuperadmin ? 'OmniReach Global' : (user?.company_name || 'OmniReach Global'));
  };

  const handleAddButton = () => {
    if (buttons.length >= 3) {
      alert('WhatsApp supports a maximum of 3 action buttons per template.');
      return;
    }
    const presets = [
      { type: 'URL', text: 'Claim Offer 💳', url: 'https://omnireach.io/apply' },
      { type: 'PHONE_NUMBER', text: 'Call Us 📞', phone_number: '+919876543210' },
      { type: 'QUICK_REPLY', text: 'Interested 👍' },
    ];
    const nextBtn = presets[buttons.length] || { type: 'URL', text: 'Visit Website 🌐', url: 'https://' };
    setButtons([...buttons, nextBtn]);
  };

  const insertVariableToken = (token: string) => {
    setBodyContent((prev) => `${prev} ${token}`);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto animate-fadeIn select-none">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0f172a] p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
              Module 4: Dynamic Templating
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-cyan-400 font-semibold">Meta WhatsApp Cloud API Direct Sync</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Templates Studio & Meta Graph API
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Design WhatsApp interactive templates with direct Meta Graph API submission, company-allocated tokens, and responsive HTML Email merge tags
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncAllMeta}
            disabled={isSyncing}
            className="px-4 py-2.5 rounded-xl bg-[#070b14] hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing with Meta...' : '🔄 Sync with Meta Cloud API'}</span>
          </button>

          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <PlusCircle size={15} />
            <span>Create Template (WhatsApp & Email)</span>
          </button>
        </div>
      </div>

      {/* Sync Feedback Alert */}
      {syncFeedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={16} />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
        {/* Channel Selector */}
        <div className="flex items-center gap-2 bg-[#070b14] p-1 rounded-xl border border-slate-800">
          {(['all', 'whatsapp', 'email'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveChannel(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                activeChannel === tab
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Company Partition Filter (for Superadmin) */}
        {isSuperadmin ? (
          <div className="flex items-center gap-2">
            <Building2 size={14} className="text-cyan-400" />
            <span className="text-xs text-slate-400 font-semibold">Company Partition:</span>
            <select
              value={selectedCompanyFilter}
              onChange={(e) => setSelectedCompanyFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#070b14] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="all">🏢 All Companies ({companies.length})</option>
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-300 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Workspace: <strong className="text-cyan-300">{user?.company_name || 'Acme Enterprise'}</strong></span>
          </div>
        )}
      </div>
      {/* Main Grid: Template List & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Template Selector List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {templates.length === 0 ? (
              <div className="p-8 bg-[#0f172a] border border-slate-800 rounded-2xl text-center text-slate-500 text-xs">
                No templates found for this filter. Click "Create Template" to create one with Meta API.
              </div>
            ) : (
              templates.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTemplate(t)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    selectedTemplate?.id === t.id
                      ? 'bg-blue-600/15 border-blue-500/80 ring-2 ring-blue-500/20 shadow-lg'
                      : 'bg-[#0f172a] border-slate-800 hover:border-slate-700 shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {t.channel === 'whatsapp' ? (
                        <Smartphone size={14} className="text-emerald-400" />
                      ) : (
                        <Mail size={14} className="text-blue-400" />
                      )}
                      <span className="font-bold text-xs text-white">{t.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isSuperadmin && (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[9px] text-slate-300 font-bold border border-slate-700">
                          {t.company_name}
                        </span>
                      )}
                      {t.channel === 'whatsapp' && (
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-extrabold flex items-center gap-1 ${
                            t.meta_status === 'APPROVED'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : t.meta_status === 'REJECTED'
                              ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              : t.meta_status === 'PAUSED'
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                              : 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            t.meta_status === 'APPROVED'
                              ? 'bg-emerald-400'
                              : t.meta_status === 'REJECTED'
                              ? 'bg-rose-400'
                              : 'bg-yellow-400 animate-pulse'
                          }`}></span>
                          <span>{t.meta_status === 'APPROVED' ? 'Approved (Meta)' : t.meta_status || 'Pending Meta'}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {t.body_content}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500">
                    <span>Category: <strong className="text-slate-400">{t.category}</strong></span>
                    <div className="flex items-center gap-2">
                      {t.channel === 'whatsapp' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSyncMeta(t.id);
                          }}
                          disabled={syncingTemplateId === t.id}
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold cursor-pointer disabled:opacity-50"
                          title="Check real-time status directly with Meta Graph API"
                        >
                          <RefreshCw size={11} className={syncingTemplateId === t.id ? 'animate-spin text-cyan-300' : ''} />
                          <span>{syncingTemplateId === t.id ? 'Checking...' : '⚡ Check Live Status'}</span>
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTemplate(t);
                        }}
                        className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold cursor-pointer"
                        title="Edit Template"
                      >
                        <Edit3 size={11} />
                        <span>Edit</span>
                      </button>
                      {isSuperadmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(t.id);
                          }}
                          className="text-rose-400 hover:text-rose-300 cursor-pointer"
                          title="Delete Template (Superadmin Only)"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Device Simulator Canvas */}
        <div className="lg:col-span-7 bg-[#0f172a] border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col items-center justify-center">
          {selectedTemplate ? (
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500">Inspecting: </span>
                  <span className="font-bold text-white">{selectedTemplate.name}</span>
                  <span className="text-slate-500 text-[11px] ml-2">[{selectedTemplate.company_name}]</span>
                </div>
                <div className="flex items-center gap-3">
                  {selectedTemplate.channel === 'whatsapp' && (
                    <>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1.5 ${
                          selectedTemplate.meta_status === 'APPROVED'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40'
                            : selectedTemplate.meta_status === 'REJECTED'
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/40'
                            : 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/40'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          selectedTemplate.meta_status === 'APPROVED'
                            ? 'bg-emerald-400'
                            : selectedTemplate.meta_status === 'REJECTED'
                            ? 'bg-rose-400'
                            : 'bg-yellow-400 animate-pulse'
                        }`}></span>
                        <span>{selectedTemplate.meta_status === 'APPROVED' ? 'Approved (Meta)' : selectedTemplate.meta_status || 'Pending Meta'}</span>
                      </span>

                      <button
                        onClick={() => handleSyncMeta(selectedTemplate.id)}
                        disabled={syncingTemplateId === selectedTemplate.id}
                        className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={11} className={syncingTemplateId === selectedTemplate.id ? 'animate-spin' : ''} />
                        <span>{syncingTemplateId === selectedTemplate.id ? 'Checking...' : '⚡ Check Live Status'}</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleEditTemplate(selectedTemplate)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Edit Template Properties"
                  >
                    <Edit3 size={11} />
                    <span>✏️ Edit</span>
                  </button>
                  <div className="text-cyan-400 font-mono text-[11px]">
                    Meta ID: {selectedTemplate.meta_template_name || selectedTemplate.name}
                  </div>
                </div>
              </div>

              {selectedTemplate.channel === 'whatsapp' ? (
                <WhatsAppPreview
                  headerType={selectedTemplate.header_type}
                  headerContent={selectedTemplate.header_content}
                  bodyContent={selectedTemplate.body_content}
                  footerContent={selectedTemplate.footer_content}
                  buttons={selectedTemplate.buttons_json}
                />
              ) : (
                <EmailPreview
                  subject={selectedTemplate.email_subject || 'OmniReach Tailored Offer'}
                  htmlContent={selectedTemplate.email_html || `<p>${selectedTemplate.body_content}</p>`}
                />
              )}
            </div>
          ) : (
            <div className="text-center text-slate-500 py-16">
              <FileCode2 size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs">Select a template on the left to preview device simulation</p>
            </div>
          )}
        </div>
      </div>

      {/* New Template Designer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-[#0f172a] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 bg-[#070b14] border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-cyan-400" />
                  {editingTemplateId ? 'Edit Campaign Template' : 'Meta WhatsApp & Email Template Designer'}
                </h3>
                <p className="text-xs text-slate-400">
                  {editingTemplateId ? `Updating template parameters & action buttons` : 'Direct integration with Meta WhatsApp Cloud API & Baileys'}
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="p-6 space-y-4 overflow-y-auto">
              {/* Target Company Selection */}
              {isSuperadmin ? (
                <div className="p-3.5 bg-[#070b14] border border-cyan-500/30 rounded-xl space-y-1.5">
                  <label className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                    <Building2 size={14} />
                    Target Company / Tenant Partition *
                  </label>
                  <p className="text-[10px] text-slate-400">
                    Select whether this template uses Superadmin's global token or is registered under a company's allocated WABA token.
                  </p>
                  <select
                    value={targetCompany}
                    onChange={(e) => setTargetCompany(e.target.value)}
                    className="w-full bg-[#0f172a] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="OmniReach Global">🏢 OmniReach Global (Superadmin Self)</option>
                    {companies.filter(c => c !== 'OmniReach Global').map((c) => (
                      <option key={c} value={c}>
                        🏢 {c} (Company Partition)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-[#070b14] border border-slate-800 rounded-xl text-xs flex items-center justify-between text-slate-300">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-cyan-400" />
                    <span>Allocated Tenant: <strong>{user?.company_name || 'Acme Enterprise'}</strong></span>
                  </div>
                  <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded font-bold">
                    Meta WABA Auto-Bound
                  </span>
                </div>
              )}

              {/* Channel Selector inside Create Modal */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setChannel('whatsapp')}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs cursor-pointer transition-all ${
                    channel === 'whatsapp'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md scale-[1.01]'
                      : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smartphone size={16} />
                  <span>WhatsApp Meta Template</span>
                </button>

                <button
                  type="button"
                  onClick={() => setChannel('email')}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs cursor-pointer transition-all ${
                    channel === 'email'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-md scale-[1.01]'
                      : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Mail size={16} />
                  <span>Email (AWS SES / Resend / SMTP)</span>
                </button>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Template Name * <span className="text-[10px] text-slate-500 font-mono">(lowercase_snake_case)</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={channel === 'whatsapp' ? 'e.g. festive_offer_broadcast_v1' : 'e.g. welcome_onboarding_alert'}
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {channel === 'whatsapp' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as any)}
                        className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      >
                        <option value="MARKETING">MARKETING</option>
                        <option value="UTILITY">UTILITY</option>
                        <option value="AUTHENTICATION">AUTHENTICATION</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">Language</label>
                      <select
                        value={metaLanguage}
                        onChange={(e) => setMetaLanguage(e.target.value)}
                        className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      >
                        <option value="en_US">English (US) [en_US]</option>
                        <option value="en_GB">English (UK) [en_GB]</option>
                        <option value="hi">Hindi [hi]</option>
                        <option value="es">Spanish [es]</option>
                        <option value="pt_BR">Portuguese (BR) [pt_BR]</option>
                        <option value="ar">Arabic [ar]</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Header Type</label>
                    <select
                      value={headerType}
                      onChange={(e) => setHeaderType(e.target.value)}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    >
                      <option value="NONE">None</option>
                      <option value="TEXT">Text Header</option>
                      <option value="IMAGE">Image Header</option>
                      <option value="DOCUMENT">Document (PDF)</option>
                    </select>
                  </div>

                  {headerType !== 'NONE' && (
                    <div>
                      <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                        {headerType === 'TEXT'
                          ? 'Header Text *'
                          : headerType === 'IMAGE'
                          ? 'Header Image URL (Direct image or web page link) *'
                          : 'Document Sample URL (PDF) *'}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={
                          headerType === 'TEXT'
                            ? 'Exclusive Festive Offer'
                            : headerType === 'IMAGE'
                            ? 'https://example.com/banner.jpg or https://en.wikipedia.org/wiki/Credit_card'
                            : 'https://example.com/sample.pdf'
                        }
                        value={headerContent}
                        onChange={(e) => setHeaderContent(e.target.value)}
                        className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                      />
                      {headerType === 'IMAGE' && (
                        <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1.5 bg-cyan-950/30 p-2 rounded-lg border border-cyan-500/20">
                          <span>🖼️</span>
                          <span>
                            <strong>Smart Media Dispatch</strong>: Direct images (.png, .jpg, .webp) and web article links (like Wikipedia) are automatically resolved and dispatched as full-resolution WhatsApp image attachments.
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        Body Content * <span className="text-slate-500 font-normal">(use Meta variables)</span>
                      </label>
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className="text-slate-400 font-bold">Quick Variables:</span>
                        <button
                          type="button"
                          onClick={() => insertVariableToken('{{1}}')}
                          className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 font-mono font-bold"
                          title="Full Name"
                        >
                          {'{{1}}'} (Name)
                        </button>
                        <button
                          type="button"
                          onClick={() => insertVariableToken('{{2}}')}
                          className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 font-mono font-bold"
                          title="Contact"
                        >
                          {'{{2}}'} (Phone)
                        </button>
                        <button
                          type="button"
                          onClick={() => insertVariableToken('{{3}}')}
                          className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-mono font-bold"
                          title="Email"
                        >
                          {'{{3}}'} (Email)
                        </button>
                      </div>
                    </div>
                    <textarea
                      required
                      rows={4}
                      placeholder="Hi {{1}}, we are excited to inform you about your pre-approved limit for account {{2}}!"
                      value={bodyContent}
                      onChange={(e) => setBodyContent(e.target.value)}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-lg p-3 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Footer Text</label>
                    <input
                      type="text"
                      placeholder="OmniReach Advisory • Reply STOP to unsubscribe"
                      value={footerContent}
                      onChange={(e) => setFooterContent(e.target.value)}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-300">
                          Interactive Action Buttons ({buttons.length}/3)
                        </label>
                        <p className="text-[10px] text-slate-500">
                          Attach website link buttons, call buttons, or quick replies for interactive engagement
                        </p>
                      </div>
                      {buttons.length < 3 && (
                        <button
                          type="button"
                          onClick={handleAddButton}
                          className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          + Add Button
                        </button>
                      )}
                    </div>

                    {buttons.length === 0 ? (
                      <div className="p-3 bg-[#070b14] border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-xs">
                        No buttons added. Click "+ Add Button" to configure interactive WhatsApp action buttons.
                      </div>
                    ) : (
                      buttons.map((b, idx) => (
                        <div key={idx} className="p-3 bg-[#070b14] border border-slate-800 rounded-xl mb-2.5 space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                                Button #{idx + 1}
                              </span>
                              <select
                                value={b.type || 'URL'}
                                onChange={(e) => {
                                  const copy = [...buttons];
                                  copy[idx].type = e.target.value;
                                  if (e.target.value === 'URL' && !copy[idx].url) copy[idx].url = 'https://';
                                  if (e.target.value === 'PHONE_NUMBER' && !copy[idx].phone_number) copy[idx].phone_number = '+';
                                  setButtons(copy);
                                }}
                                className="bg-[#0f172a] border border-slate-700/80 rounded-lg px-2.5 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500 font-semibold"
                              >
                                <option value="URL">🔗 Visit Website (URL)</option>
                                <option value="PHONE_NUMBER">📞 Call Phone Number</option>
                                <option value="QUICK_REPLY">💬 Quick Reply Text</option>
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={() => setButtons(buttons.filter((_, i) => i !== idx))}
                              className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 text-xs cursor-pointer transition-colors"
                              title="Remove Button"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5 font-medium">Button Label / Text *</label>
                              <input
                                type="text"
                                placeholder={b.type === 'PHONE_NUMBER' ? 'Call Support 📞' : b.type === 'QUICK_REPLY' ? 'Interested 👍' : 'Claim Offer 💳'}
                                value={b.text}
                                onChange={(e) => {
                                  const copy = [...buttons];
                                  copy[idx].text = e.target.value;
                                  setButtons(copy);
                                }}
                                className="w-full bg-[#0f172a] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                                required
                              />
                            </div>

                            {b.type === 'URL' && (
                              <div>
                                <label className="text-[10px] text-slate-400 block mb-0.5 font-medium">Target Destination URL *</label>
                                <input
                                  type="url"
                                  placeholder="https://example.com/apply"
                                  value={b.url || ''}
                                  onChange={(e) => {
                                    const copy = [...buttons];
                                    copy[idx].url = e.target.value;
                                    setButtons(copy);
                                  }}
                                  className="w-full bg-[#0f172a] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                                  required
                                />
                              </div>
                            )}

                            {b.type === 'PHONE_NUMBER' && (
                              <div>
                                <label className="text-[10px] text-slate-400 block mb-0.5 font-medium">Phone Number with Country Code *</label>
                                <input
                                  type="tel"
                                  placeholder="+919876543210"
                                  value={b.phone_number || ''}
                                  onChange={(e) => {
                                    const copy = [...buttons];
                                    copy[idx].phone_number = e.target.value;
                                    setButtons(copy);
                                  }}
                                  className="w-full bg-[#0f172a] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
                                  required
                                />
                              </div>
                            )}

                            {b.type === 'QUICK_REPLY' && (
                              <div className="flex items-center text-[10px] text-slate-500 italic pt-2">
                                Recipient clicking this button will send this exact text back in WhatsApp chat.
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Email Subject Line *</label>
                    <input
                      type="text"
                      required
                      placeholder="Exclusive Pre-Approved Offers for {name} (Ref: {id})"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-semibold"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-300">
                        HTML Email Template * <span className="text-slate-500 font-normal">(supports HTML & merge tags)</span>
                      </label>
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <span className="text-slate-400 font-bold">Merge Tags:</span>
                        <button
                          type="button"
                          onClick={() => setEmailHtml((prev) => `${prev} {name}`)}
                          className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 font-mono font-bold cursor-pointer"
                          title="Full Name"
                        >
                          {'{name}'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmailHtml((prev) => `${prev} {company}`)}
                          className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 font-mono font-bold cursor-pointer"
                          title="Company"
                        >
                          {'{company}'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmailHtml((prev) => `${prev} {mail}`)}
                          className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-mono font-bold cursor-pointer"
                          title="Email"
                        >
                          {'{mail}'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmailHtml((prev) => `${prev} {id}`)}
                          className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 font-mono font-bold cursor-pointer"
                          title="ID"
                        >
                          {'{id}'}
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={8}
                      required
                      placeholder="<div style='font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;'>
  <h2 style='color: #0284c7;'>Hello {name},</h2>
  <p>Your account with <strong>{company}</strong> has a special pre-approved update ready.</p>
  <div style='text-align: center; margin: 25px 0;'>
    <a href='https://omnireach.io' style='background: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;'>Claim Offer Now</a>
  </div>
  <p style='color: #64748b; font-size: 11px;'>Ref ID: {id} • Reply to this email if you need assistance.</p>
</div>"
                      value={emailHtml}
                      onChange={(e) => {
                        setEmailHtml(e.target.value);
                        setBodyContent(e.target.value);
                      }}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-[#070b14] hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl border border-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className={`px-5 py-2 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer transition-all ${
                    channel === 'whatsapp'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20'
                  }`}
                >
                  {isCreating ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>{editingTemplateId ? 'Saving Changes...' : (channel === 'whatsapp' ? 'Registering with Meta...' : 'Saving Email Template...')}</span>
                    </>
                  ) : (
                    <>
                      {channel === 'whatsapp' ? <Send size={14} /> : <Mail size={14} />}
                      <span>
                        {editingTemplateId
                          ? 'Save & Update Template'
                          : channel === 'whatsapp'
                          ? 'Register & Submit to Meta API'
                          : 'Save & Register Email Template'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
