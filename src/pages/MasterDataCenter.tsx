import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Users,
  Search,
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  XCircle,
  Smartphone,
  Mail,
  ShieldCheck,
  Filter,
  FileSpreadsheet,
  Layers,
  Sparkles,
  RefreshCw,
  X,
  Plus,
  Edit3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Lock,
  FileDown,
  Check,
  AlertCircle,
  Building,
  ShieldAlert,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export const MasterDataCenter: React.FC = () => {
  const { user, isSuperadmin, setIsWorkingOrProcessing } = useAuth();
  const { lastEvent } = useSocket();
  const [leads, setLeads] = useState<any[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  
  // Persisted search & filter
  const [search, setSearch] = useState(() => localStorage.getItem('mdc_search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => localStorage.getItem('mdc_search') || '');
  const [optinFilter, setOptinFilter] = useState(() => localStorage.getItem('mdc_optin_filter') || 'all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [srNoStart, setSrNoStart] = useState<string>('');
  const [srNoEnd, setSrNoEnd] = useState<string>('');
  const [debouncedSrNoStart, setDebouncedSrNoStart] = useState<string>('');
  const [debouncedSrNoEnd, setDebouncedSrNoEnd] = useState<string>('');
  
  // Sorting state
  const [sortBy, setSortBy] = useState<string>('sr_no');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');

  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // AbortController for race-free fetch cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  // Manual debounce timers (avoids cross-effect race conditions)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const srNoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Upload Modal & Live Progress State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadReport, setUploadReport] = useState<any>(null);
  const [ingestJob, setIngestJob] = useState<{
    jobId: string;
    status: 'uploading' | 'processing' | 'completed' | 'failed';
    percent: number;
    processed: number;
    total: number;
    newInserted: number;
    updatedExisting: number;
    error?: string;
  } | null>(null);

  // Add Contact Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    pan_no: '',
    whatsapp_optin: true,
    email_optin: true,
    company_name: '',
  });

  // Edit Contact Modal State
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    pan_no: '',
    whatsapp_optin: true,
    email_optin: true,
  });

  // Superadmin Wipe Company Data Modal State
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [wipeCompany, setWipeCompany] = useState<string>('');
  const [wipeCount, setWipeCount] = useState<number | null>(null);
  const [wipeCounting, setWipeCounting] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState('');
  const [wipeLoading, setWipeLoading] = useState(false);
  const [wipeError, setWipeError] = useState<string | null>(null);
  const [wipeSuccess, setWipeSuccess] = useState<string | null>(null);
  const [wipeJob, setWipeJob] = useState<{
    jobId: string;
    companyName?: string;
    status: 'processing' | 'completed' | 'failed';
    percent: number;
    deleted: number;
    total: number;
    error?: string;
  } | null>(null);

  const fetchWipeCompanyCount = async (comp: string) => {
    if (!comp || comp === 'all') {
      setWipeCount(null);
      return;
    }
    try {
      setWipeCounting(true);
      const res = await axios.get('/api/leads/count', { params: { company_name: comp } });
      if (res.data.success) {
        setWipeCount(res.data.count);
      }
    } catch (e) {
      console.error('Failed to get company count:', e);
    } finally {
      setWipeCounting(false);
    }
  };

  const handleOpenWipeModal = () => {
    const defaultCompany = selectedCompanyFilter !== 'all' ? selectedCompanyFilter : (companies[0] || '');
    setWipeCompany(defaultCompany);
    setWipeConfirmText('');
    setWipeError(null);
    setWipeSuccess(null);
    setWipeJob(null);
    setShowWipeModal(true);
    if (defaultCompany) {
      fetchWipeCompanyCount(defaultCompany);
    }
  };

  const handleCloseWipeModal = () => {
    if (wipeJob && wipeJob.status === 'processing') {
      if (!confirm('A wipe operation is currently running in the background. Are you sure you want to close this window? The wipe will continue running.')) {
        return;
      }
    }
    setShowWipeModal(false);
    setWipeError(null);
    setWipeSuccess(null);
    setWipeConfirmText('');
    setWipeJob(null);
    setWipeLoading(false);
  };

  const handleWipeCompanySubmit = async () => {
    if (!wipeCompany || wipeCompany === 'all') {
      setWipeError('Please select a specific company to wipe.');
      return;
    }
    if (wipeConfirmText.trim().toUpperCase() !== 'WIPE' && wipeConfirmText.trim() !== wipeCompany.trim()) {
      setWipeError(`Confirmation mismatch. Please type "WIPE" or "${wipeCompany}" to confirm.`);
      return;
    }

    try {
      setWipeLoading(true);
      setWipeError(null);
      setWipeSuccess(null);
      setIsWorkingOrProcessing(true);

      const res = await axios.post('/api/leads/wipe-company', {
        company_name: wipeCompany,
      });

      if (res.data.success) {
        if (res.data.jobId) {
          setWipeJob({
            jobId: res.data.jobId,
            companyName: wipeCompany,
            status: 'processing',
            percent: 0,
            deleted: 0,
            total: res.data.totalToDelete || wipeCount || 0,
          });
        } else {
          setIsWorkingOrProcessing(false);
          setWipeLoading(false);
          setWipeSuccess(res.data.message || `Successfully wiped all contacts for ${wipeCompany}.`);
          fetchLeads();
          if (isSuperadmin) {
            fetchCompanies();
          }
          setTimeout(() => {
            setShowWipeModal(false);
            setWipeSuccess(null);
            setWipeConfirmText('');
          }, 1500);
        }
      }
    } catch (err: any) {
      console.error('Wipe company failed:', err);
      setIsWorkingOrProcessing(false);
      setWipeLoading(false);
      setWipeError(err.response?.data?.message || 'Failed to wipe company contacts.');
    }
  };

  // 300ms Search Debounce — updates debouncedSearch which triggers the SINGLE main effect
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      const trimmed = search.trim();
      setDebouncedSearch(trimmed);
      localStorage.setItem('mdc_search', search);
      setPage(1);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [search]);

  // 350ms Sr. No Range Debounce — batches srNoStart/End into debounced state
  useEffect(() => {
    if (srNoTimerRef.current) clearTimeout(srNoTimerRef.current);
    srNoTimerRef.current = setTimeout(() => {
      setDebouncedSrNoStart(srNoStart);
      setDebouncedSrNoEnd(srNoEnd);
      setPage(1);
    }, 350);
    return () => { if (srNoTimerRef.current) clearTimeout(srNoTimerRef.current); };
  }, [srNoStart, srNoEnd]);

  // SINGLE consolidated fetch effect — ALL filter dependencies in ONE place, NO race conditions
  useEffect(() => {
    localStorage.setItem('mdc_optin_filter', optinFilter);
    fetchLeads();
    if (isSuperadmin) {
      fetchCompanies();
    }
  }, [debouncedSearch, page, limit, optinFilter, channelFilter, selectedCompanyFilter, sortBy, sortDir, debouncedSrNoStart, debouncedSrNoEnd]);

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

  useEffect(() => {
    const evType = lastEvent?.data?.type || lastEvent?.type;
    const evData = lastEvent?.data?.type ? lastEvent.data : (lastEvent?.data || lastEvent);

    if (evType === 'INGEST_PROGRESS' && evData) {
      const data = evData;
      if (!ingestJob || data.jobId === ingestJob.jobId) {
        setIngestJob((prev) => ({
          jobId: data.jobId,
          status: data.status,
          percent: data.percent ?? (prev?.percent || 0),
          processed: data.processed ?? (prev?.processed || 0),
          total: data.total ?? (prev?.total || 0),
          newInserted: data.newInserted ?? (prev?.newInserted || 0),
          updatedExisting: data.updatedExisting ?? (prev?.updatedExisting || 0),
          error: data.error,
        }));

        if (data.status === 'completed') {
          setIsWorkingOrProcessing(false);
          setUploadLoading(false);
          if (data.report) setUploadReport(data.report);
          fetchLeads();
        } else if (data.status === 'failed') {
          setIsWorkingOrProcessing(false);
          setUploadLoading(false);
        }
      }
    } else if (evType === 'WIPE_PROGRESS' && evData) {
      const data = evData;
      if (!wipeJob || data.jobId === wipeJob.jobId) {
        setWipeJob((prev) => ({
          jobId: data.jobId,
          companyName: data.company || prev?.companyName,
          status: data.status,
          percent: data.percent ?? (prev?.percent || 0),
          deleted: data.deleted ?? (prev?.deleted || 0),
          total: data.total ?? (prev?.total || 0),
          error: data.error,
        }));

        if (data.status === 'completed') {
          setIsWorkingOrProcessing(false);
          setWipeLoading(false);
          setWipeSuccess(`Successfully erased ${Number(data.deleted || 0).toLocaleString()} contacts for "${data.company || wipeCompany}".`);
          fetchLeads();
          if (isSuperadmin) {
            fetchCompanies();
          }
          setTimeout(() => {
            setShowWipeModal(false);
            setWipeJob(null);
            setWipeSuccess(null);
            setWipeConfirmText('');
          }, 2500);
        } else if (data.status === 'failed') {
          setIsWorkingOrProcessing(false);
          setWipeLoading(false);
          setWipeError(data.error || 'Wipe operation failed.');
        }
      }
    } else if (evType === 'LEADS_UPDATED' || evType === 'PREFERENCES_UPDATED' || evType === 'LEAD_OPTIN_CHANGED') {
      fetchLeads();
      if (isSuperadmin) {
        fetchCompanies();
      }
    }
  }, [lastEvent, ingestJob, wipeJob, wipeCompany, isSuperadmin, setIsWorkingOrProcessing]);

  // Polling fallback every 1s for background wipe job
  useEffect(() => {
    if (!wipeJob || wipeJob.status !== 'processing' || !wipeJob.jobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`/api/leads/wipe-status/${wipeJob.jobId}`);
        if (res.data.success && res.data.job) {
          const job = res.data.job;
          setWipeJob((prev) => ({
            jobId: job.jobId,
            companyName: job.companyName || prev?.companyName,
            status: job.status,
            percent: job.percent,
            deleted: job.deleted,
            total: job.totalToDelete || (prev?.total || 0),
            error: job.error,
          }));

          if (job.status === 'completed') {
            setIsWorkingOrProcessing(false);
            setWipeLoading(false);
            setWipeSuccess(`Successfully erased ${job.deleted.toLocaleString()} contacts for "${job.companyName || wipeCompany}".`);
            fetchLeads();
            if (isSuperadmin) {
              fetchCompanies();
            }
            clearInterval(interval);
            setTimeout(() => {
              setShowWipeModal(false);
              setWipeJob(null);
              setWipeSuccess(null);
              setWipeConfirmText('');
            }, 2500);
          } else if (job.status === 'failed') {
            setIsWorkingOrProcessing(false);
            setWipeLoading(false);
            setWipeError(job.error || 'Wipe operation failed.');
            clearInterval(interval);
          }
        }
      } catch (e) {
        // Polling error fallback
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [wipeJob?.jobId, wipeJob?.status, isSuperadmin, wipeCompany, setIsWorkingOrProcessing]);

  // Polling fallback every 2s for background upload job
  useEffect(() => {
    if (!ingestJob || ingestJob.status !== 'processing' || !ingestJob.jobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`/api/leads/upload-status/${ingestJob.jobId}`);
        if (res.data.success && res.data.job) {
          const job = res.data.job;
          setIngestJob((prev) => ({
            jobId: job.jobId,
            status: job.status,
            percent: job.percent,
            processed: job.processed,
            total: job.totalRows || (prev?.total || 0),
            newInserted: job.newInserted,
            updatedExisting: job.updatedExisting,
            error: job.error,
          }));

          if (job.status === 'completed') {
            setIsWorkingOrProcessing(false);
            setUploadLoading(false);
            if (job.report) setUploadReport(job.report);
            fetchLeads();
            clearInterval(interval);
          } else if (job.status === 'failed') {
            setIsWorkingOrProcessing(false);
            setUploadLoading(false);
            clearInterval(interval);
          }
        }
      } catch (e) {
        // Polling error fallback
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [ingestJob?.jobId, ingestJob?.status, setIsWorkingOrProcessing]);

  const fetchLeads = async () => {
    // Cancel previous in-flight request to eliminate race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setIsLoading(true);
      const res = await axios.get('/api/leads', {
        signal: controller.signal,
        params: {
          page,
          limit,
          search: debouncedSearch || undefined,
          optin_filter: optinFilter !== 'all' ? optinFilter : undefined,
          channel_filter: channelFilter !== 'all' ? channelFilter : undefined,
          sr_no_start: debouncedSrNoStart ? parseInt(debouncedSrNoStart, 10) : undefined,
          sr_no_end: debouncedSrNoEnd ? parseInt(debouncedSrNoEnd, 10) : undefined,
          company_name: selectedCompanyFilter !== 'all' ? selectedCompanyFilter : undefined,
          sort_by: sortBy,
          sort_dir: sortDir,
        },
      });

      if (res.data.success) {
        setLeads(res.data.data);
        setTotal(res.data.pagination.total);
      }
    } catch (err: any) {
      if (axios.isCancel(err) || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
        return;
      }
      console.error('Failed to load leads:', err);
      // Reset state on error so banner never shows stale counts
      setLeads([]);
      setTotal(0);
    } finally {
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Clear any pending debounce and apply search immediately
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const trimmed = search.trim();
    setDebouncedSearch(trimmed);
    localStorage.setItem('mdc_search', search);
    setPage(1);
  };

  const handleClearSearch = () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setSearch('');
    setDebouncedSearch('');
    localStorage.removeItem('mdc_search');
    setPage(1);
  };

  const handleResetAllFilters = () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (srNoTimerRef.current) clearTimeout(srNoTimerRef.current);
    setSearch('');
    setDebouncedSearch('');
    localStorage.removeItem('mdc_search');
    setSrNoStart('');
    setSrNoEnd('');
    setDebouncedSrNoStart('');
    setDebouncedSrNoEnd('');
    setChannelFilter('all');
    setOptinFilter('all');
    setPage(1);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(column);
      setSortDir('ASC');
    }
    setPage(1);
  };

  const renderSortIndicator = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown size={12} className="text-slate-600 opacity-60 ml-1 inline" />;
    }
    return sortDir === 'ASC' ? (
      <ArrowUp size={12} className="text-blue-400 ml-1 inline font-bold" />
    ) : (
      <ArrowDown size={12} className="text-blue-400 ml-1 inline font-bold" />
    );
  };

  const handleToggleOptin = async (leadId: string, channel: 'whatsapp' | 'email', currentVal: boolean) => {
    try {
      const res = await axios.post('/api/leads/optin-toggle', {
        lead_id: leadId,
        channel,
        status: !currentVal,
      });

      if (res.data.success && res.data.lead) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, ...res.data.lead } : l))
        );
      }
    } catch (err) {
      alert('Failed to update opt-in preference.');
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLeads(leads.map((l) => l.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter((i) => i !== id));
    } else {
      setSelectedLeads([...selectedLeads, id]);
    }
  };

  const handleDeleteSingle = async (lead: any) => {
    if (!confirm(`Are you sure you want to permanently remove contact #${lead.sr_no || ''} (${lead.full_name})?`)) return;
    try {
      const res = await axios.delete(`/api/leads/${lead.id}`);
      if (res.data.success) {
        setSelectedLeads((prev) => prev.filter((id) => id !== lead.id));
        fetchLeads();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete contact.');
    }
  };

  const handleBatchDelete = async () => {
    if (!confirm(`Are you sure you want to permanently delete ${selectedLeads.length} selected contacts?`)) return;
    try {
      const res = await axios.post('/api/leads/batch-delete', {
        lead_ids: selectedLeads,
      });
      if (res.data.success) {
        setSelectedLeads([]);
        fetchLeads();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete selected contacts.');
    }
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());
    if (optinFilter !== 'all') params.append('optin_filter', optinFilter);
    if (channelFilter !== 'all') params.append('channel_filter', channelFilter);
    if (srNoStart) params.append('sr_no_start', srNoStart);
    if (srNoEnd) params.append('sr_no_end', srNoEnd);
    if (selectedCompanyFilter !== 'all') params.append('company_name', selectedCompanyFilter);

    const token = localStorage.getItem('token');
    const exportUrl = `/api/leads/export?${params.toString()}`;
    
    // Trigger download via link with auth
    const a = document.createElement('a');
    a.href = exportUrl;
    // Direct link with authorization cookie/session
    window.open(exportUrl, '_blank');
  };

  const handleOpenEdit = (lead: any) => {
    setEditingLead(lead);
    setEditError(null);
    setEditSuccess(null);
    setEditForm({
      full_name: lead.full_name || '',
      phone: lead.phone ? (lead.phone.startsWith('91') && lead.phone.length === 12 ? lead.phone.substring(2) : lead.phone) : '',
      email: lead.email || '',
      city: lead.city || '',
      address: lead.address || '',
      pan_no: lead.pan_no || '',
      whatsapp_optin: lead.whatsapp_optin ?? true,
      email_optin: lead.email_optin ?? true,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;

    try {
      setEditLoading(true);
      setEditError(null);
      const res = await axios.put(`/api/leads/${editingLead.id}`, editForm);
      if (res.data.success) {
        setEditSuccess('Contact updated successfully!');
        setLeads((prev) => prev.map((l) => (l.id === editingLead.id ? { ...l, ...res.data.lead } : l)));
        setTimeout(() => {
          setEditingLead(null);
          setEditSuccess(null);
        }, 800);
      }
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Failed to update contact.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.phone && !addForm.email) {
      setAddError('Please provide at least a Phone Number or Email Address.');
      return;
    }

    try {
      setAddLoading(true);
      setAddError(null);
      setAddSuccess(null);
      const res = await axios.post('/api/leads', addForm);
      if (res.data.success) {
        setAddSuccess(res.data.message || 'Contact added successfully!');
        fetchLeads();
        setAddForm({
          full_name: '',
          phone: '',
          email: '',
          city: '',
          address: '',
          pan_no: '',
          whatsapp_optin: true,
          email_optin: true,
          company_name: '',
        });
        setTimeout(() => {
          setShowAddModal(false);
          setAddSuccess(null);
        }, 1200);
      }
    } catch (err: any) {
      setAddError(err.response?.data?.message || 'Failed to create contact.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploadLoading(true);
    setUploadReport(null);
    setIsWorkingOrProcessing(true);

    setIngestJob({
      jobId: '',
      status: 'uploading',
      percent: 5,
      processed: 0,
      total: 0,
      newInserted: 0,
      updatedExisting: 0,
    });

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const res = await axios.post('/api/leads/upload', formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const uploadPercent = Math.round((progressEvent.loaded * 25) / progressEvent.total);
            setIngestJob((prev) => prev ? { ...prev, percent: Math.max(5, uploadPercent) } : null);
          }
        },
      });

      if (res.data.success) {
        if (res.data.jobId) {
          setIngestJob({
            jobId: res.data.jobId,
            status: 'processing',
            percent: 30,
            processed: 0,
            total: res.data.totalRows || 0,
            newInserted: 0,
            updatedExisting: 0,
          });
        } else if (res.data.report) {
          setUploadReport(res.data.report);
          setIngestJob(null);
          setUploadLoading(false);
          setIsWorkingOrProcessing(false);
          fetchLeads();
        }
      }
    } catch (err: any) {
      setIsWorkingOrProcessing(false);
      setUploadLoading(false);
      setIngestJob(null);
      alert(err.response?.data?.message || 'Failed to ingest contacts.');
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0f172a] p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/30">
              Module 2: Master Data Center
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <Sparkles size={12} />
              High-Speed Trigram Substring Search
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Customer Repository & URN Data Center
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Zero-duplicate priority phone matching • Immutable sequential Sr. No • Fast multi-column filtering
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl bg-[#070b14] hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-800"
            title="Download CSV of current filtered contacts"
          >
            <FileDown size={14} className="text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <a
            href="/api/leads/sample-template"
            target="_blank"
            className="px-3 py-2 rounded-xl bg-[#070b14] hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-800"
          >
            <Download size={14} />
            <span>Sample Template</span>
          </a>

          <button
            onClick={() => {
              setUploadReport(null);
              setUploadFile(null);
              setShowUploadModal(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-[#070b14] hover:bg-slate-800 text-slate-200 text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition-all"
          >
            <Upload size={14} className="text-blue-400" />
            <span>Bulk Ingest</span>
          </button>

          {isSuperadmin && (
            <button
              onClick={handleOpenWipeModal}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-bold border border-rose-500/30 flex items-center gap-1.5 transition-all shadow-sm"
              title="Superadmin Only: Permanently erase all contacts for a selected company"
            >
              <Trash2 size={14} className="text-rose-400" />
              <span>Wipe Company Data</span>
            </button>
          )}

          <button
            onClick={() => {
              setAddError(null);
              setAddSuccess(null);
              setShowAddModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 flex items-center gap-1.5 transition-all hover:scale-[1.02]"
          >
            <Plus size={15} />
            <span>Add Contact</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-96">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search Name, Phone, Email, URN, FMCB, City..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#070b14] border border-slate-800 rounded-xl pl-10 pr-9 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {search && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors shrink-0"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
          {isSuperadmin && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <Building size={13} className="text-cyan-400" />
              <select
                value={selectedCompanyFilter}
                onChange={(e) => {
                  setSelectedCompanyFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-[#070b14] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="all">🏢 All Companies ({companies.length})</option>
                {companies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-mono text-xs">#</span>
            <input
              type="number"
              placeholder="From Sr."
              value={srNoStart}
              onChange={(e) => setSrNoStart(e.target.value)}
              className="w-18 bg-[#070b14] border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <span className="text-slate-500 text-xs">-</span>
            <input
              type="number"
              placeholder="To Sr."
              value={srNoEnd}
              onChange={(e) => setSrNoEnd(e.target.value)}
              className="w-18 bg-[#070b14] border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={channelFilter}
            onChange={(e) => {
              setChannelFilter(e.target.value);
              setPage(1);
            }}
            className="bg-[#070b14] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Channels</option>
            <option value="phone_only">Phone Only</option>
            <option value="email_only">Email Only</option>
            <option value="both">Both Phone & Email</option>
          </select>

          <select
            value={optinFilter}
            onChange={(e) => {
              setOptinFilter(e.target.value);
              setPage(1);
            }}
            className="bg-[#070b14] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Contacts ({total.toLocaleString()})</option>
            <option value="whatsapp_optin">WhatsApp Opted-In</option>
            <option value="email_optin">Email Opted-In</option>
            <option value="whatsapp_optout">WhatsApp Opted-Out</option>
            <option value="email_optout">Email Opted-Out</option>
            <option value="all_optout">Fully Unsubscribed</option>
          </select>

          <select
            value={limit}
            onChange={(e) => {
              setLimit(parseInt(e.target.value, 10));
              setPage(1);
            }}
            className="bg-[#070b14] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            title="Rows per page"
          >
            <option value="25">25 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
            <option value="250">250 / page</option>
            <option value="500">500 / page</option>
          </select>

          {(srNoStart || srNoEnd || channelFilter !== 'all' || optinFilter !== 'all' || search) && (
            <button
              onClick={handleResetAllFilters}
              className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
              title="Reset all filters"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Quick Sr. No Range Presets */}
      <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
        <span className="font-semibold text-slate-500 flex items-center gap-1">
          <Filter size={12} />
          Quick Sr. Range:
        </span>
        {[
          { label: 'Top 100', start: '1', end: '100' },
          { label: 'Top 250', start: '1', end: '250' },
          { label: 'Top 500', start: '1', end: '500' },
          { label: 'Top 1,000', start: '1', end: '1000' },
          { label: 'Top 5,000', start: '1', end: '5000' },
        ].map((preset) => (
          <button
            key={preset.label}
            onClick={() => {
              setSrNoStart(preset.start);
              setSrNoEnd(preset.end);
            }}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono transition-colors ${
              srNoStart === preset.start && srNoEnd === preset.end
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/40 font-bold'
                : 'bg-[#070b14] text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            #{preset.label}
          </button>
        ))}
        {(srNoStart || srNoEnd) && (
          <button
            onClick={() => {
              setSrNoStart('');
              setSrNoEnd('');
            }}
            className="text-[11px] text-rose-400 hover:underline ml-1"
          >
            Clear Sr. Range
          </button>
        )}
      </div>

      {/* Active Search & Filter Banner */}
      {debouncedSearch && (
        <div className="bg-blue-950/40 border border-blue-500/30 rounded-2xl px-5 py-3 flex items-center justify-between text-xs animate-fadeIn backdrop-blur-sm shadow-md">
          <div className="flex items-center gap-2.5 text-slate-200">
            <Search size={15} className="text-blue-400 shrink-0" />
            <span>
              Search filter active: <strong className="text-blue-300 font-mono font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">"{debouncedSearch}"</strong>
              {isLoading ? (
                <span className="text-slate-400 ml-2 animate-pulse font-medium">Filtering contacts...</span>
              ) : (
                <span className="text-emerald-400 ml-2 font-bold font-mono">
                  ({total.toLocaleString()} contact{total === 1 ? '' : 's'} matched)
                </span>
              )}
            </span>
          </div>
          <button
            onClick={handleClearSearch}
            className="px-3 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors text-[11px] font-semibold border border-slate-700/60"
          >
            <X size={13} />
            <span>Clear Search</span>
          </button>
        </div>
      )}

      {/* Master Contacts Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#070b14] text-slate-400 border-b border-slate-800 font-semibold select-none">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={leads.length > 0 && selectedLeads.length === leads.length}
                    className="rounded bg-[#070b14] border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th
                  onClick={() => handleSort('sr_no')}
                  className="p-3.5 w-20 text-center cursor-pointer hover:text-slate-200 transition-colors"
                >
                  <span>Sr. No</span>
                  {renderSortIndicator('sr_no')}
                </th>
                {isSuperadmin && <th className="p-3.5">Company</th>}
                <th
                  onClick={() => handleSort('full_name')}
                  className="p-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                >
                  <span>Customer Name & City</span>
                  {renderSortIndicator('full_name')}
                </th>
                <th className="p-3.5">URN / Sequential FMCB</th>
                <th
                  onClick={() => handleSort('phone')}
                  className="p-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                >
                  <span>Phone & Email</span>
                  {renderSortIndicator('phone')}
                </th>
                <th className="p-3.5">WhatsApp Opt-in</th>
                <th className="p-3.5">Email Opt-in</th>
                <th
                  onClick={() => handleSort('whatsapp_sent_count')}
                  className="p-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                >
                  <span>Engagement</span>
                  {renderSortIndicator('whatsapp_sent_count')}
                </th>
                <th
                  onClick={() => handleSort('created_at')}
                  className="p-3.5 cursor-pointer hover:text-slate-200 transition-colors"
                >
                  <span>Registered</span>
                  {renderSortIndicator('created_at')}
                </th>
                <th className="p-3.5 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {isLoading ? (
                <tr>
                  <td colSpan={isSuperadmin ? 11 : 10} className="p-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={18} className="animate-spin text-blue-400" />
                      <span>Fetching contacts with sub-millisecond query engine...</span>
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={isSuperadmin ? 11 : 10} className="p-12 text-center text-slate-500">
                    <div className="max-w-md mx-auto space-y-3">
                      <Users size={36} className="mx-auto text-slate-600 mb-2" />
                      <div className="text-sm font-bold text-slate-200">
                        {debouncedSearch ? `No contacts found matching "${debouncedSearch}"` : 'No contacts found'}
                      </div>
                      <div className="text-xs text-slate-400 leading-relaxed">
                        {debouncedSearch ? (
                          <span>
                            No contacts in your customer repository matched the phone, name, email, URN, or Sr. No for <strong className="text-slate-200 font-mono">"{debouncedSearch}"</strong>.
                          </span>
                        ) : (
                          <span>
                            Try adjusting your search criteria, clearing filters, or adding a new contact above.
                          </span>
                        )}
                      </div>
                      {debouncedSearch && (
                        <div className="pt-2">
                          <button
                            onClick={handleClearSearch}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 mx-auto"
                          >
                            <X size={14} />
                            <span>Reset Search Filter</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className={`hover:bg-[#070b14]/60 transition-colors ${
                      selectedLeads.includes(lead.id) ? 'bg-blue-600/10' : ''
                    }`}
                  >
                    <td className="p-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => handleToggleSelect(lead.id)}
                        className="rounded bg-[#070b14] border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold text-amber-400 text-xs">
                      #{lead.sr_no || '—'}
                    </td>
                    {isSuperadmin && (
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-cyan-300 border border-slate-700">
                          {lead.company_name}
                        </span>
                      </td>
                    )}
                    <td className="p-3.5">
                      <div className="font-bold text-white text-xs">{lead.full_name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <span>{lead.city || lead.address || 'India'}</span>
                        {lead.pan_no && (
                          <span className="font-mono text-[10px] text-slate-500 ml-1">
                            [{lead.pan_no}]
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      {lead.urn ? (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-500/10 text-purple-400 border border-purple-500/30 font-mono inline-block">
                          {lead.urn}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono inline-block">
                          {lead.fmcb_id}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <div className="font-mono text-slate-200 flex items-center gap-1.5 font-semibold">
                        <Smartphone size={12} className="text-emerald-400 shrink-0" />
                        <span>{lead.phone ? `+${lead.phone}` : <span className="text-slate-500 font-sans font-normal italic text-[11px]">No phone</span>}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Mail size={12} className="text-blue-400 shrink-0" />
                        <span>{lead.email || <span className="text-slate-500 italic">No email</span>}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={() => handleToggleOptin(lead.id, 'whatsapp', lead.whatsapp_optin)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                          lead.whatsapp_optin
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                        }`}
                        title="Click to toggle WhatsApp opt-in status"
                      >
                        {lead.whatsapp_optin ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        <span>{lead.whatsapp_optin ? 'Opted-In' : 'Opted-Out'}</span>
                      </button>
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={() => handleToggleOptin(lead.id, 'email', lead.email_optin)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                          lead.email_optin
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                        }`}
                        title="Click to toggle Email opt-in status"
                      >
                        {lead.email_optin ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        <span>{lead.email_optin ? 'Opted-In' : 'Opted-Out'}</span>
                      </button>
                    </td>
                    <td className="p-3.5">
                      <div className="text-[11px] text-slate-300">
                        WA: <span className="font-bold text-emerald-400">{lead.whatsapp_sent_count || 0}</span> | Email: <span className="font-bold text-blue-400">{lead.email_sent_count || 0}</span>
                      </div>
                      <div className="text-[10px] text-amber-400 font-semibold mt-0.5">
                        Clicks: {lead.clicked_count || 0}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-400 text-[11px]">
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(lead)}
                          className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"
                          title="Edit Contact"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteSingle(lead)}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                          title="Delete Contact"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-6 py-4 bg-[#070b14] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-medium flex-wrap gap-3">
          <div>
            Showing <strong className="text-slate-200">{leads.length}</strong> of <strong className="text-slate-200">{total.toLocaleString()}</strong> contacts
          </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(1)}
              className="px-2.5 py-1.5 rounded-lg bg-[#0f172a] border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-slate-300 shadow-sm"
              title="First Page"
            >
              « First
            </button>
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 rounded-lg bg-[#0f172a] border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-slate-300 shadow-sm"
            >
              Previous
            </button>
            <span className="text-white font-bold px-2">
              Page {page} of {Math.ceil(total / limit) || 1}
            </span>
            <button
              disabled={page * limit >= total}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 rounded-lg bg-[#0f172a] border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-slate-300 shadow-sm"
            >
              Next
            </button>
            <button
              disabled={page * limit >= total}
              onClick={() => setPage(Math.ceil(total / limit) || 1)}
              className="px-2.5 py-1.5 rounded-lg bg-[#0f172a] border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-slate-300 shadow-sm"
              title="Last Page"
            >
              Last »
            </button>
          </div>
        </div>
      </div>

      {/* Floating Sticky Batch Action Bar */}
      {selectedLeads.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0f172a] border border-blue-500/40 rounded-2xl px-6 py-3 shadow-2xl flex items-center gap-4 text-xs animate-slideUp backdrop-blur-md">
          <div className="flex items-center gap-2 text-white font-bold">
            <CheckCircle2 size={16} className="text-blue-400" />
            <span>{selectedLeads.length} contacts selected</span>
          </div>
          <div className="h-4 w-[1px] bg-slate-700" />
          <button
            onClick={() => setSelectedLeads([])}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            Deselect all
          </button>
          <button
            onClick={handleBatchDelete}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-md"
          >
            <Trash2 size={14} />
            <span>Delete Selected ({selectedLeads.length})</span>
          </button>
        </div>
      )}

      {/* Modal 1: Add New Contact */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-[#070b14] border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Plus size={16} className="text-blue-400" />
                  Add Master Contact
                </h3>
                <p className="text-[11px] text-slate-400">
                  Priority phone matching • Auto-sequential FMCB ID & immutable Sr. No
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="p-6 space-y-4 text-xs">
              {addError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{addError}</span>
                </div>
              )}
              {addSuccess && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{addSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-slate-300 font-semibold">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={addForm.full_name}
                    onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold flex items-center gap-1">
                    <Smartphone size={12} className="text-emerald-400" />
                    <span>Phone Number</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210 (or with 91)"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold flex items-center gap-1">
                    <Mail size={12} className="text-blue-400" />
                    <span>Email Address</span>
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. customer@example.com"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Mumbai"
                    value={addForm.city}
                    onChange={(e) => setAddForm({ ...addForm, city: e.target.value })}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">PAN Number</label>
                  <input
                    type="text"
                    placeholder="e.g. ABCPS1234F"
                    value={addForm.pan_no}
                    onChange={(e) => setAddForm({ ...addForm, pan_no: e.target.value.toUpperCase() })}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-slate-300 font-semibold">Address / Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Flat 101, Bandra West"
                    value={addForm.address}
                    onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {isSuperadmin && (
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-slate-300 font-semibold">Assign to Company</label>
                    <select
                      value={addForm.company_name}
                      onChange={(e) => setAddForm({ ...addForm, company_name: e.target.value })}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">OmniReach Global (Default)</option>
                      {companies.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Opt-in Preferences */}
              <div className="pt-2 border-t border-slate-800 flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addForm.whatsapp_optin}
                    onChange={(e) => setAddForm({ ...addForm, whatsapp_optin: e.target.checked })}
                    className="rounded bg-[#070b14] border-slate-700 text-emerald-500 focus:ring-0"
                  />
                  <span className="text-slate-300 font-semibold">WhatsApp Opted-In</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addForm.email_optin}
                    onChange={(e) => setAddForm({ ...addForm, email_optin: e.target.checked })}
                    className="rounded bg-[#070b14] border-slate-700 text-blue-500 focus:ring-0"
                  />
                  <span className="text-slate-300 font-semibold">Email Opted-In</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-[#070b14] hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {addLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving Contact...</span>
                    </>
                  ) : (
                    'Save Contact'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Contact */}
      {editingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-[#070b14] border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Edit3 size={16} className="text-blue-400" />
                  Edit Contact
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-1 text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                    <Lock size={10} />
                    Sr. No #{editingLead.sr_no} (Immutable)
                  </span>
                  <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                    {editingLead.urn || editingLead.fmcb_id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setEditingLead(null)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              {editError && (
                <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{editError}</span>
                </div>
              )}
              {editSuccess && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{editSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-slate-300 font-semibold">Customer Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold flex items-center gap-1">
                    <Smartphone size={12} className="text-emerald-400" />
                    <span>Phone Number</span>
                  </label>
                  <input
                    type="text"
                    placeholder="9876543210"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold flex items-center gap-1">
                    <Mail size={12} className="text-blue-400" />
                    <span>Email Address</span>
                  </label>
                  <input
                    type="email"
                    placeholder="name@domain.com"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">City</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-300 font-semibold">PAN Number</label>
                  <input
                    type="text"
                    value={editForm.pan_no}
                    onChange={(e) => setEditForm({ ...editForm, pan_no: e.target.value.toUpperCase() })}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-slate-300 font-semibold">Address</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Opt-in Preferences */}
              <div className="pt-2 border-t border-slate-800 flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.whatsapp_optin}
                    onChange={(e) => setEditForm({ ...editForm, whatsapp_optin: e.target.checked })}
                    className="rounded bg-[#070b14] border-slate-700 text-emerald-500 focus:ring-0"
                  />
                  <span className="text-slate-300 font-semibold">WhatsApp Opted-In</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.email_optin}
                    onChange={(e) => setEditForm({ ...editForm, email_optin: e.target.checked })}
                    className="rounded bg-[#070b14] border-slate-700 text-blue-500 focus:ring-0"
                  />
                  <span className="text-slate-300 font-semibold">Email Opted-In</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="px-4 py-2 bg-[#070b14] hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {editLoading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: CSV / Excel Ingest Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-[#070b14] border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Ingest Contact Data</h3>
                <p className="text-xs text-slate-400">Zero-duplicate upsert & automatic OmniReach URN resolution</p>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              <div className="border-2 border-dashed border-slate-700 hover:border-blue-500 bg-[#070b14] rounded-2xl p-6 text-center transition-colors">
                <Upload size={32} className="mx-auto text-blue-400 mb-2" />
                <div className="text-xs font-bold text-slate-200">
                  {uploadFile ? uploadFile.name : 'Select CSV or Excel (.xlsx) file'}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Supported: Phone only, Email only, or Both. Columns: Full Name, Phone, Email, Address, PAN, City
                </div>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={(e) => e.target.files && setUploadFile(e.target.files[0])}
                  className="hidden"
                  id="modal-file-upload"
                />
                <label
                  htmlFor="modal-file-upload"
                  className="mt-3 inline-block px-4 py-2 bg-[#0f172a] hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer transition-colors shadow-sm"
                >
                  Browse Computer
                </label>
              </div>

              {/* Live Ingestion Progress Bar */}
              {ingestJob && ingestJob.status !== 'completed' && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl space-y-3 text-xs animate-fadeIn">
                  <div className="flex items-center justify-between text-blue-300 font-bold">
                    <span className="flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-blue-400" />
                      {ingestJob.status === 'uploading' ? 'Uploading file to server...' : 'Ingesting contacts in background...'}
                    </span>
                    <span className="font-mono text-white text-sm">{ingestJob.percent}%</span>
                  </div>

                  <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-700/60 p-0.5">
                    <div
                      className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-sm"
                      style={{ width: `${Math.max(5, ingestJob.percent)}%` }}
                    />
                  </div>

                  {ingestJob.total > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>
                        Processed <strong className="text-slate-200 font-mono">{ingestJob.processed.toLocaleString()}</strong> of <strong className="text-slate-200 font-mono">{ingestJob.total.toLocaleString()}</strong> rows
                      </span>
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        0 duplicates guaranteed
                      </span>
                    </div>
                  )}

                  {ingestJob.status === 'failed' && (
                    <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs">
                      Error: {ingestJob.error || 'Ingestion encountered an unexpected issue.'}
                    </div>
                  )}
                </div>
              )}

              {/* Ingestion Succeeded Report */}
              {uploadReport && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2 text-xs animate-fadeIn">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5 text-sm">
                    <CheckCircle2 size={16} />
                    Ingestion Complete: {uploadReport.totalProcessed.toLocaleString()} Contacts
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="bg-[#070b14] p-2.5 rounded-xl border border-slate-800 text-slate-300">
                      New Contacts: <span className="font-bold text-emerald-400 font-mono text-xs">+{uploadReport.newInserted.toLocaleString()}</span>
                    </div>
                    <div className="bg-[#070b14] p-2.5 rounded-xl border border-slate-800 text-slate-300">
                      Updated: <span className="font-bold text-blue-400 font-mono text-xs">{uploadReport.updatedExisting.toLocaleString()}</span>
                    </div>
                    <div className="bg-[#070b14] p-2.5 rounded-xl border border-slate-800 text-slate-300">
                      URN Ground Truth: <span className="font-bold text-purple-400 font-mono text-xs">{uploadReport.matchedUrnCount.toLocaleString()}</span>
                    </div>
                    <div className="bg-[#070b14] p-2.5 rounded-xl border border-slate-800 text-slate-300">
                      Sequential FMCB IDs: <span className="font-bold text-cyan-400 font-mono text-xs">{uploadReport.newFmcbCount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setIngestJob(null);
                    setUploadReport(null);
                  }}
                  className="px-4 py-2 bg-[#070b14] hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl border border-slate-800 transition-colors"
                >
                  {uploadReport ? 'Done & Close' : 'Close'}
                </button>
                {!uploadReport && (
                  <button
                    type="submit"
                    disabled={!uploadFile || uploadLoading}
                    className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    {uploadLoading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Ingesting in Background...</span>
                      </>
                    ) : (
                      'Start Ingestion'
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Wipe Company Master Data Modal (Superadmin Only) */}
      {isSuperadmin && showWipeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0f172a] border border-rose-500/30 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 bg-rose-950/30 border-b border-rose-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
                  <Trash2 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Wipe Company Master Contacts</span>
                    <span className="text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full">
                      SUPERADMIN ONLY
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Permanently erase all repository contacts for a selected tenant</p>
                </div>
              </div>
              <button
                onClick={handleCloseWipeModal}
                disabled={wipeJob?.status === 'processing'}
                className="p-1 text-slate-400 hover:text-slate-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {wipeError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{wipeError}</span>
                </div>
              )}

              {wipeSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{wipeSuccess}</span>
                </div>
              )}

              {wipeJob?.status === 'processing' ? (
                <div className="space-y-4 py-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-400 flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin text-rose-400" />
                      <span>Erasing {wipeJob.companyName || wipeCompany} Contacts...</span>
                    </span>
                    <span className="font-mono font-bold text-white bg-rose-500/20 px-2.5 py-0.5 rounded border border-rose-500/40">
                      {wipeJob.percent}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-900 rounded-full h-3.5 overflow-hidden border border-rose-500/30 p-0.5">
                    <div
                      className="bg-gradient-to-r from-rose-500 to-red-600 h-full rounded-full transition-all duration-300 relative overflow-hidden"
                      style={{ width: `${Math.max(4, wipeJob.percent)}%` }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono bg-[#070b14] p-3 rounded-xl border border-slate-800">
                    <span>Erased: <strong className="text-rose-400 font-bold text-xs">{wipeJob.deleted.toLocaleString()}</strong></span>
                    <span>Total Target: <strong className="text-slate-200 font-bold text-xs">{wipeJob.total.toLocaleString()}</strong></span>
                  </div>

                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                    <p className="flex items-center gap-1.5 text-slate-300 font-semibold">
                      <Sparkles size={12} className="text-rose-400" />
                      <span>Chunked Deletion Engine Active</span>
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Deleting in batches of 5,000 to eliminate database timeouts and protect live operations. This window will auto-close when complete.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Select Company to Wipe:</span>
                      <span className="text-[11px] text-slate-400">
                        {companies.length} registered companies
                      </span>
                    </label>
                    <div className="relative">
                      <Building size={14} className="absolute left-3.5 top-3 text-slate-500" />
                      <select
                        value={wipeCompany}
                        onChange={(e) => {
                          setWipeCompany(e.target.value);
                          fetchWipeCompanyCount(e.target.value);
                        }}
                        disabled={wipeLoading}
                        className="w-full bg-[#070b14] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500 font-semibold"
                      >
                        <option value="" disabled>-- Select Company --</option>
                        {companies.map((c) => (
                          <option key={c} value={c}>
                            🏢 {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Warning and Count Box */}
                  {wipeCompany && (
                    <div className="p-4 bg-rose-950/20 border border-rose-500/30 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-rose-400">
                        <span className="flex items-center gap-1.5">
                          <ShieldAlert size={15} />
                          <span>Permanent Erasure Warning</span>
                        </span>
                        {wipeCounting ? (
                          <span className="text-[11px] text-slate-400 animate-pulse">Calculating contacts...</span>
                        ) : wipeCount !== null ? (
                          <span className="text-xs font-mono font-extrabold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30">
                            {wipeCount.toLocaleString()} Contacts Found
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        This action will immediately and permanently erase all{' '}
                        <strong className="text-white font-mono">{wipeCount !== null ? wipeCount.toLocaleString() : ''}</strong>{' '}
                        contact records, assigned FMCB IDs, sequential Sr. Nos, and customer metadata for{' '}
                        <strong className="text-rose-300 underline font-bold">"{wipeCompany}"</strong>.
                      </p>
                      <p className="text-[10px] text-rose-400/80 font-semibold">
                        ⚠️ This operation cannot be reversed. Other companies' data will remain untouched.
                      </p>
                    </div>
                  )}

                  {/* Confirmation Input */}
                  {wipeCompany && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-300">
                        To confirm, please type <strong className="text-rose-400 font-mono bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">WIPE</strong> or{' '}
                        <strong className="text-rose-400 font-mono bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">{wipeCompany}</strong> below:
                      </label>
                      <input
                        type="text"
                        value={wipeConfirmText}
                        onChange={(e) => setWipeConfirmText(e.target.value)}
                        disabled={wipeLoading}
                        placeholder={`Type WIPE or ${wipeCompany} to unlock`}
                        className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500 font-mono font-semibold"
                      />
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={handleCloseWipeModal}
                      disabled={wipeLoading}
                      className="px-4 py-2 bg-[#070b14] hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl border border-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleWipeCompanySubmit}
                      disabled={
                        wipeLoading ||
                        !wipeCompany ||
                        (wipeConfirmText.trim().toUpperCase() !== 'WIPE' && wipeConfirmText.trim() !== wipeCompany.trim())
                      }
                      className="px-5 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                    >
                      {wipeLoading ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Initiating Wipe...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 size={13} />
                          <span>Erase All Contacts for {wipeCompany || 'Company'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
