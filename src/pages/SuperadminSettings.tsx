import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Crown,
  ShieldCheck,
  History,
  Database,
  Radio,
  Activity,
  RefreshCw,
  Cpu,
  Layers,
  Sparkles,
  Key,
  Smartphone,
  Mail,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Building2,
  Trash2,
  Play,
  Copy,
  Lock,
  Search,
  Check,
  FileCode2,
  Globe,
  Sliders,
  X,
  ExternalLink,
  MessageSquare,
  Clock,
  Send,
  Zap,
  QrCode,
  Phone,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { WhatsAppPreview } from '../components/Previews/WhatsAppPreview';
import { EmailPreview } from '../components/Previews/EmailPreview';
import { BaileysPairingModal } from '../components/Baileys/BaileysPairingModal';

export const SuperadminSettings: React.FC = () => {
  const { isSuperadmin, user } = useAuth();
  const { isConnected } = useSocket();

  // Tab Navigation: Gateways Vault, Templates Vault, Engine Diagnostics, Security Logs
  const [activeTab, setActiveTab] = useState<'gateways' | 'templates' | 'engine' | 'logs'>('gateways');
  
  // Gateways Vault State
  const [gateways, setGateways] = useState<any[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [baileysModalGw, setBaileysModalGw] = useState<any | null>(null);

  // Unmask secret state
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  
  // Edited Credentials State: gatewayId -> credentials object
  const [editingCreds, setEditingCreds] = useState<Record<string, any>>({});
  const [savingGatewayId, setSavingGatewayId] = useState<string | null>(null);
  const [saveSuccessMap, setSaveSuccessMap] = useState<Record<string, string>>({});

  // Live Test Diagnostic State
  const [testingGatewayId, setTestingGatewayId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; details?: any }>>({});

  // New Gateway Allocation Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newGwName, setNewGwName] = useState('');
  const [newGwType, setNewGwType] = useState<'whatsapp_meta' | 'whatsapp_baileys' | 'email_ses' | 'email_smtp' | 'email_resend'>('whatsapp_meta');
  const [newGwCompany, setNewGwCompany] = useState('OmniReach Global');
  const [isCustomNewGwCompany, setIsCustomNewGwCompany] = useState(false);
  const [newGwCreds, setNewGwCreds] = useState<any>({});
  const [isAdding, setIsAdding] = useState(false);

  // Meta Live Inspection & Auto-Discovery State
  const [isInspectingMeta, setIsInspectingMeta] = useState(false);
  const [metaInspectResult, setMetaInspectResult] = useState<any | null>(null);
  const [autoFetchMetaContacts, setAutoFetchMetaContacts] = useState(true);

  // Gateway Contact Fetching State
  const [fetchingContactsGwId, setFetchingContactsGwId] = useState<string | null>(null);
  const [gwFetchFeedbackMap, setGwFetchFeedbackMap] = useState<Record<string, { success: boolean; message: string }>>({});

  // Allocation Success Dialog Modal State
  const [allocationReportModal, setAllocationReportModal] = useState<{
    isOpen: boolean;
    gateway?: any;
    metaDetails?: any;
    contactsReport?: any;
    templatesReport?: any;
  }>({ isOpen: false });

  // ==========================================
  // TEMPLATES VAULT STATE (TOGGLE-BASED)
  // ==========================================
  // Primary Toggle: WhatsApp Meta vs AWS SES/Resend/SMTP Email
  const [templateChannelToggle, setTemplateChannelToggle] = useState<'whatsapp' | 'email'>('whatsapp');
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateCompanyFilter, setTemplateCompanyFilter] = useState<string>('all');
  const [templateStatusFilter, setTemplateStatusFilter] = useState<string>('all');
  const [templateSearchQuery, setTemplateSearchQuery] = useState<string>('');
  const [isSyncingMeta, setIsSyncingMeta] = useState(false);
  const [syncMetaFeedback, setSyncMetaFeedback] = useState<string | null>(null);
  const [previewModalTemplate, setPreviewModalTemplate] = useState<any | null>(null);
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
  const [selectedGatewayIds, setSelectedGatewayIds] = useState<string[]>([]);
  const [isDeletingGateways, setIsDeletingGateways] = useState(false);
  const [selectedSuperadminTemplateIds, setSelectedSuperadminTemplateIds] = useState<string[]>([]);
  const [isDeletingSuperadminTemplates, setIsDeletingSuperadminTemplates] = useState(false);

  // Create Template Modal State
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [newTmplName, setNewTmplName] = useState('');
  const [newTmplCompany, setNewTmplCompany] = useState('OmniReach Global');
  const [isCustomNewTmplCompany, setIsCustomNewTmplCompany] = useState(false);
  const [newTmplChannel, setNewTmplChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [newTmplCategory, setNewTmplCategory] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('MARKETING');
  const [newTmplLanguage, setNewTmplLanguage] = useState('en_US');
  const [newTmplHeaderType, setNewTmplHeaderType] = useState('NONE');
  const [newTmplHeaderContent, setNewTmplHeaderContent] = useState('');
  const [newTmplBody, setNewTmplBody] = useState('');
  const [newTmplFooter, setNewTmplFooter] = useState('');
  const [newTmplEmailSubject, setNewTmplEmailSubject] = useState('');
  const [newTmplEmailHtml, setNewTmplEmailHtml] = useState('');
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchCompanies();
    fetchGateways();
    fetchTemplates();
    fetchAuditLogs();
  }, [selectedCompany, templateCompanyFilter]);

  const fetchCompanies = async () => {
    try {
      const res = await axios.get('/api/auth/companies');
      if (res.data.success) {
        setCompanies(res.data.companies);
        if (res.data.companies.length > 0 && !newGwCompany) {
          setNewGwCompany(res.data.companies[0]);
          setNewTmplCompany(res.data.companies[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load companies:', err);
    }
  };

  const fetchGateways = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get('/api/gateways', {
        params: { company_name: selectedCompany },
      });
      if (res.data.success) {
        setGateways(res.data.gateways);
        const credMap: Record<string, any> = {};
        for (const gw of res.data.gateways) {
          credMap[gw.id] = {
            ...gw.credentials,
            name: gw.name,
            company_name: gw.company_name,
            is_active: gw.is_active,
            is_default: gw.is_default,
            quality_rating: gw.quality_rating,
          };
        }
        setEditingCreds(credMap);
      }
    } catch (err) {
      console.error('Failed to load gateways:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await axios.get('/api/templates', {
        params: {
          company_name: templateCompanyFilter !== 'all' ? templateCompanyFilter : undefined,
        },
      });
      if (res.data.success) {
        setTemplates(res.data.templates);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await axios.get('/api/auth/audit-logs');
      if (res.data.success) {
        setAuditLogs(res.data.logs);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  const toggleSecretVisibility = (fieldKey: string) => {
    setVisibleSecrets((prev) => ({
      ...prev,
      [fieldKey]: !prev[fieldKey],
    }));
  };

  const handleCredChange = (gatewayId: string, field: string, value: any) => {
    setEditingCreds((prev) => ({
      ...prev,
      [gatewayId]: {
        ...prev[gatewayId],
        [field]: value,
      },
    }));
  };

  const handleSaveGateway = async (gw: any) => {
    const data = editingCreds[gw.id] || {};
    const { name, company_name, is_active, is_default, quality_rating, ...credentials } = data;

    setSavingGatewayId(gw.id);
    try {
      const res = await axios.put(`/api/gateways/${gw.id}`, {
        name: name || gw.name,
        company_name: company_name || gw.company_name,
        is_active: is_active !== undefined ? is_active : gw.is_active,
        is_default: is_default !== undefined ? is_default : gw.is_default,
        quality_rating: quality_rating || gw.quality_rating,
        credentials,
        type: gw.type,
      });

      if (res.data.success) {
        setSaveSuccessMap((prev) => ({ ...prev, [gw.id]: 'Credentials saved to PostgreSQL!' }));
        setTimeout(() => {
          setSaveSuccessMap((prev) => {
            const next = { ...prev };
            delete next[gw.id];
            return next;
          });
        }, 3500);
        fetchGateways();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save gateway credentials.');
    } finally {
      setSavingGatewayId(null);
    }
  };

  const handleTestGateway = async (gw: any) => {
    const data = editingCreds[gw.id] || gw.credentials || {};
    setTestingGatewayId(gw.id);
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[gw.id];
      return next;
    });

    try {
      if (gw.type === 'whatsapp_meta') {
        const res = await axios.post('/api/gateways/test-whatsapp', {
          phone_number_id: data.phone_number_id,
          system_user_token: data.system_user_token,
          waba_id: data.waba_id,
        });
        setTestResults((prev) => ({
          ...prev,
          [gw.id]: { success: true, message: res.data.message, details: res.data.details },
        }));
      } else if (gw.type === 'email_ses') {
        const res = await axios.post('/api/gateways/test-ses', {
          access_key_id: data.access_key_id,
          secret_access_key: data.secret_access_key,
          region: data.region,
          from_email: data.from_email,
        });
        setTestResults((prev) => ({
          ...prev,
          [gw.id]: { success: true, message: res.data.message, details: res.data.quota },
        }));
      } else if (gw.type === 'email_resend') {
        const res = await axios.post('/api/gateways/test-resend', {
          api_key: data.api_key,
          from_email: data.from_email,
        });
        setTestResults((prev) => ({
          ...prev,
          [gw.id]: { success: res.data.success, message: res.data.message, details: res.data.details },
        }));
      } else if (gw.type === 'email_smtp') {
        const res = await axios.post('/api/gateways/test-smtp', {
          host: data.host,
          port: data.port,
          user: data.user,
          pass: data.pass,
          secure: data.secure,
        });
        setTestResults((prev) => ({
          ...prev,
          [gw.id]: { success: res.data.success, message: res.data.message },
        }));
      } else if (gw.type === 'whatsapp_baileys') {
        const res = await axios.get(`/api/baileys/${gw.id}/status`);
        setTestResults((prev) => ({
          ...prev,
          [gw.id]: {
            success: res.data.status === 'connected',
            message: res.data.status === 'connected'
              ? `Baileys socket active & connected to +${res.data.phoneNumber} (${res.data.pushName})`
              : `Baileys status: ${res.data.status}. QR Code ${res.data.hasQr ? 'ready to scan' : 'pending scan in Gateway Settings'}.`,
            details: res.data,
          },
        }));
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [gw.id]: {
          success: false,
          message: err.response?.data?.message || 'Gateway diagnostic connection failed.',
        },
      }));
    } finally {
      setTestingGatewayId(null);
    }
  };

  const handleDeleteGateway = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete gateway "${name}"?`)) return;
    try {
      const res = await axios.delete(`/api/gateways/${id}`);
      if (res.data.success) {
        setSelectedGatewayIds((prev) => prev.filter((gId) => gId !== id));
        fetchGateways();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete gateway.');
    }
  };

  const handleToggleSelectGateway = (id: string) => {
    setSelectedGatewayIds((prev) =>
      prev.includes(id) ? prev.filter((gId) => gId !== id) : [...prev, id]
    );
  };

  const handleSelectAllGateways = () => {
    if (selectedGatewayIds.length === gateways.length) {
      setSelectedGatewayIds([]);
    } else {
      setSelectedGatewayIds(gateways.map((g) => g.id));
    }
  };

  const handleBulkDeleteGateways = async () => {
    if (selectedGatewayIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete all ${selectedGatewayIds.length} selected gateway(s)?`)) {
      return;
    }
    try {
      setIsDeletingGateways(true);
      const res = await axios.post('/api/gateways/batch-delete', {
        gateway_ids: selectedGatewayIds,
      });
      if (res.data.success) {
        setSelectedGatewayIds([]);
        fetchGateways();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to bulk delete gateways.');
    } finally {
      setIsDeletingGateways(false);
    }
  };

  const handleInspectMetaToken = async () => {
    if (!newGwCreds.system_user_token) {
      alert('Please enter a Meta System User Permanent Token to inspect.');
      return;
    }
    setIsInspectingMeta(true);
    setMetaInspectResult(null);
    try {
      const res = await axios.post('/api/gateways/inspect-meta-token', {
        system_user_token: newGwCreds.system_user_token,
        phone_number_id: newGwCreds.phone_number_id,
        waba_id: newGwCreds.waba_id,
        business_id: newGwCreds.business_id,
      });
      if (res.data.success) {
        setMetaInspectResult(res.data);
        setNewGwCreds((prev: any) => ({
          ...prev,
          phone_number_id: prev.phone_number_id || res.data.phone_number_id || '',
          waba_id: prev.waba_id || res.data.waba_id || '',
          business_id: prev.business_id || res.data.business_id || '',
          display_phone_number: prev.display_phone_number || res.data.display_phone_number || '',
          verified_name: prev.verified_name || res.data.verified_name || '',
          phone_numbers: res.data.phone_numbers || [],
        }));
        if (!newGwName) {
          setNewGwName(`Meta WABA - ${res.data.verified_name || newGwCompany}`);
        }
      } else {
        setMetaInspectResult({ valid: false, message: res.data.message || 'Token verification failed.' });
      }
    } catch (err: any) {
      setMetaInspectResult({
        valid: false,
        message: err.response?.data?.message || 'Meta token inspection request failed.',
      });
    } finally {
      setIsInspectingMeta(false);
    }
  };

  const handleFetchContactsForGateway = async (gw: any) => {
    setFetchingContactsGwId(gw.id);
    setGwFetchFeedbackMap((prev) => {
      const next = { ...prev };
      delete next[gw.id];
      return next;
    });
    try {
      const res = await axios.post(`/api/gateways/${gw.id}/fetch-contacts`);
      if (res.data.success) {
        setGwFetchFeedbackMap((prev) => ({
          ...prev,
          [gw.id]: { success: true, message: res.data.message },
        }));
        setTimeout(() => {
          setGwFetchFeedbackMap((prev) => {
            const next = { ...prev };
            delete next[gw.id];
            return next;
          });
        }, 5000);
        fetchGateways();
      }
    } catch (err: any) {
      setGwFetchFeedbackMap((prev) => ({
        ...prev,
        [gw.id]: {
          success: false,
          message: err.response?.data?.message || 'Failed to fetch contacts from Meta.',
        },
      }));
    } finally {
      setFetchingContactsGwId(null);
    }
  };

  const handleCreateNewGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCompany = newGwCompany.trim() || 'OmniReach Global';
    if (!newGwName || !finalCompany) {
      alert('Gateway Name and Assigned Company are required.');
      return;
    }
    setIsAdding(true);
    try {
      const res = await axios.post('/api/gateways', {
        name: newGwName,
        type: newGwType,
        company_name: finalCompany,
        credentials: newGwCreds,
        is_active: true,
        is_default: false,
        quality_rating: 'GREEN',
        auto_fetch_contacts: autoFetchMetaContacts,
      });
      if (res.data.success) {
        setShowAddModal(false);
        const createdGw = res.data.gateway;
        setNewGwName('');
        setNewGwCompany('OmniReach Global');
        setIsCustomNewGwCompany(false);
        setNewGwCreds({});
        setMetaInspectResult(null);
        fetchGateways();
        fetchCompanies();
        fetchTemplates();

        if (newGwType === 'whatsapp_baileys') {
          // Immediately launch the live Baileys Pairing / QR Scanner modal for this newly allocated company gateway!
          setBaileysModalGw(createdGw);
        } else {
          // Trigger Detailed Success & Allocation Summary Report Dialog for Meta/Email
          setAllocationReportModal({
            isOpen: true,
            gateway: createdGw,
            metaDetails: res.data.metaDetails,
            contactsReport: res.data.contactsReport,
            templatesReport: res.data.templatesReport,
          });
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create gateway.');
    } finally {
      setIsAdding(false);
    }
  };

  // ==========================================
  // TEMPLATES VAULT HANDLERS
  // ==========================================
  const handleSyncMetaTemplates = async () => {
    setIsSyncingMeta(true);
    setSyncMetaFeedback(null);
    try {
      const res = await axios.post('/api/templates/sync-meta', {
        company_name: templateCompanyFilter !== 'all' ? templateCompanyFilter : undefined,
      });
      if (res.data.success) {
        setSyncMetaFeedback(`✓ ${res.data.message} (${res.data.totalSynced || 0} updated)`);
        fetchTemplates();
        setTimeout(() => setSyncMetaFeedback(null), 4000);
      }
    } catch (err: any) {
      setSyncMetaFeedback(`⚠️ ${err.response?.data?.message || 'Meta Sync failed.'}`);
      setTimeout(() => setSyncMetaFeedback(null), 5000);
    } finally {
      setIsSyncingMeta(false);
    }
  };

  const handleDeleteTemplate = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete template "${name}"?`)) return;
    try {
      const res = await axios.delete(`/api/templates/${id}`);
      if (res.data.success) {
        setSelectedSuperadminTemplateIds((prev) => prev.filter((tId) => tId !== id));
        fetchTemplates();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete template.');
    }
  };

  const handleToggleSelectTemplate = (id: string) => {
    setSelectedSuperadminTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((tId) => tId !== id) : [...prev, id]
    );
  };

  const handleSelectAllTemplates = () => {
    if (selectedSuperadminTemplateIds.length === templates.length) {
      setSelectedSuperadminTemplateIds([]);
    } else {
      setSelectedSuperadminTemplateIds(templates.map((t) => t.id));
    }
  };

  const handleBulkDeleteTemplates = async () => {
    if (selectedSuperadminTemplateIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete all ${selectedSuperadminTemplateIds.length} selected template(s)?`)) {
      return;
    }
    try {
      setIsDeletingSuperadminTemplates(true);
      const res = await axios.post('/api/templates/batch-delete', {
        template_ids: selectedSuperadminTemplateIds,
      });
      if (res.data.success) {
        setSelectedSuperadminTemplateIds([]);
        fetchTemplates();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to bulk delete templates.');
    } finally {
      setIsDeletingSuperadminTemplates(false);
    }
  };

  const handleCopyTemplateContent = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedTemplateId(id);
    setTimeout(() => setCopiedTemplateId(null), 2500);
  };

  const handleCreateTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCompany = newTmplCompany.trim() || 'OmniReach Global';
    if (!newTmplName) {
      alert('Template Name is required.');
      return;
    }
    if (newTmplChannel === 'whatsapp' && !newTmplBody) {
      alert('WhatsApp Body Content is required.');
      return;
    }
    if (newTmplChannel === 'email' && (!newTmplEmailSubject || !newTmplEmailHtml)) {
      alert('Email Subject and HTML content are required.');
      return;
    }

    setIsCreatingTemplate(true);
    try {
      const res = await axios.post('/api/templates', {
        name: newTmplName,
        company_name: finalCompany,
        channel: newTmplChannel,
        category: newTmplCategory,
        meta_language: newTmplLanguage,
        header_type: newTmplHeaderType,
        header_content: newTmplHeaderContent,
        body_content: newTmplChannel === 'whatsapp' ? newTmplBody : newTmplEmailHtml,
        footer_content: newTmplFooter,
        email_subject: newTmplEmailSubject,
        email_html: newTmplEmailHtml,
      });

      if (res.data.success) {
        setShowCreateTemplateModal(false);
        setNewTmplName('');
        setNewTmplBody('');
        setNewTmplFooter('');
        setNewTmplEmailSubject('');
        setNewTmplEmailHtml('');
        setIsCustomNewTmplCompany(false);
        fetchTemplates();
        fetchCompanies();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create template.');
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  // Helper to render body with highlighted variable chips
  const renderFormattedBody = (text: string) => {
    if (!text) return 'No body text provided.';
    const parts = text.split(/(\{\{[0-9a-zA-Z_]+\}\}|\{[0-9a-zA-Z_]+\})/g);
    return parts.map((part, index) => {
      if (/^(\{\{|\{)/.test(part)) {
        return (
          <span
            key={index}
            className="inline-flex items-center px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-black border border-cyan-500/40 shadow-xs mx-0.5"
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Filter templates based on channel toggle, company filter, status filter, and search query
  const filteredTemplates = templates.filter((t) => {
    const matchesChannel = t.channel === templateChannelToggle;
    const matchesCompany =
      templateCompanyFilter === 'all' || t.company_name === templateCompanyFilter;
    const matchesStatus =
      templateStatusFilter === 'all' ||
      (t.meta_status && t.meta_status.toUpperCase() === templateStatusFilter.toUpperCase());
    const query = templateSearchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      t.name?.toLowerCase().includes(query) ||
      t.body_content?.toLowerCase().includes(query) ||
      t.email_subject?.toLowerCase().includes(query) ||
      t.company_name?.toLowerCase().includes(query) ||
      t.category?.toLowerCase().includes(query);

    return matchesChannel && matchesCompany && matchesStatus && matchesSearch;
  });

  const whatsappTemplatesCount = templates.filter((t) => t.channel === 'whatsapp').length;
  const emailTemplatesCount = templates.filter((t) => t.channel === 'email').length;
  const approvedMetaCount = templates.filter((t) => t.channel === 'whatsapp' && (t.meta_status === 'APPROVED' || t.meta_status === 'Active')).length;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto animate-fadeIn select-none w-full min-w-0">
      {/* Header Banner */}
      <div
        className={`relative overflow-hidden p-6 rounded-3xl border shadow-2xl ${
          isSuperadmin
            ? 'bg-gradient-to-r from-[#170e28] via-[#0c1428] to-[#081b2c] border-amber-500/30'
            : 'bg-gradient-to-r from-[#0c1428] via-[#071324] to-[#0f172a] border-cyan-500/30'
        }`}
      >
        <div
          className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none ${
            isSuperadmin ? 'bg-amber-500/10' : 'bg-cyan-500/10'
          }`}
        ></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              {isSuperadmin ? (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Crown size={13} className="text-amber-400" />
                  Superadmin Neural Core
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 size={13} className="text-cyan-400" />
                  {user?.company_name || 'Enterprise'} Workspace
                </span>
              )}
              <span className="text-slate-600">•</span>
              <span className="text-cyan-300 text-xs font-semibold flex items-center gap-1">
                <ShieldCheck size={13} />
                {isSuperadmin ? 'Root Multi-Tenant Vault' : 'Allocated Gateway Partition'}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              {isSuperadmin
                ? 'System Engine & Multi-Tenant API Gateway Vault'
                : `${user?.company_name || 'Company'} Gateway & API Settings`}
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {isSuperadmin
                ? 'Manage company-partitioned WhatsApp WABA, AWS SES, Resend 3rd-party API & Multi-SMTP credentials, review templates via instant toggle, and inspect telemetry.'
                : 'Inspect your organization\'s allocated WhatsApp Cloud API phone numbers, AWS SES quotas, Resend keys, SMTP relays, and verify template approval parameters.'}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div
              className={`px-3.5 py-2 rounded-2xl bg-[#050811] border text-xs font-mono font-bold flex items-center gap-2 shadow-inner ${
                isSuperadmin ? 'border-amber-500/30 text-amber-300' : 'border-cyan-500/30 text-cyan-300'
              }`}
            >
              {isSuperadmin ? <Crown size={15} className="text-amber-400" /> : <Building2 size={15} className="text-cyan-400" />}
              <span>{user?.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Cybernetic Vault Navigation Tabs */}
      <div className="flex items-center space-x-3 border-b border-slate-800/80 pb-2 overflow-x-auto">
        {[
          {
            id: 'gateways',
            label: isSuperadmin
              ? `Multi-Tenant API Keys & Gateways (${gateways.length})`
              : `Company API Gateways (${gateways.length})`,
            icon: Key,
          },
          ...(isSuperadmin
            ? [
                {
                  id: 'templates',
                  label: `Multi-Tenant Templates Vault (${templates.length})`,
                  icon: FileCode2,
                },
              ]
            : []),
          { id: 'engine', label: 'Engine & Live Telemetry', icon: Activity },
          ...(isSuperadmin ? [{ id: 'logs', label: `Security & Audit Stream (${auditLogs.length})`, icon: History }] : []),
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 border border-cyan-400/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#0c1322] border border-transparent'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MULTI-TENANT TEMPLATES VAULT (SUPERADMIN EXCLUSIVE)                */}
      {/* ========================================================================= */}
      {activeTab === 'templates' && isSuperadmin && (
        <div className="space-y-6">
          {/* Top Quick Stats Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0f172a] border border-slate-800/90 rounded-2xl p-4 shadow-md flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Templates</p>
                <p className="text-2xl font-extrabold text-white mt-0.5">{templates.length}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">Across all company partitions</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <FileCode2 size={22} />
              </div>
            </div>

            <div className="bg-[#0f172a] border border-slate-800/90 rounded-2xl p-4 shadow-md flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Meta WhatsApp</p>
                <p className="text-2xl font-extrabold text-emerald-400 mt-0.5">{whatsappTemplatesCount}</p>
                <p className="text-[10px] text-emerald-400/80 font-mono mt-0.5">{approvedMetaCount} Official Approved</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Smartphone size={22} />
              </div>
            </div>

            <div className="bg-[#0f172a] border border-slate-800/90 rounded-2xl p-4 shadow-md flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">AWS SES, Resend & Email</p>
                <p className="text-2xl font-extrabold text-blue-400 mt-0.5">{emailTemplatesCount}</p>
                <p className="text-[10px] text-blue-400/80 font-mono mt-0.5">DKIM, SPF & Resend Compliant</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <Mail size={22} />
              </div>
            </div>

            <div className="bg-[#0f172a] border border-slate-800/90 rounded-2xl p-4 shadow-md flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Company Partitions</p>
                <p className="text-2xl font-extrabold text-purple-400 mt-0.5">{companies.length || 1}</p>
                <p className="text-[10px] text-purple-400/80 font-mono mt-0.5">Database Connected</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Building2 size={22} />
              </div>
            </div>
          </div>

          {/* DEDICATED CHANNEL TOGGLE SWITCH (WhatsApp Meta <---> Email SES/Resend/SMTP) */}
          <div className="flex flex-col items-center space-y-2 py-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sliders size={13} className="text-cyan-400" />
              <span>Channel Template Selector</span>
            </div>

            <div className="flex items-center justify-center p-1.5 bg-[#050811] border border-cyan-500/30 rounded-2xl shadow-xl w-full max-w-2xl mx-auto">
              <button
                type="button"
                onClick={() => setTemplateChannelToggle('whatsapp')}
                className={`flex-1 py-3 px-5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2.5 transition-all duration-300 cursor-pointer ${
                  templateChannelToggle === 'whatsapp'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 border border-emerald-400/50 scale-[1.02]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Smartphone size={18} className={templateChannelToggle === 'whatsapp' ? 'text-white' : 'text-emerald-400'} />
                <span>WhatsApp Meta Cloud Templates ({whatsappTemplatesCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setTemplateChannelToggle('email')}
                className={`flex-1 py-3 px-5 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2.5 transition-all duration-300 cursor-pointer ${
                  templateChannelToggle === 'email'
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-blue-500/30 border border-blue-400/50 scale-[1.02]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Mail size={18} className={templateChannelToggle === 'email' ? 'text-white' : 'text-blue-400'} />
                <span>AWS SES, Resend & SMTP Email ({emailTemplatesCount})</span>
              </button>
            </div>
          </div>

          {/* Controls Bar: Search, Company Partition Selector, Status Filters, Action Buttons */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
              {/* Search Bar */}
              <div className="relative w-full lg:w-80">
                <Search size={15} className="absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="text"
                  value={templateSearchQuery}
                  onChange={(e) => setTemplateSearchQuery(e.target.value)}
                  placeholder={`Search ${templateChannelToggle === 'whatsapp' ? 'Meta' : 'Email'} templates...`}
                  className="w-full pl-10 pr-4 py-2.5 bg-[#070b14] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-medium"
                />
              </div>

              {/* Company Partition Dropdown & Status Filter Pills */}
              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                {/* Database-Driven Company Filter - Only for Superadmin */}
                {isSuperadmin && (
                  <div className="flex items-center gap-2">
                    <Building2 size={15} className="text-cyan-400 shrink-0" />
                    <select
                      value={templateCompanyFilter}
                      onChange={(e) => setTemplateCompanyFilter(e.target.value)}
                      className="px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-cyan-500"
                    >
                      <option value="all">🏢 All Companies (Global Partition)</option>
                      {companies.map((c) => (
                        <option key={c} value={c}>
                          🏢 {c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Status Filter Dropdown */}
                <select
                  value={templateStatusFilter}
                  onChange={(e) => setTemplateStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-xs text-white font-semibold focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">⚡ All Statuses</option>
                  <option value="APPROVED">✓ Approved / Active</option>
                  <option value="PENDING">⏳ Pending Review</option>
                  <option value="REJECTED">✕ Rejected</option>
                </select>
              </div>

              {/* Action Buttons: Sync Meta + Create Template */}
              <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end">
                {templateChannelToggle === 'whatsapp' && (
                  <button
                    type="button"
                    onClick={handleSyncMetaTemplates}
                    disabled={isSyncingMeta}
                    className="px-4 py-2.5 rounded-xl bg-[#070b14] hover:bg-slate-800 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-md transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
                    title="Synchronize templates from Meta Graph API"
                  >
                    <RefreshCw size={14} className={isSyncingMeta ? 'animate-spin text-emerald-400' : ''} />
                    <span>{isSyncingMeta ? 'Syncing WABA...' : 'Sync Meta WABA'}</span>
                  </button>
                )}

                {selectedSuperadminTemplateIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkDeleteTemplates}
                    disabled={isDeletingSuperadminTemplates}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/25 flex items-center gap-1.5 transition-all cursor-pointer animate-fadeIn"
                  >
                    <Trash2 size={14} />
                    <span>Delete ({selectedSuperadminTemplateIds.length}) Selected</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setNewTmplChannel(templateChannelToggle);
                    setShowCreateTemplateModal(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-500/25 flex items-center gap-2 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <PlusCircle size={15} />
                  <span>Create {templateChannelToggle === 'whatsapp' ? 'Meta' : 'Email'} Template</span>
                </button>
              </div>
            </div>

            {/* Sync Feedback Toast */}
            {syncMetaFeedback && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 size={15} />
                <span>{syncMetaFeedback}</span>
              </div>
            )}
          </div>

          {/* TEMPLATES CARDS GRID */}
          <div className="space-y-4">
            {filteredTemplates.length === 0 ? (
              <div className="p-16 text-center text-slate-500 bg-[#0f172a] border border-slate-800 rounded-3xl space-y-3">
                <FileCode2 size={48} className="mx-auto opacity-30 text-cyan-400" />
                <p className="text-base font-bold text-slate-300">
                  No {templateChannelToggle === 'whatsapp' ? 'WhatsApp Meta' : 'Email SES/Resend'} templates match your criteria.
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Switch company filter above or click "Create Template" to add templates for this channel.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-2.5 bg-[#0f172a] border border-slate-800 rounded-xl text-xs">
                  <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filteredTemplates.length > 0 && selectedSuperadminTemplateIds.length === filteredTemplates.length}
                      onChange={handleSelectAllTemplates}
                      className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>Select All ({filteredTemplates.length})</span>
                  </label>
                  {selectedSuperadminTemplateIds.length > 0 && (
                    <span className="text-cyan-400 font-bold">
                      {selectedSuperadminTemplateIds.length} template(s) selected
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredTemplates.map((tmpl) => {
                    const isWhatsApp = tmpl.channel === 'whatsapp';
                    const isApproved = tmpl.meta_status === 'APPROVED' || tmpl.meta_status === 'Active';
                    const isPending = tmpl.meta_status === 'PENDING';
                    const isRejected = tmpl.meta_status === 'REJECTED';

                    return (
                      <div
                        key={tmpl.id}
                        className="bg-[#0f172a] border border-slate-800 hover:border-cyan-500/40 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4 transition-all hover:translate-y-[-2px]"
                      >
                        <div className="space-y-3.5">
                          {/* Top Badges */}
                          <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <input
                                type="checkbox"
                                checked={selectedSuperadminTemplateIds.includes(tmpl.id)}
                                onChange={() => handleToggleSelectTemplate(tmpl.id)}
                                className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer mr-1"
                              />
                              {isWhatsApp ? (
                                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  {tmpl.category || 'MARKETING'}
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">
                                  HTML TEMPLATE
                                </span>
                              )}

                            {isWhatsApp && tmpl.meta_language && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-800/80 border border-slate-700">
                                {tmpl.meta_language}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isApproved && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span>{isWhatsApp ? 'APPROVED' : 'Verified'}</span>
                              </span>
                            )}
                            {isPending && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                <Clock size={11} className="text-amber-400" />
                                <span>IN REVIEW</span>
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                                <AlertCircle size={11} />
                                <span>REJECTED</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Template Name & Company Partition */}
                        <div>
                          <h3 className="font-extrabold text-sm text-white leading-snug">
                            {tmpl.name}
                          </h3>

                          <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-semibold mt-1">
                            <Building2 size={12} className="text-cyan-400 shrink-0" />
                            <span>{tmpl.company_name || 'OmniReach Global'}</span>
                          </div>
                        </div>

                        {/* Subject (for Email) or Header (for WhatsApp) */}
                        {isWhatsApp && tmpl.header_type && tmpl.header_type !== 'NONE' && (
                          <div className="px-2.5 py-1 rounded-lg bg-[#070b14] border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                            <span className="text-slate-500">Header:</span>
                            <span className="text-slate-200 font-bold">{tmpl.header_type}</span>
                            {tmpl.header_content && <span className="truncate max-w-[140px]">({tmpl.header_content})</span>}
                          </div>
                        )}

                        {!isWhatsApp && tmpl.email_subject && (
                          <div className="p-2 rounded-xl bg-[#070b14] border border-slate-800 text-xs">
                            <span className="text-slate-500 text-[10px] font-semibold block uppercase">Subject:</span>
                            <span className="font-bold text-blue-400 line-clamp-1">{tmpl.email_subject}</span>
                          </div>
                        )}

                        {/* Body Message Snippet */}
                        <div className="p-3.5 bg-[#070b14] border border-slate-800/90 rounded-2xl text-xs text-slate-300 font-sans leading-relaxed max-h-36 overflow-y-auto whitespace-pre-wrap">
                          {renderFormattedBody(tmpl.body_content || tmpl.email_html || '')}
                        </div>

                        {isWhatsApp && tmpl.footer_content && (
                          <div className="text-[11px] text-slate-500 italic px-1 truncate">
                            Footer: {tmpl.footer_content}
                          </div>
                        )}
                      </div>

                      {/* Card Footer */}
                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-[10px] font-mono text-slate-500">
                          {new Date(tmpl.created_at).toLocaleDateString()}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewModalTemplate(tmpl)}
                            className="px-2.5 py-1 rounded-lg bg-[#070b14] hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="Open Interactive Simulator Preview"
                          >
                            <Eye size={12} />
                            <span>Preview</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyTemplateContent(tmpl.id, tmpl.body_content || tmpl.email_html || '')}
                            className="p-1.5 rounded-lg bg-[#070b14] hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[11px] transition-colors cursor-pointer"
                            title="Copy Template Content"
                          >
                            {copiedTemplateId === tmpl.id ? (
                              <Check size={13} className="text-emerald-400" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(tmpl.id, tmpl.name)}
                            className="p-1.5 rounded-lg bg-[#070b14] hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 border border-slate-800 text-[11px] transition-colors cursor-pointer"
                            title="Delete Template"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MULTI-TENANT GATEWAY & API KEYS HUB (META, SES, RESEND, SMTP)      */}
      {/* ========================================================================= */}
      {activeTab === 'gateways' && (
        <div className="space-y-6">
          {/* Controls Filter Bar */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
            {isSuperadmin ? (
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <Building2 size={15} className="text-cyan-400" />
                  <span>Filter by Company Partition:</span>
                </div>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500 font-semibold"
                >
                  <option value="all">🏢 All Companies (Global View)</option>
                  {companies.map((c) => (
                    <option key={c} value={c}>
                      🏢 {c}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-300 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Active Tenant Partition: <strong className="text-cyan-300 font-bold">{user?.company_name || 'Acme Enterprise'}</strong></span>
              </div>
            )}

            <div className="flex items-center gap-3">
              {isSuperadmin && selectedGatewayIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleBulkDeleteGateways}
                  disabled={isDeletingGateways}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/25 flex items-center gap-1.5 transition-all cursor-pointer animate-fadeIn"
                >
                  <Trash2 size={14} />
                  <span>Delete ({selectedGatewayIds.length}) Selected</span>
                </button>
              )}
              {isSuperadmin && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <PlusCircle size={15} />
                  <span>Allocate New Company Gateway</span>
                </button>
              )}
              <button
                type="button"
                onClick={fetchGateways}
                className="p-2 rounded-xl bg-[#070b14] border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
                title="Refresh Gateways"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Gateways Grid */}
          <div className="space-y-6">
            {isSuperadmin && gateways.length > 0 && (
              <div className="flex items-center justify-between p-2.5 bg-[#0f172a] border border-slate-800 rounded-xl text-xs">
                <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedGatewayIds.length === gateways.length}
                    onChange={handleSelectAllGateways}
                    className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Select All ({gateways.length})</span>
                </label>
                {selectedGatewayIds.length > 0 && (
                  <span className="text-cyan-400 font-bold">
                    {selectedGatewayIds.length} gateway(s) selected
                  </span>
                )}
              </div>
            )}

            {gateways.length === 0 ? (
              <div className="p-12 text-center text-slate-500 bg-[#0f172a] border border-slate-800 rounded-3xl">
                <Key size={40} className="mx-auto mb-3 opacity-40 text-cyan-400" />
                <p className="text-sm font-semibold text-slate-400">No gateways configured yet.</p>
                <p className="text-xs text-slate-500 mt-1">Click "Allocate New Company Gateway" above to add your WhatsApp WABA, AWS SES, Resend API, or SMTP credentials.</p>
              </div>
            ) : (
              gateways.map((gw) => {
                const creds = editingCreds[gw.id] || gw.credentials || {};
                const isSaving = savingGatewayId === gw.id;
                const isTesting = testingGatewayId === gw.id;
                const testResult = testResults[gw.id];
                const saveSuccess = saveSuccessMap[gw.id];

                return (
                  <div
                    key={gw.id}
                    className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 hover:border-slate-700 transition-all"
                  >
                    {/* Gateway Card Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                      <div className="flex items-center space-x-3">
                        {isSuperadmin && (
                          <input
                            type="checkbox"
                            checked={selectedGatewayIds.includes(gw.id)}
                            onChange={() => handleToggleSelectGateway(gw.id)}
                            className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer mr-1"
                          />
                        )}
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold border ${
                            gw.type.includes('whatsapp')
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : gw.type === 'email_resend'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                              : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          }`}
                        >
                          {gw.type.includes('whatsapp') ? (
                            <Smartphone size={20} />
                          ) : gw.type === 'email_resend' ? (
                            <Zap size={20} />
                          ) : (
                            <Mail size={20} />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-sm text-white">{gw.name}</h3>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                              <Building2 size={11} />
                              <span>{gw.company_name}</span>
                            </span>
                            {gw.type === 'email_resend' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500/15 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                <Zap size={11} />
                                Resend API
                              </span>
                            )}
                            {gw.is_default && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/40">
                                DEFAULT
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                            <span>Type: <strong className="text-slate-200">{gw.type}</strong></span>
                            <span>•</span>
                            <span>Live Meta Quality:</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              gw.quality_rating === 'GREEN'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : gw.quality_rating === 'YELLOW'
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : gw.quality_rating === 'RED'
                                ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}>
                              {gw.quality_rating || 'GREEN'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Header Actions */}
                      <div className="flex items-center gap-2.5">
                        {gw.type === 'whatsapp_meta' && (
                          <button
                            type="button"
                            onClick={() => handleFetchContactsForGateway(gw)}
                            disabled={fetchingContactsGwId === gw.id}
                            className="px-3.5 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                            title="Fetch and sync connected contacts from Meta Cloud API"
                          >
                            <RefreshCw size={12} className={fetchingContactsGwId === gw.id ? 'animate-spin text-purple-400' : ''} />
                            <span>{fetchingContactsGwId === gw.id ? 'Fetching...' : 'Fetch Meta Contacts'}</span>
                          </button>
                        )}

                        {gw.type === 'whatsapp_baileys' && (
                          <button
                            type="button"
                            onClick={() => setBaileysModalGw(gw)}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                            title="Open WhatsApp Web QR Scanner & Pairing Code"
                          >
                            <QrCode size={13} />
                            <span>Scan QR Code / Pair Device</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleTestGateway(gw)}
                          disabled={isTesting}
                          className="px-3.5 py-1.5 rounded-xl bg-[#070b14] hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <Play size={12} className={isTesting ? 'animate-spin' : ''} />
                          <span>{isTesting ? 'Testing...' : 'Live Test Connection'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSaveGateway(gw)}
                          disabled={isSaving}
                          className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <Save size={13} />
                          <span>{isSaving ? 'Saving...' : 'Save to PostgreSQL'}</span>
                        </button>

                        {isSuperadmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteGateway(gw.id, gw.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Delete Gateway (Superadmin Only)"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Contact Sync Feedback Alert */}
                    {gwFetchFeedbackMap[gw.id] && (
                      <div
                        className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2 animate-fadeIn ${
                          gwFetchFeedbackMap[gw.id].success
                            ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                            : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                        }`}
                      >
                        {gwFetchFeedbackMap[gw.id].success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        <span className="font-bold">{gwFetchFeedbackMap[gw.id].message}</span>
                      </div>
                    )}

                    {/* Test Result Alert Banner */}
                    {testResult && (
                      <div
                        className={`p-4 rounded-2xl border text-xs space-y-2 max-w-full overflow-hidden ${
                          testResult.success
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-bold">
                            {testResult.success ? <CheckCircle2 size={16} className="shrink-0 text-emerald-400" /> : <AlertCircle size={16} className="shrink-0 text-rose-400" />}
                            <span>{testResult.message}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {gw.type === 'whatsapp_baileys' && (
                              <button
                                type="button"
                                onClick={() => setBaileysModalGw(gw)}
                                className="px-3 py-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-all cursor-pointer"
                              >
                                <QrCode size={12} />
                                <span>{testResult.success ? 'Manage Linked Device' : 'Scan QR Code Now'}</span>
                              </button>
                            )}
                            {testResult.success && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black tracking-wider uppercase">
                                Verified Active
                              </span>
                            )}
                          </div>
                        </div>

                        {testResult.details && typeof testResult.details === 'object' && (
                          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-500/20 text-[11px]">
                            {testResult.details.display_phone_number && (
                              <span className="px-2 py-0.5 rounded bg-black/40 border border-emerald-500/30 font-mono">
                                📱 {testResult.details.display_phone_number}
                              </span>
                            )}
                            {testResult.details.verified_name && (
                              <span className="px-2 py-0.5 rounded bg-black/40 border border-emerald-500/30">
                                🏢 {testResult.details.verified_name}
                              </span>
                            )}
                            {testResult.details.quality_rating && (
                              <span className="px-2 py-0.5 rounded bg-black/40 border border-emerald-500/30 font-bold">
                                🛡️ Quality: {testResult.details.quality_rating}
                              </span>
                            )}
                            {testResult.details.messaging_tier && (
                              <span className="px-2 py-0.5 rounded bg-black/40 border border-emerald-500/30">
                                ⚡ Limit: {testResult.details.messaging_tier}
                              </span>
                            )}
                            {testResult.details.total_phone_numbers && (
                              <span className="px-2 py-0.5 rounded bg-black/40 border border-emerald-500/30">
                                🔢 Connected Lines: {testResult.details.total_phone_numbers}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Save Confirmation Toast */}
                    {saveSuccess && (
                      <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                        <CheckCircle2 size={15} />
                        <span>{saveSuccess}</span>
                      </div>
                    )}

                      {/* Credentials Editor Fields (WhatsApp Meta) */}
                      {gw.type === 'whatsapp_meta' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                            <div>
                              <label className="block text-slate-400 font-semibold mb-1">Business Account ID (Meta)</label>
                              <input
                                type="text"
                                value={creds.business_id || ''}
                                onChange={(e) => handleCredChange(gw.id, 'business_id', e.target.value)}
                                placeholder="e.g. 1520717..."
                                className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-slate-400 font-semibold mb-1">WABA Account ID</label>
                              <input
                                type="text"
                                value={creds.waba_id || ''}
                                onChange={(e) => handleCredChange(gw.id, 'waba_id', e.target.value)}
                                placeholder="e.g. 89123471923841"
                                className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-slate-400 font-semibold mb-1">Active Phone Number ID</label>
                              <input
                                type="text"
                                value={creds.phone_number_id || ''}
                                onChange={(e) => handleCredChange(gw.id, 'phone_number_id', e.target.value)}
                                placeholder="e.g. 106728392019283"
                                className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div>
                              <label className="block text-slate-400 font-semibold mb-1">Active Display Number</label>
                              <input
                                type="text"
                                value={creds.display_phone_number || ''}
                                onChange={(e) => handleCredChange(gw.id, 'display_phone_number', e.target.value)}
                                placeholder="e.g. +1 555 123 4567"
                                className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <div className="lg:col-span-2">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-slate-400 font-semibold">
                                  System User Permanent Access Token
                                </label>
                                <button
                                  type="button"
                                  onClick={() => toggleSecretVisibility(`token_${gw.id}`)}
                                  className="text-slate-500 hover:text-cyan-400 text-[11px] flex items-center gap-1 cursor-pointer"
                                >
                                  {visibleSecrets[`token_${gw.id}`] ? <EyeOff size={12} /> : <Eye size={12} />}
                                  <span>{visibleSecrets[`token_${gw.id}`] ? 'Hide' : 'Reveal Token'}</span>
                                </button>
                              </div>
                              <div className="relative">
                                <input
                                  type={visibleSecrets[`token_${gw.id}`] ? 'text' : 'password'}
                                  value={creds.system_user_token || ''}
                                  onChange={(e) => handleCredChange(gw.id, 'system_user_token', e.target.value)}
                                  placeholder="EAAG...Permanent Graph Token"
                                  className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500 text-[11px]"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-slate-400 font-semibold mb-1">Verified Business Name</label>
                              <input
                                type="text"
                                value={creds.verified_name || ''}
                                onChange={(e) => handleCredChange(gw.id, 'verified_name', e.target.value)}
                                placeholder="e.g. Acme Enterprise"
                                className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500"
                              />
                            </div>
                          </div>

                          {/* Connected Meta WhatsApp Phone Numbers Table (Screenshot 1 Match) */}
                          <div className="p-4 bg-[#070b14] border border-slate-800 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Smartphone size={15} className="text-emerald-400" />
                                <h4 className="text-xs font-bold text-white">Connected WhatsApp Manager Phone Numbers</h4>
                                <span className="text-[10px] text-slate-400">
                                  ({(creds.phone_numbers && creds.phone_numbers.length > 0 ? creds.phone_numbers.length : (creds.display_phone_number ? 1 : 0))} sender line(s) connected)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleFetchContactsForGateway(gw)}
                                disabled={fetchingContactsGwId === gw.id}
                                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                              >
                                <RefreshCw size={11} className={fetchingContactsGwId === gw.id ? 'animate-spin' : ''} />
                                <span>{fetchingContactsGwId === gw.id ? 'Refreshing...' : 'Refresh from Meta'}</span>
                              </button>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-[#0c1322] text-slate-400 border-b border-slate-800/80 text-[11px]">
                                  <tr>
                                    <th className="p-2.5 font-semibold">Phone number</th>
                                    <th className="p-2.5 font-semibold">Name (Visible to customers)</th>
                                    <th className="p-2.5 font-semibold">Status</th>
                                    <th className="p-2.5 font-semibold">Quality</th>
                                    <th className="p-2.5 font-semibold font-mono">Phone Number ID</th>
                                    <th className="p-2.5 font-semibold text-right">Channel Role</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                  {(() => {
                                    const senderList = (creds.phone_numbers && creds.phone_numbers.length > 0)
                                      ? creds.phone_numbers
                                      : (creds.phone_number_id && creds.display_phone_number)
                                      ? [{
                                          id: creds.phone_number_id,
                                          display_phone_number: creds.display_phone_number,
                                          verified_name: creds.verified_name || 'Primary Sender',
                                          status: creds.status || 'Connected',
                                          quality_rating: creds.quality_rating || 'GREEN',
                                          country: 'Connected',
                                        }]
                                      : [];

                                    if (senderList.length === 0) {
                                      return (
                                        <tr>
                                          <td colSpan={6} className="p-4 text-center text-slate-500 text-xs">
                                            No WhatsApp sender numbers connected. Enter your System User Permanent Token above and click &quot;Discover &amp; Traverse Meta Cloud API&quot; or save gateway.
                                          </td>
                                        </tr>
                                      );
                                    }

                                    return senderList.map((pn: any, pIdx: number) => {
                                      const isSelectedPrimary = (creds.phone_number_id === pn.id) || (!creds.phone_number_id && pIdx === 0);
                                      return (
                                        <tr key={pn.id || pIdx} className={`hover:bg-[#0c1322]/50 ${isSelectedPrimary ? 'bg-emerald-500/5' : ''}`}>
                                          <td className="p-2.5 font-mono font-bold text-white flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-[10px]">
                                              <Smartphone size={12} />
                                            </div>
                                            <div>
                                              <div>{pn.display_phone_number}</div>
                                              <div className="text-[10px] text-slate-500 font-sans">{pn.country || 'India'}</div>
                                            </div>
                                          </td>
                                          <td className="p-2.5">
                                            <div className="font-bold text-slate-200">{pn.verified_name}</div>
                                            <div className="text-[10px] text-slate-500">Name visible to customers</div>
                                          </td>
                                          <td className="p-2.5">
                                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 w-fit ${
                                              pn.status?.toLowerCase().includes('flag') || pn.status?.toLowerCase().includes('spam')
                                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                                : pn.status?.toLowerCase().includes('restrict')
                                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                                                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                                            }`}>
                                              <span className={`w-1.5 h-1.5 rounded-full ${
                                                pn.status?.toLowerCase().includes('flag')
                                                  ? 'bg-amber-400'
                                                  : pn.status?.toLowerCase().includes('restrict')
                                                  ? 'bg-rose-400'
                                                  : 'bg-emerald-400 animate-pulse'
                                              }`}></span>
                                              <span>{pn.status || 'Connected'}</span>
                                            </span>
                                          </td>
                                          <td className="p-2.5">
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border flex items-center gap-1.5 w-fit ${
                                              pn.quality_rating === 'GREEN'
                                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                                                : pn.quality_rating === 'YELLOW'
                                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                                : pn.quality_rating === 'RED'
                                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                                                : 'bg-slate-800 text-slate-400 border-slate-700'
                                            }`}>
                                              <span className={`w-1.5 h-1.5 rounded-full ${
                                                pn.quality_rating === 'GREEN'
                                                  ? 'bg-emerald-400'
                                                  : pn.quality_rating === 'YELLOW'
                                                  ? 'bg-amber-400'
                                                  : pn.quality_rating === 'RED'
                                                  ? 'bg-rose-400'
                                                  : 'bg-slate-400'
                                              }`}></span>
                                              <span>
                                                {pn.quality_rating === 'GREEN'
                                                  ? 'GREEN (High)'
                                                  : pn.quality_rating === 'YELLOW'
                                                  ? 'YELLOW (Medium)'
                                                  : pn.quality_rating === 'RED'
                                                  ? 'RED (Low Quality)'
                                                  : 'UNKNOWN'}
                                              </span>
                                            </span>
                                          </td>
                                          <td className="p-2.5 font-mono text-slate-400 text-[11px]">
                                            {pn.id}
                                          </td>
                                          <td className="p-2.5 text-right">
                                            {isSelectedPrimary ? (
                                              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                                                ✓ Default Sender
                                              </span>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  handleCredChange(gw.id, 'phone_number_id', pn.id);
                                                  handleCredChange(gw.id, 'display_phone_number', pn.display_phone_number);
                                                  handleCredChange(gw.id, 'verified_name', pn.verified_name);
                                                  handleCredChange(gw.id, 'quality_rating', pn.quality_rating || 'GREEN');
                                                }}
                                                className="px-2.5 py-1 rounded-lg bg-[#0c1322] hover:bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold cursor-pointer"
                                              >
                                                Set Default
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                    {/* Credentials & Management Fields (WhatsApp Baileys Web Socket) */}
                    {gw.type === 'whatsapp_baileys' && (
                      <div className="p-5 bg-[#070b14] border border-cyan-500/20 rounded-2xl space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                              <QrCode size={20} />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                                <span>WhatsApp Baileys Multi-Device Protocol</span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    gw.quality_rating === 'GREEN' || gw.status_details?.status === 'CONNECTED'
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  }`}
                                >
                                  {gw.quality_rating === 'GREEN' || gw.status_details?.status === 'CONNECTED'
                                    ? '● Connected & Active'
                                    : '○ Disconnected / Scan Required'}
                                </span>
                              </h4>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Direct WhatsApp Web connection. No Meta per-conversation charges. Full Journey Builder & Live Inbox support.
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setBaileysModalGw(gw)}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                          >
                            <QrCode size={14} />
                            <span>
                              {gw.status_details?.status === 'CONNECTED'
                                ? 'Manage Linked WhatsApp Device'
                                : 'Scan QR Code / Pair Device'}
                            </span>
                          </button>
                        </div>

                        {gw.status_details?.status === 'CONNECTED' ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
                            <div className="p-3 bg-[#0f172a] rounded-xl border border-slate-800">
                              <span className="text-slate-500 text-[10px] block">Connected Phone Number</span>
                              <span className="font-mono font-bold text-white text-sm">
                                +{gw.status_details?.phone || gw.credentials?.display_phone_number || 'Linked'}
                              </span>
                            </div>
                            <div className="p-3 bg-[#0f172a] rounded-xl border border-slate-800">
                              <span className="text-slate-500 text-[10px] block">Push Name</span>
                              <span className="font-semibold text-emerald-400">
                                {gw.status_details?.push_name || gw.credentials?.push_name || 'Enterprise WhatsApp'}
                              </span>
                            </div>
                            <div className="p-3 bg-[#0f172a] rounded-xl border border-slate-800">
                              <span className="text-slate-500 text-[10px] block">Call Management</span>
                              <span className="font-semibold text-cyan-400">
                                Auto-Decline Calls (Polite Notice)
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-cyan-950/30 border border-cyan-500/30 rounded-xl flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2.5 text-cyan-300">
                              <AlertCircle size={16} className="shrink-0 text-cyan-400" />
                              <span>Device not linked yet. Click the button to display live QR code or 8-digit phone pairing code.</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setBaileysModalGw(gw)}
                              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold shrink-0 transition-all cursor-pointer shadow"
                            >
                              Open QR Scanner Now
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Credentials Editor Fields (Resend 3rd-Party API) */}
                    {gw.type === 'email_resend' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                        <div className="lg:col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-slate-400 font-semibold">Resend API Key (Bearer Token)</label>
                            <button
                              type="button"
                              onClick={() => toggleSecretVisibility(`resend_key_${gw.id}`)}
                              className="text-slate-500 hover:text-purple-400 text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              {visibleSecrets[`resend_key_${gw.id}`] ? <EyeOff size={12} /> : <Eye size={12} />}
                              <span>{visibleSecrets[`resend_key_${gw.id}`] ? 'Hide' : 'Reveal Key'}</span>
                            </button>
                          </div>
                          <input
                            type={visibleSecrets[`resend_key_${gw.id}`] ? 'text' : 'password'}
                            value={creds.api_key || ''}
                            onChange={(e) => handleCredChange(gw.id, 'api_key', e.target.value)}
                            placeholder="re_123456789_abcdefghijklmnopqrstuvwxyz"
                            className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500 text-[11px]"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">From Sender Email</label>
                          <input
                            type="email"
                            value={creds.from_email || ''}
                            onChange={(e) => handleCredChange(gw.id, 'from_email', e.target.value)}
                            placeholder="onboarding@resend.dev or verified domain"
                            className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500 font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">From Sender Name</label>
                          <input
                            type="text"
                            value={creds.from_name || ''}
                            onChange={(e) => handleCredChange(gw.id, 'from_name', e.target.value)}
                            placeholder="e.g. Acme Enterprise"
                            className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Reply-To Email (Optional)</label>
                          <input
                            type="email"
                            value={creds.reply_to || ''}
                            onChange={(e) => handleCredChange(gw.id, 'reply_to', e.target.value)}
                            placeholder="support@company.com"
                            className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* Credentials Editor Fields (AWS SES) */}
                    {gw.type === 'email_ses' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">AWS Access Key ID</label>
                          <input
                            type="text"
                            value={creds.access_key_id || ''}
                            onChange={(e) => handleCredChange(gw.id, 'access_key_id', e.target.value)}
                            placeholder="AKIA..."
                            className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-slate-400 font-semibold">AWS Secret Access Key</label>
                            <button
                              type="button"
                              onClick={() => toggleSecretVisibility(`secret_${gw.id}`)}
                              className="text-slate-500 hover:text-blue-400 text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              {visibleSecrets[`secret_${gw.id}`] ? <EyeOff size={12} /> : <Eye size={12} />}
                              <span>{visibleSecrets[`secret_${gw.id}`] ? 'Hide' : 'Reveal'}</span>
                            </button>
                          </div>
                          <input
                            type={visibleSecrets[`secret_${gw.id}`] ? 'text' : 'password'}
                            value={creds.secret_access_key || ''}
                            onChange={(e) => handleCredChange(gw.id, 'secret_access_key', e.target.value)}
                            placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                            className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500 text-[11px]"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">AWS Region</label>
                          <select
                            value={creds.region || 'ap-south-1'}
                            onChange={(e) => handleCredChange(gw.id, 'region', e.target.value)}
                            className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                          >
                            <option value="ap-south-1">Asia Pacific (Mumbai) • ap-south-1</option>
                            <option value="us-east-1">US East (N. Virginia) • us-east-1</option>
                            <option value="us-west-2">US West (Oregon) • us-west-2</option>
                            <option value="eu-west-1">Europe (Ireland) • eu-west-1</option>
                            <option value="ap-southeast-1">Asia Pacific (Singapore) • ap-southeast-1</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">From Sender Email</label>
                          <input
                            type="email"
                            value={creds.from_email || ''}
                            onChange={(e) => handleCredChange(gw.id, 'from_email', e.target.value)}
                            placeholder="broadcasts@company.com"
                            className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">From Sender Name</label>
                          <input
                            type="text"
                            value={creds.from_name || ''}
                            onChange={(e) => handleCredChange(gw.id, 'from_name', e.target.value)}
                            placeholder="e.g. Acme Notifications"
                            className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">Configuration Set</label>
                          <input
                            type="text"
                            value={creds.configuration_set || ''}
                            onChange={(e) => handleCredChange(gw.id, 'configuration_set', e.target.value)}
                            placeholder="e.g. OmniReach-Config"
                            className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    )}

                    {/* Credentials Editor Fields (SMTP) */}
                    {gw.type === 'email_smtp' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">SMTP Host Server</label>
                          <input
                            type="text"
                            value={creds.host || ''}
                            onChange={(e) => handleCredChange(gw.id, 'host', e.target.value)}
                            placeholder="smtp.gmail.com"
                            className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">SMTP Port</label>
                          <input
                            type="number"
                            value={creds.port || 587}
                            onChange={(e) => handleCredChange(gw.id, 'port', parseInt(e.target.value))}
                            placeholder="587"
                            className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">SMTP Username</label>
                          <input
                            type="text"
                            value={creds.user || ''}
                            onChange={(e) => handleCredChange(gw.id, 'user', e.target.value)}
                            placeholder="user@company.com"
                            className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-slate-400 font-semibold">SMTP Password</label>
                            <button
                              type="button"
                              onClick={() => toggleSecretVisibility(`pass_${gw.id}`)}
                              className="text-slate-500 hover:text-indigo-400 text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              {visibleSecrets[`pass_${gw.id}`] ? <EyeOff size={12} /> : <Eye size={12} />}
                              <span>{visibleSecrets[`pass_${gw.id}`] ? 'Hide' : 'Reveal'}</span>
                            </button>
                          </div>
                          <input
                            type={visibleSecrets[`pass_${gw.id}`] ? 'text' : 'password'}
                            value={creds.pass || ''}
                            onChange={(e) => handleCredChange(gw.id, 'pass', e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">From Sender Email</label>
                          <input
                            type="email"
                            value={creds.from_email || ''}
                            onChange={(e) => handleCredChange(gw.id, 'from_email', e.target.value)}
                            placeholder="support@company.com"
                            className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 font-semibold mb-1">From Sender Name</label>
                          <input
                            type="text"
                            value={creds.from_name || ''}
                            onChange={(e) => handleCredChange(gw.id, 'from_name', e.target.value)}
                            placeholder="e.g. Support Team"
                            className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ENGINE & LIVE SYNC DIAGNOSTICS                                     */}
      {/* ========================================================================= */}
      {activeTab === 'engine' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: 5s Poller Worker */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center font-bold">
                  <Radio size={20} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Autonomous Dispatch Poller</h3>
                  <p className="text-xs text-slate-400">5-Second Precision Interval Runner</p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>Active (5s Poller)</span>
              </span>
            </div>

            <div className="space-y-2.5 pt-2 text-xs text-slate-400">
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-500">Poller Interval:</span>
                <span className="font-semibold text-slate-200 font-mono">5,000 ms</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-500">WebSocket Sync Stream:</span>
                <span className="font-semibold text-emerald-400 font-mono">
                  {isConnected ? 'Broadcasting (Connected)' : 'Reconnecting...'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-500">Duplicate Cooldown Guard:</span>
                <span className="font-semibold text-cyan-300 font-mono">1-Hour Window Active</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Opt-out Regulatory Filter:</span>
                <span className="font-semibold text-purple-300 font-mono">100% Automated</span>
              </div>
            </div>
          </div>

          {/* Card 2: Database Connection */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">PostgreSQL 18 Engine</h3>
                  <p className="text-xs text-slate-400">Local pgAdmin 4 Cluster</p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-purple-500/15 text-purple-300 border border-purple-500/40 rounded-full text-xs font-mono font-bold">
                PostgreSQL 18
              </span>
            </div>

            <div className="space-y-2.5 pt-2 text-xs text-slate-400">
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-500">Database Name:</span>
                <span className="font-semibold text-slate-200 font-mono">BroadcastEngine</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-500">Host & Port:</span>
                <span className="font-semibold text-slate-200 font-mono">localhost:5432</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-500">Superuser Account:</span>
                <span className="font-semibold text-slate-200 font-mono">postgres</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Multi-Tenant Partitioning:</span>
                <span className="font-semibold text-cyan-300 font-mono">Company Scoped</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SECURITY AUDIT TRAIL                                              */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Security & Audit Event Stream</h3>
              <p className="text-xs text-slate-400">Immutable ledger of administrator actions, campaign dispatches, and gateway updates</p>
            </div>
            <button
              type="button"
              onClick={fetchAuditLogs}
              className="px-3 py-1.5 bg-[#050811] hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 flex items-center gap-1 shadow-sm cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Refresh Stream</span>
            </button>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">No audit events logged yet.</div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 bg-[#050811] border border-slate-800/90 rounded-2xl flex items-center justify-between text-xs hover:border-cyan-500/30 transition-all shadow-sm"
                >
                  <div>
                    <div className="font-semibold text-white flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded font-mono text-[10px]">
                        {log.action}
                      </span>
                      <span>by {log.user_name || log.user_email || 'Superadmin'}</span>
                      {log.company_name && (
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 text-[10px]">
                          {log.company_name}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">
                      Entity: {log.entity_type} {log.entity_id ? `(${log.entity_id})` : ''} • IP: {log.ip_address || '127.0.0.1'}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono shrink-0 ml-4">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: INTERACTIVE LIVE TEMPLATE PREVIEW                                */}
      {/* ========================================================================= */}
      {previewModalTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-2xl bg-[#0f172a] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-[#070b14] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {previewModalTemplate.channel === 'whatsapp' ? (
                  <Smartphone size={18} className="text-emerald-400" />
                ) : (
                  <Mail size={18} className="text-blue-400" />
                )}
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    {previewModalTemplate.name}
                  </h3>
                  <p className="text-[11px] text-cyan-300 font-mono">
                    Partition: {previewModalTemplate.company_name || 'OmniReach Global'} • Status: {previewModalTemplate.meta_status || 'Active'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalTemplate(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 flex items-center justify-center bg-[#070b14]">
              {previewModalTemplate.channel === 'whatsapp' ? (
                <WhatsAppPreview
                  headerType={previewModalTemplate.header_type}
                  headerContent={previewModalTemplate.header_content}
                  bodyContent={previewModalTemplate.body_content}
                  footerContent={previewModalTemplate.footer_content}
                  buttons={previewModalTemplate.buttons_json || []}
                />
              ) : (
                <EmailPreview
                  subject={previewModalTemplate.email_subject || 'Communication from OmniReach'}
                  htmlContent={previewModalTemplate.email_html || previewModalTemplate.body_content}
                />
              )}
            </div>

            <div className="px-6 py-3 bg-[#070b14] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Simulated preview with live variable substitution</span>
              <button
                type="button"
                onClick={() => setPreviewModalTemplate(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CREATE NEW TEMPLATE (WITH DATABASE-CONNECTED COMPANY DROPDOWN)   */}
      {/* ========================================================================= */}
      {showCreateTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-2xl bg-[#0f172a] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-[#070b14] border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode2 size={18} className="text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  Create {newTmplChannel === 'whatsapp' ? 'WhatsApp Meta Cloud' : 'Email (AWS SES / Resend / SMTP)'} Template
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateTemplateModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTemplateSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Template Display Name</label>
                  <input
                    type="text"
                    required
                    value={newTmplName}
                    onChange={(e) => setNewTmplName(e.target.value)}
                    placeholder="e.g. spring_flash_sale_announcement"
                    className="w-full px-3 py-2.5 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                {/* Database-Driven Assigned Company Dropdown */}
                <div>
                  <label className="text-slate-400 font-semibold flex items-center gap-1.5 mb-1">
                    <Building2 size={13} className="text-cyan-400" />
                    <span>Assigned Company Partition</span>
                  </label>

                  {isSuperadmin ? (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-500">Superadmin Multi-Tenant Selector</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomNewTmplCompany(!isCustomNewTmplCompany);
                            if (!isCustomNewTmplCompany) {
                              setNewTmplCompany('');
                            } else {
                              setNewTmplCompany(companies[0] || 'OmniReach Global');
                            }
                          }}
                          className="text-cyan-400 hover:text-cyan-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          {isCustomNewTmplCompany ? '← Pick from DB' : '+ New Partition'}
                        </button>
                      </div>

                      {!isCustomNewTmplCompany ? (
                        <select
                          value={newTmplCompany || (companies[0] || 'OmniReach Global')}
                          onChange={(e) => {
                            if (e.target.value === '__NEW_COMPANY__') {
                              setIsCustomNewTmplCompany(true);
                              setNewTmplCompany('');
                            } else {
                              setNewTmplCompany(e.target.value);
                            }
                          }}
                          className="w-full px-3 py-2.5 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 font-semibold"
                        >
                          <option value="OmniReach Global">🏢 OmniReach Global (Superadmin Partition)</option>
                          {companies
                            .filter((c) => c !== 'OmniReach Global')
                            .map((c) => (
                              <option key={c} value={c}>
                                🏢 {c} (Registered Database Partition)
                              </option>
                            ))}
                          <option value="__NEW_COMPANY__">✨ + Enter Custom / New Company Partition...</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          required
                          autoFocus
                          value={newTmplCompany}
                          onChange={(e) => setNewTmplCompany(e.target.value)}
                          placeholder="e.g. Acme Enterprise"
                          className="w-full px-3 py-2.5 bg-[#070b14] border border-cyan-500 rounded-xl text-white focus:outline-none ring-1 ring-cyan-500/30"
                        />
                      )}
                    </>
                  ) : (
                    <div className="w-full px-3.5 py-2.5 bg-[#070b14] border border-slate-800 rounded-xl text-cyan-300 font-semibold flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-cyan-400" />
                        <span>{user?.company_name || 'OmniReach Global'}</span>
                      </div>
                      <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full font-bold">
                        Your Organization Partition
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Channel Selector inside Create Modal */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setNewTmplChannel('whatsapp')}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs cursor-pointer ${
                    newTmplChannel === 'whatsapp'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md'
                      : 'bg-[#070b14] border-slate-800 text-slate-400'
                  }`}
                >
                  <Smartphone size={16} />
                  <span>WhatsApp Meta Template</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewTmplChannel('email')}
                  className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs cursor-pointer ${
                    newTmplChannel === 'email'
                      ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-md'
                      : 'bg-[#070b14] border-slate-800 text-slate-400'
                  }`}
                >
                  <Mail size={16} />
                  <span>Email (SES / Resend / SMTP)</span>
                </button>
              </div>

              {newTmplChannel === 'whatsapp' ? (
                <div className="space-y-3.5 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Category</label>
                      <select
                        value={newTmplCategory}
                        onChange={(e) => setNewTmplCategory(e.target.value as any)}
                        className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white"
                      >
                        <option value="MARKETING">MARKETING (Offers & Broadcasts)</option>
                        <option value="UTILITY">UTILITY (Alerts, Orders, Updates)</option>
                        <option value="AUTHENTICATION">AUTHENTICATION (OTP & Security)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Language</label>
                      <select
                        value={newTmplLanguage}
                        onChange={(e) => setNewTmplLanguage(e.target.value)}
                        className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white font-mono"
                      >
                        <option value="en_US">English (en_US)</option>
                        <option value="hi_IN">Hindi (hi_IN)</option>
                        <option value="es_ES">Spanish (es_ES)</option>
                        <option value="pt_BR">Portuguese (pt_BR)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Header Type (Optional)</label>
                    <select
                      value={newTmplHeaderType}
                      onChange={(e) => setNewTmplHeaderType(e.target.value)}
                      className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white"
                    >
                      <option value="NONE">None</option>
                      <option value="TEXT">Text Header</option>
                      <option value="IMAGE">Image Header (URL/Attachment)</option>
                      <option value="DOCUMENT">Document / PDF Attachment</option>
                    </select>
                  </div>

                  {newTmplHeaderType === 'TEXT' && (
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Header Text</label>
                      <input
                        type="text"
                        value={newTmplHeaderContent}
                        onChange={(e) => setNewTmplHeaderContent(e.target.value)}
                        placeholder="e.g. Exclusive Weekend Sale!"
                        className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white"
                      />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400 font-semibold">Message Body Content</label>
                      <span className="text-[10px] text-cyan-400 font-mono">Use {'{{1}}'}, {'{name}'}, {'{contact}'} for variables</span>
                    </div>
                    <textarea
                      required
                      rows={4}
                      value={newTmplBody}
                      onChange={(e) => setNewTmplBody(e.target.value)}
                      placeholder="Hi {{1}}, your personalized account update (Ref: {{2}}) is ready. Click below to view!"
                      className="w-full p-3 bg-[#070b14] border border-slate-800 rounded-xl text-white font-sans text-xs focus:outline-none focus:border-cyan-500"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Footer Text (Optional)</label>
                    <input
                      type="text"
                      value={newTmplFooter}
                      onChange={(e) => setNewTmplFooter(e.target.value)}
                      placeholder="e.g. Reply STOP to opt out"
                      className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 pt-2">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Email Subject Line</label>
                    <input
                      type="text"
                      required
                      value={newTmplEmailSubject}
                      onChange={(e) => setNewTmplEmailSubject(e.target.value)}
                      placeholder="e.g. Special Pre-Approved Offer for {name}!"
                      className="w-full px-3 py-2.5 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-blue-500 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400 font-semibold">HTML Email Content</label>
                      <span className="text-[10px] text-blue-400 font-mono">Supports HTML & {'{name}'} merge tags</span>
                    </div>
                    <textarea
                      required
                      rows={6}
                      value={newTmplEmailHtml}
                      onChange={(e) => setNewTmplEmailHtml(e.target.value)}
                      placeholder="<h2>Hello {name},</h2><p>Here are your account details for company <strong>{company}</strong>...</p>"
                      className="w-full p-3 bg-[#070b14] border border-slate-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                    ></textarea>
                  </div>
                </div>
              )}
              </div>

              <div className="px-6 py-3.5 bg-[#070b14] border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateTemplateModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#070b14] hover:bg-slate-800 text-slate-300 font-semibold cursor-pointer border border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTemplate}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold shadow-lg shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingTemplate ? 'Submitting to Meta/DB...' : 'Save & Register Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ALLOCATE NEW COMPANY GATEWAY (DATABASE-CONNECTED DROPDOWN)       */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-[#0f172a] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
            <div className="px-6 py-4 bg-[#070b14] border-b border-slate-800 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Key size={16} className="text-cyan-400" />
                  <span>Allocate Gateway & API Keys to Company</span>
                </h3>
                <p className="text-xs text-slate-400">Configure dedicated WhatsApp WABA, AWS SES, Resend 3rd-party API, or SMTP credentials for a client organization</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewGateway} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Gateway Display Name</label>
                  <input
                    type="text"
                    required
                    value={newGwName}
                    onChange={(e) => setNewGwName(e.target.value)}
                    placeholder="e.g. Resend Primary - Acme Broadcasts"
                    className="w-full px-3 py-2.5 bg-[#070b14] border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Database-Driven Assigned Company Dropdown */}
                <div>
                  <label className="text-slate-400 font-semibold flex items-center gap-1.5 mb-1">
                    <Building2 size={13} className="text-cyan-400" />
                    <span>Assigned Company (DB Partition)</span>
                  </label>

                  {isSuperadmin ? (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-500">Superadmin Multi-Tenant Selector</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomNewGwCompany(!isCustomNewGwCompany);
                            if (!isCustomNewGwCompany) {
                              setNewGwCompany('');
                            } else {
                              setNewGwCompany(companies[0] || 'OmniReach Global');
                            }
                          }}
                          className="text-cyan-400 hover:text-cyan-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          {isCustomNewGwCompany ? '← Pick from DB' : '+ New Partition'}
                        </button>
                      </div>

                      {!isCustomNewGwCompany ? (
                        <select
                          value={newGwCompany || (companies[0] || 'OmniReach Global')}
                          onChange={(e) => {
                            if (e.target.value === '__NEW_COMPANY__') {
                              setIsCustomNewGwCompany(true);
                              setNewGwCompany('');
                            } else {
                              setNewGwCompany(e.target.value);
                            }
                          }}
                          className="w-full px-3 py-2.5 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 font-semibold"
                        >
                          <option value="OmniReach Global">🏢 OmniReach Global (Superadmin Root Partition)</option>
                          {companies
                            .filter((c) => c !== 'OmniReach Global')
                            .map((c) => (
                              <option key={c} value={c}>
                                🏢 {c} (Registered Database Partition)
                              </option>
                            ))}
                          <option value="__NEW_COMPANY__">✨ + Enter Custom / New Company Partition...</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          required
                          autoFocus
                          value={newGwCompany}
                          onChange={(e) => setNewGwCompany(e.target.value)}
                          placeholder="Enter new company name (e.g. Acme Enterprise)"
                          className="w-full px-3 py-2.5 bg-[#070b14] border border-cyan-500 rounded-xl text-white placeholder-slate-500 focus:outline-none ring-1 ring-cyan-500/30"
                        />
                      )}
                    </>
                  ) : (
                    <div className="w-full px-3.5 py-2.5 bg-[#070b14] border border-slate-800 rounded-xl text-cyan-300 font-semibold flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 size={14} className="text-cyan-400" />
                        <span>{user?.company_name || 'OmniReach Global'}</span>
                      </div>
                      <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full font-bold">
                        Your Organization Partition
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Gateway Channel & Infrastructure</label>
                <select
                  value={newGwType}
                  onChange={(e) => setNewGwType(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 font-semibold"
                >
                  <option value="whatsapp_baileys">📱 WhatsApp Baileys (Direct Web Multi-Device QR / Pairing)</option>
                  <option value="whatsapp_meta">📱 Meta Cloud API (Official WhatsApp WABA)</option>
                  <option value="email_resend">⚡ Resend Third-Party API (Modern Developer Email Engine)</option>
                  <option value="email_ses">☁️ AWS Simple Email Service (SES High-Throughput)</option>
                  <option value="email_smtp">✉️ Multi-SMTP Failover Relay Pool</option>
                </select>
              </div>

              {/* Dynamic Credential Inputs for Add Modal */}
              {newGwType === 'whatsapp_baileys' && (
                <div className="space-y-4 p-5 bg-[#070b14] border border-cyan-500/40 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                      <QrCode size={16} className="text-cyan-400" />
                      <span>WhatsApp Baileys Multi-Device Pairing Setup</span>
                    </div>
                    <span className="text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full font-bold">
                      Direct Web Sockets
                    </span>
                  </div>

                  <div>
                    <label className="text-slate-300 font-bold block mb-1">Session Name / Description</label>
                    <input
                      type="text"
                      value={newGwCreds.session_name || ''}
                      onChange={(e) => setNewGwCreds({ ...newGwCreds, session_name: e.target.value })}
                      placeholder="e.g. Primary Marketing Line"
                      className="w-full px-3 py-2.5 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Preferred Linking Method Option */}
                  <div>
                    <label className="text-slate-300 font-bold block mb-1.5">Preferred Initial Linking Method</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewGwCreds({ ...newGwCreds, pairing_mode: 'qr' })}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          newGwCreds.pairing_mode !== 'phone'
                            ? 'bg-cyan-600/20 border-cyan-500 text-white shadow-sm'
                            : 'bg-[#0c1322] border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <QrCode size={14} className="text-cyan-400" />
                        <span>Scan QR Code</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewGwCreds({ ...newGwCreds, pairing_mode: 'phone' })}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          newGwCreds.pairing_mode === 'phone'
                            ? 'bg-cyan-600/20 border-cyan-500 text-white shadow-sm'
                            : 'bg-[#0c1322] border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Phone size={14} className="text-cyan-400" />
                        <span>Phone Number (Pairing Code)</span>
                      </button>
                    </div>
                  </div>

                  {newGwCreds.pairing_mode === 'phone' ? (
                    <div>
                      <label className="text-slate-300 font-bold block mb-1">
                        WhatsApp Phone Number (with Country Code)
                      </label>
                      <input
                        type="text"
                        value={newGwCreds.phone_number || ''}
                        onChange={(e) => setNewGwCreds({ ...newGwCreds, phone_number: e.target.value })}
                        placeholder="e.g. 919876543210 or 15551234567"
                        className="w-full px-3 py-2.5 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-cyan-500"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Digits only without '+' or spaces. An 8-character pairing code will be generated immediately upon allocation.
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-[11px] text-cyan-200 flex items-center gap-2">
                      <QrCode size={18} className="shrink-0 text-cyan-400" />
                      <span>
                        An instant, live WhatsApp Web QR code with auto-refresh will open automatically as soon as you click <strong>Allocate & Connect WhatsApp</strong> below.
                      </span>
                    </div>
                  )}

                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-[11px] text-slate-300 leading-relaxed">
                    ✨ <strong>Company Isolation:</strong> This Baileys session will be partitioned exclusively for <strong>{newGwCompany || 'the selected company'}</strong>. Broadcasts, journey flows, and live chat will operate through this number without Meta conversation costs.
                  </div>
                </div>
              )}

              {newGwType === 'whatsapp_meta' && (
                <div className="space-y-3.5 p-4 bg-[#070b14] border border-slate-800/90 rounded-2xl">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-300 font-bold flex items-center gap-1.5">
                        <Key size={13} className="text-emerald-400" />
                        <span>System User Permanent Access Token</span>
                      </label>
                      <span className="text-[10px] text-emerald-400 font-mono">Meta Graph API v21.0</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        required
                        value={newGwCreds.system_user_token || ''}
                        onChange={(e) => setNewGwCreds({ ...newGwCreds, system_user_token: e.target.value })}
                        placeholder="EAAG...Permanent System User Token"
                        className="flex-1 px-3 py-2.5 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleInspectMetaToken}
                        disabled={isInspectingMeta || !newGwCreds.system_user_token}
                        className="px-3.5 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shrink-0"
                      >
                        <Sparkles size={13} className={isInspectingMeta ? 'animate-spin text-emerald-400' : 'text-emerald-400'} />
                        <span>{isInspectingMeta ? 'Fetching...' : 'Inspect & Fetch Meta Numbers'}</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Paste the Meta System User Token. The system will automatically fetch all registered WhatsApp sender phone lines, verified names, and quality metrics directly from Meta WhatsApp Manager.
                    </p>
                  </div>

                  {metaInspectResult && (
                    <div
                      className={`p-3.5 rounded-2xl border text-xs space-y-3 animate-fadeIn ${
                        metaInspectResult.valid
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1.5">
                          {metaInspectResult.valid ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                          <span>{metaInspectResult.message}</span>
                        </span>
                        {metaInspectResult.quality_rating && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                            Quality: {metaInspectResult.quality_rating}
                          </span>
                        )}
                      </div>

                      {metaInspectResult.valid && metaInspectResult.phone_numbers && metaInspectResult.phone_numbers.length > 0 && (
                        <div className="space-y-2 pt-1 border-t border-emerald-500/20">
                          <div className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
                            <Smartphone size={13} className="text-emerald-400" />
                            <span>Connected Meta WhatsApp Sender Lines ({metaInspectResult.phone_numbers.length})</span>
                          </div>
                          
                          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#070b14]">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-[#0c1322] text-slate-400 border-b border-slate-800 text-[10px]">
                                <tr>
                                  <th className="p-2 font-semibold">Phone number</th>
                                  <th className="p-2 font-semibold">Name (Visible to customers)</th>
                                  <th className="p-2 font-semibold">Status</th>
                                  <th className="p-2 font-semibold">Quality</th>
                                  <th className="p-2 font-semibold text-right">Default</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60 text-[11px]">
                                {metaInspectResult.phone_numbers.map((pn: any, pIdx: number) => {
                                  const isSelected = (newGwCreds.phone_number_id === pn.id) || (!newGwCreds.phone_number_id && pIdx === 0);
                                  return (
                                    <tr key={pn.id || pIdx} className={`hover:bg-[#0c1322]/50 ${isSelected ? 'bg-emerald-500/10' : ''}`}>
                                      <td className="p-2 font-mono font-bold text-white flex items-center gap-1.5">
                                        <span>{pn.display_phone_number}</span>
                                        <span className="text-[9px] text-slate-500 font-sans">({pn.country || 'India'})</span>
                                      </td>
                                      <td className="p-2 font-bold text-slate-200">
                                        {pn.verified_name}
                                      </td>
                                      <td className="p-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                          pn.status?.toLowerCase().includes('flag') || pn.status?.toLowerCase().includes('spam')
                                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                            : pn.status?.toLowerCase().includes('restrict')
                                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                        }`}>
                                          {pn.status || 'Connected'}
                                        </span>
                                      </td>
                                      <td className="p-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold border ${
                                          pn.quality_rating === 'GREEN'
                                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                            : pn.quality_rating === 'YELLOW'
                                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                            : pn.quality_rating === 'RED'
                                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                            : 'bg-slate-800 text-slate-400 border-slate-700'
                                        }`}>
                                          {pn.quality_rating || 'GREEN'}
                                        </span>
                                      </td>
                                      <td className="p-2 text-right">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setNewGwCreds({
                                              ...newGwCreds,
                                              phone_number_id: pn.id,
                                              display_phone_number: pn.display_phone_number,
                                              verified_name: pn.verified_name,
                                            });
                                          }}
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                            isSelected
                                              ? 'bg-emerald-500 text-slate-950 font-extrabold'
                                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                          }`}
                                        >
                                          {isSelected ? '✓ Default' : 'Select'}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Business Account ID (Meta)</label>
                      <input
                        type="text"
                        value={newGwCreds.business_id || ''}
                        onChange={(e) => setNewGwCreds({ ...newGwCreds, business_id: e.target.value })}
                        placeholder="e.g. 1029384..."
                        className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">WABA Account ID</label>
                      <input
                        type="text"
                        value={newGwCreds.waba_id || ''}
                        onChange={(e) => setNewGwCreds({ ...newGwCreds, waba_id: e.target.value })}
                        placeholder="e.g. 8912347..."
                        className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Primary Phone Number ID</label>
                      <input
                        type="text"
                        value={newGwCreds.phone_number_id || ''}
                        onChange={(e) => setNewGwCreds({ ...newGwCreds, phone_number_id: e.target.value })}
                        placeholder="e.g. 1067283..."
                        className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Display Phone Number</label>
                      <input
                        type="text"
                        value={newGwCreds.display_phone_number || ''}
                        onChange={(e) => setNewGwCreds({ ...newGwCreds, display_phone_number: e.target.value })}
                        placeholder="e.g. +1 555 123 4567"
                        className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Verified Name</label>
                      <input
                        type="text"
                        value={newGwCreds.verified_name || ''}
                        onChange={(e) => setNewGwCreds({ ...newGwCreds, verified_name: e.target.value })}
                        placeholder="e.g. Acme Enterprise"
                        className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {newGwType === 'email_resend' && (
                <div className="space-y-3 p-4 bg-[#070b14] border border-slate-800/90 rounded-2xl">
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Resend API Key (Bearer Token)</label>
                    <input
                      type="password"
                      value={newGwCreds.api_key || ''}
                      onChange={(e) => setNewGwCreds({ ...newGwCreds, api_key: e.target.value })}
                      placeholder="re_123456789_abcdefghijklmnopqrstuvwxyz"
                      className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">From Sender Email</label>
                      <input
                        type="email"
                        value={newGwCreds.from_email || ''}
                        onChange={(e) => setNewGwCreds({ ...newGwCreds, from_email: e.target.value })}
                        placeholder="onboarding@resend.dev or verified domain"
                        className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">From Sender Name</label>
                      <input
                        type="text"
                        value={newGwCreds.from_name || ''}
                        onChange={(e) => setNewGwCreds({ ...newGwCreds, from_name: e.target.value })}
                        placeholder="e.g. Acme Enterprise"
                        className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">Reply-To Email (Optional)</label>
                    <input
                      type="email"
                      value={newGwCreds.reply_to || ''}
                      onChange={(e) => setNewGwCreds({ ...newGwCreds, reply_to: e.target.value })}
                      placeholder="support@company.com"
                      className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white"
                    />
                  </div>
                </div>
              )}

              {newGwType === 'email_ses' && (
                <div className="space-y-3 p-4 bg-[#070b14] border border-slate-800/90 rounded-2xl">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">AWS Access Key ID</label>
                      <input
                        type="text"
                        value={newGwCreds.access_key_id || ''}
                        onChange={(e) => setNewGwCreds({ ...newGwCreds, access_key_id: e.target.value })}
                        placeholder="AKIA..."
                        className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">AWS Secret Key</label>
                      <input
                        type="password"
                        value={newGwCreds.secret_access_key || ''}
                        onChange={(e) => setNewGwCreds({ ...newGwCreds, secret_access_key: e.target.value })}
                        placeholder="wJalr..."
                        className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Region</label>
                      <select
                        value={newGwCreds.region || 'ap-south-1'}
                        onChange={(e) => setNewGwCreds({ ...newGwCreds, region: e.target.value })}
                        className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white"
                      >
                        <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                        <option value="us-east-1">US East (N. Virginia)</option>
                        <option value="eu-west-1">Europe (Ireland)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">From Sender Email</label>
                      <input
                        type="email"
                        value={newGwCreds.from_email || ''}
                        onChange={(e) => setNewGwCreds({ ...newGwCreds, from_email: e.target.value })}
                        placeholder="broadcasts@company.com"
                        className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {newGwType === 'email_smtp' && (
                <div className="space-y-3 p-4 bg-[#070b14] border border-slate-800/90 rounded-2xl">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">SMTP Host Server</label>
                      <input
                        type="text"
                        value={newGwCreds.host || ''}
                        onChange={(e) => setNewGwCreds({ ...newGwCreds, host: e.target.value })}
                        placeholder="smtp.gmail.com"
                        className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">SMTP Port</label>
                      <input
                        type="number"
                        value={newGwCreds.port || 587}
                        onChange={(e) => setNewGwCreds({ ...newGwCreds, port: parseInt(e.target.value) })}
                        placeholder="587"
                        className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">SMTP Username</label>
                      <input
                        type="text"
                        value={newGwCreds.user || ''}
                        onChange={(e) => setNewGwCreds({ ...newGwCreds, user: e.target.value })}
                        placeholder="user@company.com"
                        className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">SMTP Password</label>
                      <input
                        type="password"
                        value={newGwCreds.pass || ''}
                        onChange={(e) => setNewGwCreds({ ...newGwCreds, pass: e.target.value })}
                        placeholder="••••••••••••"
                        className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1">From Sender Email</label>
                    <input
                      type="email"
                      value={newGwCreds.from_email || ''}
                      onChange={(e) => setNewGwCreds({ ...newGwCreds, from_email: e.target.value })}
                      placeholder="support@company.com"
                      className="w-full px-3 py-2 bg-[#0c1322] border border-slate-800 rounded-xl text-white"
                    />
                  </div>
                </div>
              )}
              </div>

              <div className="px-6 py-3.5 bg-[#070b14] border-t border-slate-800 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#070b14] hover:bg-slate-800 text-slate-300 font-semibold cursor-pointer border border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className={`px-5 py-2.5 rounded-xl text-white font-bold shadow-lg disabled:opacity-50 cursor-pointer flex items-center gap-2 ${
                    newGwType === 'whatsapp_baileys'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/20'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/20'
                  }`}
                >
                  {isAdding ? (
                    'Allocating...'
                  ) : newGwType === 'whatsapp_baileys' ? (
                    <>
                      <QrCode size={16} />
                      <span>Allocate & Connect WhatsApp</span>
                    </>
                  ) : (
                    'Save & Allocate Gateway'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: GATEWAY ALLOCATION & META CONTACT SYNC SUCCESS REPORT           */}
      {/* ========================================================================= */}
      {allocationReportModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-scaleUp">
            <div className="p-6 bg-gradient-to-r from-emerald-950/60 to-[#070b14] border-b border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Meta Cloud API Gateway Allocated!</h3>
                  <p className="text-xs text-emerald-300">Connected & Synced for {allocationReportModal.gateway?.company_name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAllocationReportModal({ isOpen: false })}
                className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-4 bg-[#070b14] border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Gateway Name:</span>
                  <span className="font-bold text-white">{allocationReportModal.gateway?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Company Partition:</span>
                  <span className="font-bold text-cyan-300">{allocationReportModal.gateway?.company_name}</span>
                </div>
                {allocationReportModal.gateway?.credentials?.display_phone_number && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Display Phone Number:</span>
                    <span className="font-mono font-bold text-emerald-400">{allocationReportModal.gateway?.credentials?.display_phone_number}</span>
                  </div>
                )}
                {allocationReportModal.gateway?.credentials?.verified_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Verified Identity:</span>
                    <span className="font-bold text-slate-200">{allocationReportModal.gateway?.credentials?.verified_name}</span>
                  </div>
                )}
              </div>

              {/* Sync Metrics Highlights */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-1">
                  <div className="text-2xl font-black text-emerald-400">
                    {allocationReportModal.gateway?.credentials?.phone_numbers?.length || 1}
                  </div>
                  <div className="text-[11px] font-bold text-emerald-300">Connected WhatsApp Lines</div>
                  <div className="text-[10px] text-slate-400">Ready for Broadcast Campaigns</div>
                </div>

                <div className="p-3.5 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-center space-y-1">
                  <div className="text-2xl font-black text-cyan-400">
                    {allocationReportModal.templatesReport?.totalSynced || 2}
                  </div>
                  <div className="text-[11px] font-bold text-cyan-300">WhatsApp Templates Synced</div>
                  <div className="text-[10px] text-slate-400">Registered in Templates Studio</div>
                </div>
              </div>

              {/* List of Connected Phone Numbers */}
              {allocationReportModal.gateway?.credentials?.phone_numbers && allocationReportModal.gateway.credentials.phone_numbers.length > 0 && (
                <div className="p-3 bg-[#070b14] border border-slate-800 rounded-xl space-y-2">
                  <div className="text-[11px] font-bold text-slate-300">Connected Phone Lines:</div>
                  <div className="space-y-1">
                    {allocationReportModal.gateway.credentials.phone_numbers.map((pn: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] font-mono text-slate-300 bg-[#0c1322] px-2.5 py-1.5 rounded-lg">
                        <span className="font-bold text-white">{pn.display_phone_number} ({pn.verified_name})</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                          {pn.status || 'Connected'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <a
                  href="/broadcasts"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold flex items-center gap-1.5 transition-all cursor-pointer text-xs"
                >
                  <Send size={13} />
                  <span>Launch WhatsApp Broadcast</span>
                </a>
                <button
                  type="button"
                  onClick={() => setAllocationReportModal({ isOpen: false })}
                  className="px-4 py-2 rounded-xl bg-[#070b14] hover:bg-slate-800 text-slate-300 font-semibold cursor-pointer border border-slate-800 text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Baileys WhatsApp QR Scanner & Pairing Modal */}
      {baileysModalGw && (
        <BaileysPairingModal
          isOpen={!!baileysModalGw}
          onClose={() => setBaileysModalGw(null)}
          gateway={baileysModalGw}
          onSuccess={() => {
            fetchGateways();
          }}
        />
      )}
    </div>
  );
};
