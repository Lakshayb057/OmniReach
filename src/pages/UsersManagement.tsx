import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  UserCheck,
  PlusCircle,
  Search,
  Building2,
  Crown,
  Shield,
  Trash2,
  Edit2,
  CheckCircle2,
  X,
  Lock,
  Mail,
  User as UserIcon,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Key,
  Smartphone,
  Play,
  Save,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';

export const UsersManagement: React.FC = () => {
  const { user: currentUser, isSuperadmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'companies'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [detailedCompanies, setDetailedCompanies] = useState<any[]>([]);
  const [companyGatewaysSummary, setCompanyGatewaysSummary] = useState<Record<string, any[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State for User Create/Edit
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  // Modal State for Company Gateway & API Keys Config
  const [gatewayModalCompany, setGatewayModalCompany] = useState<string | null>(null);
  const [companyGateways, setCompanyGateways] = useState<any[]>([]);
  const [editingCompanyCreds, setEditingCompanyCreds] = useState<Record<string, any>>({});
  const [savingGatewayId, setSavingGatewayId] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [testingGwId, setTestingGwId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'superadmin'>('admin');
  const [companyName, setCompanyName] = useState('OmniReach Global');
  const [isCustomCompany, setIsCustomCompany] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchCompanies();
    fetchDetailedCompanies();
    fetchGatewaysSummary();
  }, [selectedCompanyFilter]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get('/api/auth/users', {
        params: { company_name: selectedCompanyFilter },
      });
      if (res.data.success) {
        setUsers(res.data.users);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

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

  const fetchDetailedCompanies = async () => {
    try {
      const res = await axios.get('/api/auth/companies-detailed');
      if (res.data.success) {
        setDetailedCompanies(res.data.companies);
      }
    } catch (err) {
      console.error('Failed to load detailed companies:', err);
    }
  };

  const fetchGatewaysSummary = async () => {
    try {
      const res = await axios.get('/api/gateways/company-summary');
      if (res.data.success) {
        setCompanyGatewaysSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Failed to load gateways summary:', err);
    }
  };

  const handleDeleteCompany = async (cName: string) => {
    if (cName === 'OmniReach Global') {
      alert('OmniReach Global is the core system platform and cannot be deleted.');
      return;
    }

    const confirmMsg = `🚨 PERMANENT DATABASE PURGE 🚨\n\nAre you sure you want to completely delete company "${cName}"?\n\nThis will permanently remove:\n• All WhatsApp & Email Gateways\n• All Templates & Dynamic Content\n• All Broadcast Campaigns & Delivery Audit Logs\n• All Master Contacts & Lead Lists\n• All Automated Journeys & Step Logs\n• All Admin & User Accounts for "${cName}"\n\nThis action cannot be undone. Proceed?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await axios.delete(`/api/auth/companies/${encodeURIComponent(cName)}`);
      if (res.data.success) {
        alert(res.data.message || `Company '${cName}' and all related data purged completely.`);
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
        fetchDetailedCompanies();
        fetchUsers();
        fetchCompanies();
        fetchGatewaysSummary();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete company.');
    }
  };

  const handleOpenGatewayModal = async (comp: string) => {
    setGatewayModalCompany(comp);
    setSaveSuccessMsg(null);
    setTestResult(null);
    try {
      const res = await axios.get('/api/gateways', { params: { company_name: comp } });
      if (res.data.success) {
        setCompanyGateways(res.data.gateways);
        const map: Record<string, any> = {};
        for (const gw of res.data.gateways) {
          map[gw.id] = { ...gw.credentials, name: gw.name };
        }
        setEditingCompanyCreds(map);
      }
    } catch (err) {
      console.error('Failed to load gateways for company:', err);
    }
  };

  const handleSaveCompanyGateway = async (gw: any) => {
    const creds = editingCompanyCreds[gw.id] || gw.credentials || {};
    const { name, ...credentials } = creds;
    setSavingGatewayId(gw.id);
    try {
      const res = await axios.put(`/api/gateways/${gw.id}`, {
        name: name || gw.name,
        company_name: gatewayModalCompany,
        credentials,
        type: gw.type,
      });
      if (res.data.success) {
        setSaveSuccessMsg(`Saved API keys for ${gw.name} to PostgreSQL.`);
        fetchGatewaysSummary();
        setTimeout(() => setSaveSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save gateway.');
    } finally {
      setSavingGatewayId(null);
    }
  };

  const handleTestCompanyGateway = async (gw: any) => {
    const creds = editingCompanyCreds[gw.id] || gw.credentials || {};
    setTestingGwId(gw.id);
    setTestResult(null);
    try {
      if (gw.type === 'whatsapp_meta') {
        const res = await axios.post('/api/gateways/test-whatsapp', {
          phone_number_id: creds.phone_number_id,
          system_user_token: creds.system_user_token,
          waba_id: creds.waba_id,
        });
        setTestResult({ success: true, message: res.data.message });
      } else if (gw.type === 'email_ses') {
        const res = await axios.post('/api/gateways/test-ses', {
          access_key_id: creds.access_key_id,
          secret_access_key: creds.secret_access_key,
          region: creds.region,
          from_email: creds.from_email,
        });
        setTestResult({ success: true, message: res.data.message });
      } else if (gw.type === 'email_resend') {
        const res = await axios.post('/api/gateways/test-resend', {
          api_key: creds.api_key,
          from_email: creds.from_email,
        });
        setTestResult({ success: res.data.success, message: res.data.message });
      } else if (gw.type === 'email_smtp') {
        const res = await axios.post('/api/gateways/test-smtp', {
          host: creds.host,
          port: creds.port,
          user: creds.user,
          pass: creds.pass,
          secure: creds.secure,
        });
        setTestResult({ success: res.data.success, message: res.data.message });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.response?.data?.message || 'Test failed.' });
    } finally {
      setTestingGwId(null);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setRole('admin');
    setCompanyName('');
    setFormError('');
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (u: any) => {
    setEditingUser(u);
    setFullName(u.full_name);
    setEmail(u.email);
    setPassword('');
    setRole(u.role);
    setCompanyName(u.company_name || 'OmniReach Global');
    setFormError('');
    setShowCreateModal(true);
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) {
      setFormError('Name and email are required.');
      return;
    }

    if (!editingUser && !password) {
      setFormError('Password is required when creating a new user.');
      return;
    }

    if (role === 'admin' && !companyName.trim()) {
      setFormError('Company Name is required for Company Admin accounts.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (editingUser) {
        const res = await axios.put(`/api/auth/users/${editingUser.id}`, {
          full_name: fullName,
          role,
          company_name: companyName.trim() || 'OmniReach Global',
          password: password.trim() ? password : undefined,
        });
        if (res.data.success) {
          setShowCreateModal(false);
          fetchUsers();
          fetchCompanies();
          fetchGatewaysSummary();
        }
      } else {
        const res = await axios.post('/api/auth/users', {
          full_name: fullName,
          email: email.trim().toLowerCase(),
          password,
          role,
          company_name: companyName.trim() || (role === 'superadmin' ? 'OmniReach Global' : 'Independent Enterprise'),
        });
        if (res.data.success) {
          confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
          setShowCreateModal(false);
          fetchUsers();
          fetchCompanies();
          fetchGatewaysSummary();
        }
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (u: any) => {
    try {
      const res = await axios.put(`/api/auth/users/${u.id}`, {
        is_active: !u.is_active,
      });
      if (res.data.success) {
        setUsers((prev) =>
          prev.map((item) => (item.id === u.id ? { ...item, is_active: !u.is_active } : item))
        );
      }
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  const handleDeleteUser = async (u: any) => {
    const isCompanyAdmin = u.role !== 'superadmin' && u.company_name && u.company_name !== 'OmniReach Global';
    const confirmMsg = isCompanyAdmin
      ? `⚠️ PERMANENT CASCADE DELETE: Deleting admin ${u.full_name} (${u.email}) will also completely purge ALL data (Gateways, Templates, Campaigns, Contacts, Journeys) for company '${u.company_name}' from the PostgreSQL database!\n\nAre you sure you want to proceed?`
      : `Are you sure you want to delete user ${u.full_name} (${u.email})?`;

    if (!confirm(confirmMsg)) return;
    try {
      const res = await axios.delete(`/api/auth/users/${u.id}`);
      if (res.data.success) {
        alert(res.data.message || 'User and all associated company data removed successfully.');
        fetchUsers();
        fetchCompanies();
        fetchGatewaysSummary();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete user.');
    }
  };

  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.company_name?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto animate-fadeIn select-none">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0f172a] p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <span className="text-xs font-bold text-violet-400 bg-violet-500/10 px-2.5 py-0.5 rounded-full border border-violet-500/30">
              Superadmin Identity & Access
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-cyan-400 font-semibold">Multi-Tenant Company Segregation</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            User & Company Admin Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Partition administrators by company, allocate dedicated WhatsApp & Email API keys, and monitor tenant health
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenCreateModal}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all hover:scale-[1.02]"
          >
            <PlusCircle size={15} />
            <span>Create Company Admin</span>
          </button>
        </div>
      </div>

      {/* Top Cybernetic Navigation Tabs */}
      <div className="flex items-center space-x-3 border-b border-slate-200 dark:border-slate-800/80 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'users'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 border border-cyan-400/40'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#0c1322] border border-transparent'
          }`}
        >
          <UserCheck size={15} />
          <span>Company Admins & Users ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('companies')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'companies'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 border border-cyan-400/40'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#0c1322] border border-transparent'
          }`}
        >
          <Building2 size={15} />
          <span>Tenant Companies & Partitions ({detailedCompanies.length || companies.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: USERS & COMPANY ADMINS VIEW                                        */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm dark:shadow-md">
            <div className="flex items-center gap-3 w-full md:w-auto">
              {/* Search Box */}
              <div className="relative w-full md:w-72">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Company Filter Selector */}
              <select
                value={selectedCompanyFilter}
                onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500"
              >
                <option value="all">🏢 All Companies ({companies.length})</option>
                {companies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Total Registered Admins: <strong className="text-slate-900 dark:text-white font-mono">{users.length}</strong></span>
              <RefreshCw size={13} className="cursor-pointer hover:text-blue-500 ml-2" onClick={fetchUsers} />
            </div>
          </div>

          {/* Users Data Table */}
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm dark:shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#070b14] text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                  <tr>
                    <th className="p-4">User Details</th>
                    <th className="p-4">Assigned Company</th>
                    <th className="p-4">Allocated Gateways & API Status</th>
                    <th className="p-4">Role & Access</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No users found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const compGws = companyGatewaysSummary[u.company_name] || [];
                      const waGw = compGws.find((g: any) => g.type.includes('whatsapp'));
                      const emailGw = compGws.find((g: any) => g.type.includes('email'));

                      return (
                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-[#070b14]/50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shrink-0 font-bold shadow-md">
                                {u.role === 'superadmin' ? <Crown size={15} className="text-amber-300" /> : u.full_name?.charAt(0) || 'U'}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white text-sm">{u.full_name}</div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 font-semibold text-xs">
                              <Building2 size={12} className="text-cyan-600 dark:text-cyan-400" />
                              <span>{u.company_name || 'OmniReach Global'}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1 text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  WA: {waGw ? `${waGw.name.slice(0, 20)}...` : 'Shared Global Gateway'}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  Email: {emailGw ? `${emailGw.name.slice(0, 20)}...` : 'Shared SES High-Vol'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            {u.role === 'superadmin' ? (
                              <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40">
                                👑 SUPERADMIN
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/40">
                                🏢 COMPANY ADMIN
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-colors cursor-pointer ${
                                u.is_active
                                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                                  : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                              <span>{u.is_active ? 'ACTIVE' : 'DEACTIVATED'}</span>
                            </button>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenGatewayModal(u.company_name || 'OmniReach Global')}
                                className="p-1.5 text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-lg transition-colors border border-cyan-200 dark:border-cyan-500/20 cursor-pointer"
                                title="Configure Company API Keys & Gateways"
                              >
                                <Key size={14} />
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(u)}
                                className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                                title="Edit User"
                              >
                                <Edit2 size={14} />
                              </button>
                              {u.id !== currentUser?.id && (
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Delete User & Purge Company Data"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TENANT COMPANIES & FULL CASCADE DELETION VIEW                      */}
      {/* ========================================================================= */}
      {activeTab === 'companies' && (
        <div className="space-y-6">
          {/* Quick Summary Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Companies</p>
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">{detailedCompanies.length}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Isolated tenant partitions</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <Building2 size={22} />
              </div>
            </div>

            <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Gateways</p>
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {detailedCompanies.reduce((acc, c) => acc + (c.gateways_count || 0), 0)}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Dedicated Meta & SES keys</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Key size={22} />
              </div>
            </div>

            <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Partitioned Contacts</p>
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {detailedCompanies.reduce((acc, c) => acc + (c.leads_count || 0), 0)}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Zero-duplicate audience pool</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Smartphone size={22} />
              </div>
            </div>

            <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Automations</p>
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                  {detailedCompanies.reduce((acc, c) => acc + (c.journeys_count || 0), 0)}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Campaigns & flow pipelines</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Play size={22} />
              </div>
            </div>
          </div>

          {/* Companies List Table */}
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm dark:shadow-xl">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 size={16} className="text-cyan-500" />
                  <span>Tenant Company Partitions ({detailedCompanies.length})</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage company partitions. Deleting a company permanently removes all its gateways, templates, broadcasts, contacts, and admin users from the database.
                </p>
              </div>
              <button
                onClick={fetchDetailedCompanies}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#070b14] hover:bg-slate-200 dark:hover:bg-[#0c1322] border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Refresh Partitions</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-[#070b14] text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                  <tr>
                    <th className="p-4">Company Name & Partition</th>
                    <th className="p-4 text-center">Admins</th>
                    <th className="p-4 text-center">Gateways</th>
                    <th className="p-4 text-center">Templates</th>
                    <th className="p-4 text-center">Broadcasts</th>
                    <th className="p-4 text-center">Master Contacts</th>
                    <th className="p-4 text-center">Journeys</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
                  {detailedCompanies.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No company partitions found.
                      </td>
                    </tr>
                  ) : (
                    detailedCompanies.map((c) => {
                      const isRoot = c.company_name === 'OmniReach Global';

                      return (
                        <tr key={c.company_name} className="hover:bg-slate-50 dark:hover:bg-[#070b14]/50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center space-x-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-md ${
                                isRoot
                                  ? 'bg-gradient-to-tr from-amber-500 to-orange-600'
                                  : 'bg-gradient-to-tr from-cyan-600 to-blue-600'
                              }`}>
                                {isRoot ? <Crown size={16} className="text-amber-200" /> : <Building2 size={16} />}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                                  <span>{c.company_name}</span>
                                  {isRoot ? (
                                    <span className="text-[9px] font-black bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40 px-1.5 py-0.2 rounded">
                                      SYSTEM ROOT
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/40 px-1.5 py-0.2 rounded">
                                      TENANT PARTITION
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {isRoot ? 'Global platform partition' : `Dedicated company workspace for ${c.company_name}`}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="p-4 text-center font-mono font-bold text-slate-900 dark:text-white">
                            {c.users_count}
                          </td>
                          <td className="p-4 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                            {c.gateways_count}
                          </td>
                          <td className="p-4 text-center font-mono font-bold text-amber-600 dark:text-amber-400">
                            {c.templates_count}
                          </td>
                          <td className="p-4 text-center font-mono font-bold text-purple-600 dark:text-purple-400">
                            {c.broadcasts_count}
                          </td>
                          <td className="p-4 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {c.leads_count}
                          </td>
                          <td className="p-4 text-center font-mono font-bold text-cyan-600 dark:text-cyan-400">
                            {c.journeys_count}
                          </td>

                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenGatewayModal(c.company_name)}
                                className="p-2 text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 rounded-xl transition-colors border border-cyan-200 dark:border-cyan-500/20 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                                title="Configure WhatsApp & Email API Keys"
                              >
                                <Key size={13} />
                                <span>API Keys</span>
                              </button>

                              {!isRoot && (
                                <button
                                  onClick={() => handleDeleteCompany(c.company_name)}
                                  className="p-2 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors border border-rose-200 dark:border-rose-500/30 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                                  title="Delete Company & Cascade Purge All Database Records"
                                >
                                  <Trash2 size={13} />
                                  <span>Delete Company</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Company API Keys & Gateways Manager */}
      {gatewayModalCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-3xl bg-[#0f172a] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 bg-[#070b14] border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Key size={16} className="text-cyan-400" />
                  <span>Allotted API Keys & Gateways: {gatewayModalCompany}</span>
                </h3>
                <p className="text-xs text-slate-400">Configure WhatsApp tokens and SES/SMTP credentials allocated for this company</p>
              </div>
              <button
                onClick={() => setGatewayModalCompany(null)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 rounded-xl font-bold flex items-center gap-2">
                  <CheckCircle2 size={15} />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {testResult && (
                <div className={`p-3 rounded-xl border font-semibold flex items-center gap-2 ${testResult.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`}>
                  {testResult.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span>{testResult.message}</span>
                </div>
              )}

              {companyGateways.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-[#070b14] rounded-2xl border border-slate-800">
                  <Key size={30} className="mx-auto mb-2 opacity-40 text-cyan-400" />
                  <p>No dedicated gateways yet for {gatewayModalCompany}. This company currently inherits the global default gateway pool.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Visit Superadmin Settings $\rightarrow$ Gateway Vault to allocate dedicated gateways.</p>
                </div>
              ) : (
                companyGateways.map((gw) => {
                  const creds = editingCompanyCreds[gw.id] || gw.credentials || {};
                  return (
                    <div key={gw.id} className="p-4 bg-[#070b14] border border-slate-800 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          {gw.type.includes('whatsapp') ? <Smartphone size={16} className="text-emerald-400" /> : <Mail size={16} className="text-blue-400" />}
                          <span className="font-bold text-white text-sm">{gw.name}</span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">{gw.type}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleTestCompanyGateway(gw)}
                            disabled={testingGwId === gw.id}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-[11px] flex items-center gap-1"
                          >
                            <Play size={11} />
                            <span>{testingGwId === gw.id ? 'Testing...' : 'Test'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveCompanyGateway(gw)}
                            disabled={savingGatewayId === gw.id}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1"
                          >
                            <Save size={11} />
                            <span>{savingGatewayId === gw.id ? 'Saving...' : 'Save Keys'}</span>
                          </button>
                        </div>
                      </div>

                      {/* WhatsApp Meta Fields */}
                      {gw.type === 'whatsapp_meta' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1">Phone Number ID</label>
                            <input
                              type="text"
                              value={creds.phone_number_id || ''}
                              onChange={(e) => setEditingCompanyCreds({ ...editingCompanyCreds, [gw.id]: { ...creds, phone_number_id: e.target.value } })}
                              className="w-full px-3 py-1.5 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1">WABA ID</label>
                            <input
                              type="text"
                              value={creds.waba_id || ''}
                              onChange={(e) => setEditingCompanyCreds({ ...editingCompanyCreds, [gw.id]: { ...creds, waba_id: e.target.value } })}
                              className="w-full px-3 py-1.5 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-slate-400 font-semibold mb-1">System User Access Token</label>
                            <input
                              type="password"
                              value={creds.system_user_token || ''}
                              onChange={(e) => setEditingCompanyCreds({ ...editingCompanyCreds, [gw.id]: { ...creds, system_user_token: e.target.value } })}
                              className="w-full px-3 py-1.5 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                            />
                          </div>
                        </div>
                      )}

                      {/* AWS SES Fields */}
                      {gw.type === 'email_ses' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1">AWS Access Key ID</label>
                            <input
                              type="text"
                              value={creds.access_key_id || ''}
                              onChange={(e) => setEditingCompanyCreds({ ...editingCompanyCreds, [gw.id]: { ...creds, access_key_id: e.target.value } })}
                              className="w-full px-3 py-1.5 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1">AWS Secret Key</label>
                            <input
                              type="password"
                              value={creds.secret_access_key || ''}
                              onChange={(e) => setEditingCompanyCreds({ ...editingCompanyCreds, [gw.id]: { ...creds, secret_access_key: e.target.value } })}
                              className="w-full px-3 py-1.5 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1">Region</label>
                            <input
                              type="text"
                              value={creds.region || 'ap-south-1'}
                              onChange={(e) => setEditingCompanyCreds({ ...editingCompanyCreds, [gw.id]: { ...creds, region: e.target.value } })}
                              className="w-full px-3 py-1.5 bg-[#0c1322] border border-slate-800 rounded-xl text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1">From Email</label>
                            <input
                              type="email"
                              value={creds.from_email || ''}
                              onChange={(e) => setEditingCompanyCreds({ ...editingCompanyCreds, [gw.id]: { ...creds, from_email: e.target.value } })}
                              className="w-full px-3 py-1.5 bg-[#0c1322] border border-slate-800 rounded-xl text-white"
                            />
                          </div>
                        </div>
                      )}

                      {/* Resend 3rd-Party API Fields */}
                      {gw.type === 'email_resend' && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1">Resend API Key (re_...)</label>
                            <input
                              type="password"
                              value={creds.api_key || ''}
                              onChange={(e) => setEditingCompanyCreds({ ...editingCompanyCreds, [gw.id]: { ...creds, api_key: e.target.value } })}
                              placeholder="re_123456789..."
                              className="w-full px-3 py-1.5 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-slate-400 font-semibold mb-1">From Sender Email</label>
                              <input
                                type="email"
                                value={creds.from_email || ''}
                                onChange={(e) => setEditingCompanyCreds({ ...editingCompanyCreds, [gw.id]: { ...creds, from_email: e.target.value } })}
                                placeholder="onboarding@resend.dev"
                                className="w-full px-3 py-1.5 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-400 font-semibold mb-1">From Sender Name</label>
                              <input
                                type="text"
                                value={creds.from_name || ''}
                                onChange={(e) => setEditingCompanyCreds({ ...editingCompanyCreds, [gw.id]: { ...creds, from_name: e.target.value } })}
                                placeholder="Acme Support"
                                className="w-full px-3 py-1.5 bg-[#0c1322] border border-slate-800 rounded-xl text-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Multi-SMTP Relay Fields */}
                      {gw.type === 'email_smtp' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1">SMTP Host</label>
                            <input
                              type="text"
                              value={creds.host || ''}
                              onChange={(e) => setEditingCompanyCreds({ ...editingCompanyCreds, [gw.id]: { ...creds, host: e.target.value } })}
                              className="w-full px-3 py-1.5 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1">Port</label>
                            <input
                              type="number"
                              value={creds.port || 587}
                              onChange={(e) => setEditingCompanyCreds({ ...editingCompanyCreds, [gw.id]: { ...creds, port: parseInt(e.target.value) } })}
                              className="w-full px-3 py-1.5 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1">User</label>
                            <input
                              type="text"
                              value={creds.user || ''}
                              onChange={(e) => setEditingCompanyCreds({ ...editingCompanyCreds, [gw.id]: { ...creds, user: e.target.value } })}
                              className="w-full px-3 py-1.5 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 font-semibold mb-1">Password</label>
                            <input
                              type="password"
                              value={creds.pass || ''}
                              onChange={(e) => setEditingCompanyCreds({ ...editingCompanyCreds, [gw.id]: { ...creds, pass: e.target.value } })}
                              className="w-full px-3 py-1.5 bg-[#0c1322] border border-slate-800 rounded-xl text-white font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-6 py-3 bg-[#070b14] border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setGatewayModalCompany(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Close Manager
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">
                    {editingUser ? 'Edit Administrator Profile' : 'Create Company Administrator'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Assign company name to restrict access to isolated tenant data
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitUser} className="space-y-4 text-xs">
              {/* Full Name */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Sarah Jenkins"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#070b14] border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    disabled={!!editingUser}
                    placeholder="e.g. admin@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#070b14] border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Account Role</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                      role === 'admin'
                        ? 'bg-blue-600/15 border-blue-500 text-blue-400 shadow-md'
                        : 'bg-[#070b14] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Building2 size={15} />
                    <span>Company Admin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole('superadmin');
                      setCompanyName('OmniReach Global');
                    }}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                      role === 'superadmin'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-md'
                        : 'bg-[#070b14] border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Crown size={15} />
                    <span>Superadmin</span>
                  </button>
                </div>
              </div>

              {/* Company Name (Database-Connected Dropdown) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400 font-semibold flex items-center gap-1.5">
                    <Building2 size={13} className="text-cyan-400" />
                    <span>Assigned Company Workspace <span className="text-rose-400">*</span></span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomCompany(!isCustomCompany);
                      if (!isCustomCompany) {
                        setCompanyName('');
                      } else {
                        setCompanyName(companies[0] || 'OmniReach Global');
                      }
                    }}
                    className="text-cyan-400 hover:text-cyan-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {isCustomCompany ? '← Pick from DB' : '+ New Company'}
                  </button>
                </div>

                {!isCustomCompany ? (
                  <select
                    value={companyName || (companies[0] || 'OmniReach Global')}
                    onChange={(e) => {
                      if (e.target.value === '__NEW_COMPANY__') {
                        setIsCustomCompany(true);
                        setCompanyName('');
                      } else {
                        setCompanyName(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 font-semibold text-xs"
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
                  <div className="relative">
                    <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="Enter company / client organization name"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-[#070b14] border border-cyan-500 rounded-xl text-white placeholder-slate-500 focus:outline-none ring-1 ring-cyan-500/30"
                    />
                  </div>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1">
                  {editingUser ? 'Reset Password (Leave blank to keep existing)' : 'Account Password'}
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#070b14] border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-blue-600/25 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingUser ? 'Update Profile' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
