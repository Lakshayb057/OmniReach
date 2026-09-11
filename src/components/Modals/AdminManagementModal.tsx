import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, ShieldCheck, UserPlus, Trash2, Key, History, Crown, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AdminManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminManagementModal: React.FC<AdminManagementModalProps> = ({ isOpen, onClose }) => {
  const { isSuperadmin } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'admins' | 'logs'>('admins');
  const [isLoading, setIsLoading] = useState(false);

  // New Admin Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'operator'>('admin');
  const [permissions, setPermissions] = useState({
    manage_campaigns: true,
    manage_leads: true,
    manage_templates: true,
    manage_gateways: false,
  });

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      fetchAuditLogs();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/auth/users');
      if (res.data.success) {
        setUsers(res.data.users);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
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

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await axios.post('/api/auth/users', {
        email,
        password,
        full_name: fullName,
        role,
        permissions,
      });
      if (res.data.success) {
        setShowCreateForm(false);
        setEmail('');
        setPassword('');
        setFullName('');
        fetchUsers();
        fetchAuditLogs();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create admin.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to remove this administrator?')) return;
    try {
      const res = await axios.delete(`/api/auth/users/${id}`);
      if (res.data.success) {
        fetchUsers();
        fetchAuditLogs();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete user.');
    }
  };

  const handleToggleStatus = async (user: any) => {
    try {
      await axios.put(`/api/auth/users/${user.id}`, {
        is_active: !user.is_active,
      });
      fetchUsers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update user status.');
    }
  };

  if (!isOpen || !isSuperadmin) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold">
              <Crown size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Superadmin Control Panel & RBAC
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 font-extrabold uppercase">
                  Full Authority
                </span>
              </h2>
              <p className="text-xs text-slate-400">Manage administrator privileges, access control, and audit logs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-2 bg-slate-950 border-b border-slate-800 flex items-center space-x-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('admins')}
            className={`py-2 px-3 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'admins' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck size={14} />
            <span>Administrators ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-2 px-3 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'logs' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History size={14} />
            <span>Security Audit Logs</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'admins' ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-slate-400">
                  Superadmin has supreme rights over all administrators and gateways.
                </span>
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/20 transition-colors"
                >
                  <UserPlus size={14} />
                  <span>{showCreateForm ? 'Cancel' : 'Add New Admin'}</span>
                </button>
              </div>

              {/* Create Admin Form */}
              {showCreateForm && (
                <form onSubmit={handleCreateAdmin} className="p-4 bg-slate-900 border border-slate-800 rounded-xl mb-4 space-y-3">
                  <h4 className="text-xs font-bold text-blue-400">Create New Administrator</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Aditi Roy"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Email Address</label>
                      <input
                        type="email"
                        required
                        placeholder="admin@omnireach.io"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Password</label>
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">Role</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                      >
                        <option value="admin">Administrator (Campaigns & Leads)</option>
                        <option value="operator">Operator (View & Export Only)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
                    >
                      {isLoading ? 'Creating...' : 'Save Administrator'}
                    </button>
                  </div>
                </form>
              )}

              {/* Users Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 font-semibold">
                    <tr>
                      <th className="p-3">User</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Created</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-900/40">
                        <td className="p-3">
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            {u.full_name}
                            {u.role === 'superadmin' && (
                              <Crown size={13} className="text-amber-400" />
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">{u.email}</div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              u.role === 'superadmin'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => u.role !== 'superadmin' && handleToggleStatus(u)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              u.is_active
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {u.is_active ? 'Active' : 'Suspended'}
                          </button>
                        </td>
                        <td className="p-3 text-slate-400 text-[11px]">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right">
                          {u.role !== 'superadmin' && (
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                              title="Delete Admin"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Audit Logs View */
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-200 flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded font-mono text-[10px]">
                        {log.action}
                      </span>
                      <span>by {log.admin_name || log.admin_email || 'Superadmin'}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Entity: {log.entity_type} {log.entity_id ? `(${log.entity_id})` : ''} • IP: {log.ip_address || '127.0.0.1'}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
