import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export const MasterDataCenter: React.FC = () => {
  const { user, isSuperadmin } = useAuth();
  const { lastEvent } = useSocket();
  const [leads, setLeads] = useState<any[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  
  // Persisted search & filter
  const [search, setSearch] = useState(() => localStorage.getItem('mdc_search') || '');
  const [optinFilter, setOptinFilter] = useState(() => localStorage.getItem('mdc_optin_filter') || 'all');
  
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadReport, setUploadReport] = useState<any>(null);

  useEffect(() => {
    localStorage.setItem('mdc_optin_filter', optinFilter);
    fetchLeads();
    if (isSuperadmin) {
      fetchCompanies();
    }
  }, [page, limit, optinFilter, selectedCompanyFilter]);

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
    if (lastEvent?.type === 'LEADS_UPDATED' || lastEvent?.type === 'PREFERENCES_UPDATED' || lastEvent?.type === 'LEAD_OPTIN_CHANGED') {
      fetchLeads();
    }
  }, [lastEvent]);

  const fetchLeads = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get('/api/leads', {
        params: {
          page,
          limit,
          search,
          optin_filter: optinFilter !== 'all' ? optinFilter : undefined,
          company_name: selectedCompanyFilter !== 'all' ? selectedCompanyFilter : undefined,
        },
      });

      if (res.data.success) {
        setLeads(res.data.data);
        setTotal(res.data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('mdc_search', search);
    setPage(1);
    fetchLeads();
  };

  const handleToggleOptin = async (leadId: string, channel: 'whatsapp' | 'email', currentVal: boolean) => {
    try {
      const res = await axios.post('/api/leads/optin-toggle', {
        lead_id: leadId,
        channel,
        status: !currentVal,
      });

      if (res.data.success) {
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

  const handleBatchDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedLeads.length} selected contacts?`)) return;
    try {
      const res = await axios.delete('/api/leads/batch-delete', {
        data: { lead_ids: selectedLeads },
      });
      if (res.data.success) {
        setSelectedLeads([]);
        fetchLeads();
      }
    } catch (err) {
      alert('Failed to delete selected contacts.');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploadLoading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const res = await axios.post('/api/leads/upload', formData);
      if (res.data.success) {
        setUploadReport(res.data.report);
        fetchLeads();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to ingest contacts.');
    } finally {
      setUploadLoading(false);
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
            <span className="text-xs text-emerald-400 font-semibold">Zero-Duplicate Upsert Engine</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Customer Repository & URN Mapping
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Indexed by phone & email with OmniReach Leads Ground Truth matching and sequential FMCB generation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/api/leads/sample-template"
            target="_blank"
            className="px-3.5 py-2 rounded-xl bg-[#070b14] hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-800"
          >
            <Download size={14} />
            <span>Sample CSV</span>
          </a>
          <button
            onClick={() => {
              setUploadReport(null);
              setUploadFile(null);
              setShowUploadModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 flex items-center gap-1.5 transition-all hover:scale-[1.02]"
          >
            <Upload size={14} />
            <span>Ingest Contacts</span>
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
              placeholder="Search by Name, Phone, Email, URN, FMCB..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#070b14] border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end flex-wrap">
          {isSuperadmin && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <span>Company:</span>
              <select
                value={selectedCompanyFilter}
                onChange={(e) => {
                  setSelectedCompanyFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
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

          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <Filter size={14} />
            <span>Filter Opt-in:</span>
          </div>
          <select
            value={optinFilter}
            onChange={(e) => {
              setOptinFilter(e.target.value);
              setPage(1);
            }}
            className="bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Contacts ({total})</option>
            <option value="whatsapp_optout">WhatsApp Opted-Out</option>
            <option value="email_optout">Email Opted-Out</option>
            <option value="all_optout">Fully Unsubscribed</option>
          </select>

          {isSuperadmin && selectedLeads.length > 0 && (
            <button
              onClick={handleBatchDelete}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 hover:bg-rose-500/20 transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Delete ({selectedLeads.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Master Contacts Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#070b14] text-slate-400 border-b border-slate-800 font-semibold">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={leads.length > 0 && selectedLeads.length === leads.length}
                    className="rounded bg-[#070b14] border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                </th>
                {isSuperadmin && <th className="p-3.5">Company</th>}
                <th className="p-3.5">Customer Name & City</th>
                <th className="p-3.5">URN / Sequential FMCB</th>
                <th className="p-3.5">Phone & Email</th>
                <th className="p-3.5">WhatsApp Opt-in</th>
                <th className="p-3.5">Email Opt-in</th>
                <th className="p-3.5">Lifetime Engagement</th>
                <th className="p-3.5">Last Contacted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={isSuperadmin ? 9 : 8} className="p-8 text-center text-slate-500">
                    No contacts found matching your query.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className={`hover:bg-[#070b14]/50 transition-colors ${
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
                    {isSuperadmin && (
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-cyan-300 border border-slate-700">
                          {lead.company_name}
                        </span>
                      </td>
                    )}
                    <td className="p-3.5">
                      <div className="font-bold text-white">{lead.full_name}</div>
                      <div className="text-[11px] text-slate-400">{lead.city || lead.address || 'India'}</div>
                    </td>
                    <td className="p-3.5">
                      {lead.urn ? (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-500/10 text-purple-400 border border-purple-500/30 font-mono">
                          {lead.urn}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
                          {lead.fmcb_id}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <div className="font-mono text-slate-200 flex items-center gap-1 font-semibold">
                        <Smartphone size={12} className="text-emerald-400" />
                        <span>+{lead.phone}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Mail size={12} className="text-blue-400" />
                        <span>{lead.email || 'No email registered'}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={() => handleToggleOptin(lead.id, 'whatsapp', lead.whatsapp_optin)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1.5 ${
                          lead.whatsapp_optin
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                        }`}
                      >
                        {lead.whatsapp_optin ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        <span>{lead.whatsapp_optin ? 'Opted-In' : 'Opted-Out'}</span>
                      </button>
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={() => handleToggleOptin(lead.id, 'email', lead.email_optin)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1.5 ${
                          lead.email_optin
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20'
                        }`}
                      >
                        {lead.email_optin ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        <span>{lead.email_optin ? 'Opted-In' : 'Opted-Out'}</span>
                      </button>
                    </td>
                    <td className="p-3.5">
                      <div className="text-[11px] text-slate-300">
                        WA: <span className="font-bold text-emerald-400">{lead.whatsapp_sent_count || 0}</span> | Email: <span className="font-bold text-blue-400">{lead.email_sent_count || 0}</span>
                      </div>
                      <div className="text-[10px] text-amber-400 font-semibold">
                        Clicks: {lead.clicked_count || 0}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-400 text-[11px]">
                      {lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleDateString() : 'Never'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-6 py-4 bg-[#070b14] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-medium">
          <div>
            Showing {leads.length} of {total} contacts
          </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 rounded-lg bg-[#0f172a] border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-slate-300 shadow-sm"
            >
              Previous
            </button>
            <span className="text-white font-bold">Page {page}</span>
            <button
              disabled={page * limit >= total}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 rounded-lg bg-[#0f172a] border border-slate-800 disabled:opacity-40 hover:bg-slate-800 text-slate-300 shadow-sm"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* CSV / Excel Ingest Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
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
                  Supported columns: Full Name, Phone, Email, Address, PAN, City
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

              {uploadReport && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2 text-xs">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 size={15} />
                    Ingestion Succeeded: {uploadReport.totalProcessed} Contacts
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="text-slate-300">New Created: <span className="font-bold text-emerald-400">{uploadReport.newInserted}</span></div>
                    <div className="text-slate-300">Updated: <span className="font-bold text-blue-400">{uploadReport.updatedExisting}</span></div>
                    <div className="text-slate-300">URN Mapped: <span className="font-bold text-purple-400">{uploadReport.matchedUrnCount}</span></div>
                    <div className="text-slate-300">FMCB Assigned: <span className="font-bold text-cyan-400">{uploadReport.newFmcbCount}</span></div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-[#070b14] hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl border border-slate-800"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || uploadLoading}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg disabled:opacity-50"
                >
                  {uploadLoading ? 'Processing...' : 'Start Ingestion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
