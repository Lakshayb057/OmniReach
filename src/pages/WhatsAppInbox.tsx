import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  MessageSquare,
  Send,
  User,
  Users,
  Clock,
  CheckCheck,
  Check,
  AlertTriangle,
  Lock,
  Search,
  RefreshCw,
  Sparkles,
  Bot,
  UserCheck,
  Phone,
  Mail,
  Shield,
  FileText,
  Paperclip,
  Smile,
  Zap,
  MoreVertical,
  ChevronDown,
  Building2,
  Tag,
  AlertCircle,
  Play,
  ArrowRight,
  ExternalLink,
  PlusCircle,
  X,
  Flame,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import confetti from 'canvas-confetti';

interface Conversation {
  id: string;
  company_name: string;
  master_lead_id?: string;
  phone: string;
  contact_name: string;
  status: 'open' | 'bot_handling' | 'pending' | 'resolved';
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  unread_count: number;
  last_message_text: string;
  last_message_at: string;
  session_expires_at: string;
  is_session_active: boolean;
  session_remaining_ms: number;
  urn?: string;
  fmcb_id?: string;
  lead_email?: string;
  city?: string;
  pan_no?: string;
  whatsapp_optin?: boolean;
  email_optin?: boolean;
  clicked_count?: number;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  whatsapp_message_id?: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'customer' | 'agent' | 'bot' | 'system';
  sender_id?: string;
  sender_name: string;
  message_type: 'text' | 'image' | 'video' | 'document' | 'template' | 'interactive_button' | 'interactive_list' | 'note';
  content: string;
  media_url?: string;
  template_name?: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  metadata?: any;
  created_at: string;
}

interface CannedResponse {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  category: string;
}

export const WhatsAppInbox: React.FC = () => {
  const { user, isSuperadmin } = useAuth();
  const { socket, lastEvent } = useSocket();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<any>({});
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeJourney, setActiveJourney] = useState<any | null>(null);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [activeWhatsAppGw, setActiveWhatsAppGw] = useState<any | null>(null);
  const [whatsappGateways, setWhatsappGateways] = useState<any[]>([]);
  const [selectedConvIds, setSelectedConvIds] = useState<string[]>([]);
  const [isDeletingConv, setIsDeletingConv] = useState(false);

  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  const [companiesList, setCompaniesList] = useState<string[]>([]);

  const [activeView, setActiveView] = useState<'all' | 'mine' | 'unassigned' | 'bot_handling' | 'pending' | 'resolved' | 'urgent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Composer State
  const [inputText, setInputText] = useState('');
  const [isPrivateNote, setIsPrivateNote] = useState(false);
  const [showCannedPicker, setShowCannedPicker] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  // Simulated Inbound Tester Modal
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simText, setSimText] = useState('');
  const [simPhone, setSimPhone] = useState('+91 98765 43210');
  const [simName, setSimName] = useState('Rahul Sharma');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch Conversations & Metadata
  useEffect(() => {
    fetchConversations();
    fetchCannedResponses();
    fetchTemplates();
    fetchAgents();
    fetchJourneys();
    fetchGateways();
    if (isSuperadmin) {
      fetchCompanies();
    }
  }, [activeView, searchQuery, selectedCompanyFilter]);

  const fetchCompanies = async () => {
    try {
      const res = await axios.get('/api/auth/companies');
      if (res.data.success) {
        setCompaniesList(res.data.companies || []);
      }
    } catch (err) {
      console.error('Failed to load companies in inbox:', err);
    }
  };

  // Real-time WebSocket Listeners
  useEffect(() => {
    if (!lastEvent) return;
    const data = lastEvent.data || lastEvent;
    if (
      data?.type === 'INBOX_MESSAGE_RECEIVED' ||
      data?.type === 'INBOX_MESSAGE_SENT' ||
      data?.type === 'INBOX_NOTE_ADDED' ||
      data?.type === 'CONVERSATION_UPDATED' ||
      data?.type === 'CONVERSATION_HANDOVER'
    ) {
      fetchConversations(false);
      if (selectedConv && data.conversation_id === selectedConv.id) {
        loadConversationDetails(selectedConv.id, false);
      }
    } else if (data?.type === 'INBOX_MESSAGE_STATUS') {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === data.message_id || (data.whatsapp_message_id && m.whatsapp_message_id === data.whatsapp_message_id)) {
            return { ...m, status: data.status };
          }
          return m;
        })
      );
    } else if (data?.type === 'CONVERSATION_DELETED') {
      const deletedId = data.conversation_id;
      setConversations((prev) => prev.filter((c) => c.id !== deletedId));
      setSelectedConvIds((prev) => prev.filter((id) => id !== deletedId));
      if (selectedConv?.id === deletedId) {
        setSelectedConv(null);
        setMessages([]);
      }
    }
  }, [lastEvent]);

  // Direct socket listener
  useEffect(() => {
    if (!socket) return;

    const handleBroadcastUpdate = (data: any) => {
      if (
        data.type === 'INBOX_MESSAGE_RECEIVED' ||
        data.type === 'INBOX_MESSAGE_SENT' ||
        data.type === 'INBOX_NOTE_ADDED' ||
        data.type === 'CONVERSATION_UPDATED' ||
        data.type === 'CONVERSATION_HANDOVER'
      ) {
        fetchConversations(false);
        if (selectedConv && data.conversation_id === selectedConv.id) {
          loadConversationDetails(selectedConv.id, false);
        }
      } else if (data.type === 'INBOX_MESSAGE_STATUS') {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === data.message_id || (data.whatsapp_message_id && m.whatsapp_message_id === data.whatsapp_message_id)) {
              return { ...m, status: data.status };
            }
            return m;
          })
        );
      } else if (data.type === 'CONVERSATION_DELETED') {
        const deletedId = data.conversation_id;
        setConversations((prev) => prev.filter((c) => c.id !== deletedId));
        setSelectedConvIds((prev) => prev.filter((id) => id !== deletedId));
        if (selectedConv?.id === deletedId) {
          setSelectedConv(null);
          setMessages([]);
        }
      }
    };

    socket.on('BROADCAST_UPDATED', handleBroadcastUpdate);
    socket.on('INBOX_MESSAGE_RECEIVED', handleBroadcastUpdate);
    socket.on('INBOX_MESSAGE_SENT', handleBroadcastUpdate);
    socket.on('INBOX_MESSAGE_STATUS', handleBroadcastUpdate);
    socket.on('CONVERSATION_UPDATED', handleBroadcastUpdate);
    socket.on('CONVERSATION_DELETED', handleBroadcastUpdate);

    return () => {
      socket.off('BROADCAST_UPDATED', handleBroadcastUpdate);
      socket.off('INBOX_MESSAGE_RECEIVED', handleBroadcastUpdate);
      socket.off('INBOX_MESSAGE_SENT', handleBroadcastUpdate);
      socket.off('INBOX_MESSAGE_STATUS', handleBroadcastUpdate);
      socket.off('CONVERSATION_UPDATED', handleBroadcastUpdate);
      socket.off('CONVERSATION_DELETED', handleBroadcastUpdate);
    };
  }, [socket, selectedConv]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async (showLoading = true) => {
    try {
      if (showLoading) setIsLoading(true);
      const res = await axios.get('/api/inbox/conversations', {
        params: {
          view: activeView,
          search: searchQuery || undefined,
          company_name: isSuperadmin && selectedCompanyFilter !== 'all' ? selectedCompanyFilter : undefined,
        },
      });
      if (res.data.success) {
        setConversations(res.data.conversations || []);
        setStats(res.data.stats || {});
        if (res.data.conversations && res.data.conversations.length > 0 && !selectedConv && showLoading) {
          await loadConversationDetails(res.data.conversations[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const loadConversationDetails = async (id: string, updateSelection = true) => {
    try {
      const res = await axios.get(`/api/inbox/conversations/${id}`);
      if (res.data.success) {
        if (updateSelection) setSelectedConv(res.data.conversation);
        setMessages(res.data.messages || []);
        setActiveJourney(res.data.activeJourney || null);
      }
    } catch (err) {
      console.error('Failed to load conversation details:', err);
    }
  };

  const fetchCannedResponses = async () => {
    try {
      const res = await axios.get('/api/inbox/canned-responses');
      if (res.data.success) setCannedResponses(res.data.cannedResponses || []);
    } catch (err) {
      console.error('Failed to load canned responses:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await axios.get('/api/templates');
      if (res.data.success) {
        const waTemplates = (res.data.templates || []).filter((t: any) => t.channel === 'whatsapp');
        setTemplates(waTemplates);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await axios.get('/api/auth/users');
      if (res.data.success) setAgents(res.data.users || []);
    } catch (err) {
      console.error('Failed to load agents:', err);
    }
  };

  const fetchJourneys = async () => {
    try {
      const res = await axios.get('/api/journeys');
      if (res.data.success) setJourneys(res.data.journeys || []);
    } catch (err) {
      console.error('Failed to load journeys:', err);
    }
  };

  const fetchGateways = async () => {
    try {
      const res = await axios.get('/api/gateways');
      if (res.data.success) {
        const waGws = (res.data.gateways || []).filter((g: any) => g.type.includes('whatsapp') && g.is_active);
        setWhatsappGateways(waGws);
        if (waGws.length > 0) {
          setActiveWhatsAppGw((prev: any) => {
            if (prev && waGws.some((g: any) => g.id === prev.id)) return prev;
            return waGws[0];
          });
        }
      }
    } catch (err) {
      console.error('Failed to load gateways in inbox:', err);
    }
  };

  const handleDeleteConversation = async (convId: string, convName?: string) => {
    if (!confirm(`Are you sure you want to delete the conversation with "${convName || 'this contact'}" from the Live Box? All chat messages will be permanently deleted.`)) {
      return;
    }
    try {
      setIsDeletingConv(true);
      await axios.delete(`/api/inbox/conversations/${convId}`);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      setSelectedConvIds((prev) => prev.filter((id) => id !== convId));
      if (selectedConv?.id === convId) {
        setSelectedConv(null);
        setMessages([]);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete conversation.');
    } finally {
      setIsDeletingConv(false);
    }
  };

  const handleBulkDeleteConversations = async () => {
    if (selectedConvIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete all ${selectedConvIds.length} selected conversation(s) and their chat histories?`)) {
      return;
    }
    try {
      setIsDeletingConv(true);
      await axios.post('/api/inbox/conversations/bulk-delete', {
        conversation_ids: selectedConvIds,
      });
      setConversations((prev) => prev.filter((c) => !selectedConvIds.includes(c.id)));
      if (selectedConv && selectedConvIds.includes(selectedConv.id)) {
        setSelectedConv(null);
        setMessages([]);
      }
      setSelectedConvIds([]);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to bulk delete conversations.');
    } finally {
      setIsDeletingConv(false);
    }
  };

  const handleToggleSelectConv = (convId: string) => {
    setSelectedConvIds((prev) =>
      prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId]
    );
  };

  const handleSelectAllConvs = () => {
    if (selectedConvIds.length === conversations.length) {
      setSelectedConvIds([]);
    } else {
      setSelectedConvIds(conversations.map((c) => c.id));
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedConv || !inputText.trim()) return;

    const sendingContent = inputText.trim();
    const tempId = `temp-${Date.now()}`;

    if (!isPrivateNote) {
      // Optimistic message with status 'sending' (clock icon)
      const optimisticMsg: ChatMessage = {
        id: tempId,
        conversation_id: selectedConv.id,
        direction: 'outbound',
        sender_type: 'agent',
        sender_id: user?.id,
        sender_name: user?.full_name || 'Agent',
        message_type: 'text',
        content: sendingContent,
        status: 'sending' as any,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMsg]);
    }

    setInputText('');
    setIsSending(true);

    try {
      if (isPrivateNote) {
        // Send Internal Private Note
        await axios.post(`/api/inbox/conversations/${selectedConv.id}/notes`, {
          content: sendingContent,
        });
        loadConversationDetails(selectedConv.id, false);
      } else {
        // Send Outbound WhatsApp Message
        const res = await axios.post(`/api/inbox/conversations/${selectedConv.id}/messages`, {
          content: sendingContent,
          message_type: 'text',
          gateway_id: activeWhatsAppGw?.id || undefined,
        });

        if (res.data.success && res.data.message) {
          const confirmedMsg = res.data.message;
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? confirmedMsg : m))
          );
        } else {
          loadConversationDetails(selectedConv.id, false);
        }
      }
    } catch (err: any) {
      // Mark optimistic message as failed if error occurs
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
      if (err.response?.data?.requires_template) {
        alert('⚠️ 24-Hour WhatsApp Session has expired! Meta policy requires an approved WhatsApp Template message to contact this user.');
        setShowTemplateModal(true);
      } else {
        alert(err.response?.data?.message || 'Failed to send message.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleSendTemplate = async (template: any) => {
    if (!selectedConv) return;
    try {
      await axios.post(`/api/inbox/conversations/${selectedConv.id}/messages`, {
        content: template.body_content,
        template_name: template.meta_template_name || template.name,
        is_template: true,
        gateway_id: activeWhatsAppGw?.id || undefined,
      });
      setShowTemplateModal(false);
      loadConversationDetails(selectedConv.id, false);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to dispatch template.');
    }
  };

  const handleUpdateStatus = async (newStatus: 'open' | 'bot_handling' | 'pending' | 'resolved') => {
    if (!selectedConv) return;
    try {
      const res = await axios.put(`/api/inbox/conversations/${selectedConv.id}`, { status: newStatus });
      if (res.data.success) {
        setSelectedConv({ ...selectedConv, status: newStatus });
        fetchConversations(false);
      }
    } catch (err) {
      alert('Failed to update status.');
    }
  };

  const handleUpdatePriority = async (newPriority: 'low' | 'medium' | 'high' | 'urgent') => {
    if (!selectedConv) return;
    try {
      const res = await axios.put(`/api/inbox/conversations/${selectedConv.id}`, { priority: newPriority });
      if (res.data.success) {
        setSelectedConv({ ...selectedConv, priority: newPriority });
        fetchConversations(false);
      }
    } catch (err) {
      alert('Failed to update priority.');
    }
  };

  const handleAssignAgent = async (agentId: string) => {
    if (!selectedConv) return;
    try {
      const res = await axios.put(`/api/inbox/conversations/${selectedConv.id}`, { assigned_agent_id: agentId || null });
      if (res.data.success) {
        setSelectedConv({ ...selectedConv, assigned_agent_id: agentId });
        fetchConversations(false);
      }
    } catch (err) {
      alert('Failed to assign agent.');
    }
  };

  const handleSimulateInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simText.trim() || !simPhone.trim()) return;

    try {
      await axios.post('/api/inbox/webhook', {
        phone: simPhone.trim(),
        contact_name: simName.trim(),
        text: simText.trim(),
      });
      setShowSimulateModal(false);
      setSimText('');
      fetchConversations();
    } catch (err) {
      alert('Failed to simulate inbound message.');
    }
  };

  const handleEnrollLeadInJourney = async (journeyId: string) => {
    if (!selectedConv || !selectedConv.master_lead_id) return;
    try {
      await axios.post(`/api/journeys/${journeyId}/callback`, {
        lead_id: selectedConv.master_lead_id,
        phone: selectedConv.phone,
        name: selectedConv.contact_name,
      });
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
      alert('Lead successfully enrolled into journey!');
      loadConversationDetails(selectedConv.id, false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to enroll lead.');
    }
  };

  // Helper: Format 24-hour remaining window string
  const formatSessionRemaining = (ms: number) => {
    if (ms <= 0) return 'Expired';
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m left`;
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50 dark:bg-[#070b14] text-slate-100 select-none">
      {/* 1. LEFT CONVERSATION LIST PANEL */}
      <div className="w-80 md:w-96 shrink-0 border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#090e1c] flex flex-col h-full transition-colors duration-200">
        {/* Header & Simulator Launcher */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare size={18} className="text-emerald-500" />
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">WhatsApp Live Inbox</h2>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Multi-Agent Customer Support & Bot Hub</p>
          </div>
          <button
            onClick={() => setShowSimulateModal(true)}
            className="p-1.5 px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 transition-all"
            title="Simulate Inbound WhatsApp Message"
          >
            <Sparkles size={12} />
            <span>Simulate</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800/80 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search contact, phone, text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Superadmin Company Scope Filter */}
          {isSuperadmin && (
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#0f172a] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <Building2 size={13} className="text-blue-500 shrink-0" />
              <select
                value={selectedCompanyFilter}
                onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                className="w-full bg-transparent text-[11px] font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="all" className="dark:bg-[#090e1c]">🏢 All Companies (Global Inbox)</option>
                {companiesList.map((c) => (
                  <option key={c} value={c} className="dark:bg-[#090e1c]">🏢 {c}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* View Navigation Pills */}
        <div className="p-2 border-b border-slate-200 dark:border-slate-800/80 flex gap-1.5 overflow-x-auto scrollbar-none text-[11px] font-bold">
          <button
            onClick={() => setActiveView('all')}
            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shrink-0 ${
              activeView === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>All</span>
            <span className="text-[9px] opacity-75">({stats.open_count || conversations.length})</span>
          </button>
          <button
            onClick={() => setActiveView('mine')}
            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shrink-0 ${
              activeView === 'mine'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>Mine</span>
            <span className="text-[9px] opacity-75">({stats.mine_count || 0})</span>
          </button>
          <button
            onClick={() => setActiveView('unassigned')}
            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shrink-0 ${
              activeView === 'unassigned'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>Unassigned</span>
            <span className="text-[9px] opacity-75">({stats.unassigned_count || 0})</span>
          </button>
          <button
            onClick={() => setActiveView('bot_handling')}
            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shrink-0 ${
              activeView === 'bot_handling'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40'
            }`}
          >
            <Bot size={12} />
            <span>Bot</span>
            <span className="text-[9px] opacity-75">({stats.bot_count || 0})</span>
          </button>
          <button
            onClick={() => setActiveView('urgent')}
            className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shrink-0 ${
              activeView === 'urgent'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
          >
            <Flame size={12} />
            <span>Urgent</span>
            <span className="text-[9px] opacity-75">({stats.urgent_count || 0})</span>
          </button>
        </div>

        {/* Selection & Bulk Actions Header */}
        {conversations.length > 0 && (
          <div className="px-3.5 py-2 bg-slate-100 dark:bg-[#070b14] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
            <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400 font-semibold select-none">
              <input
                type="checkbox"
                checked={selectedConvIds.length === conversations.length && conversations.length > 0}
                onChange={handleSelectAllConvs}
                className="rounded bg-white dark:bg-[#0f172a] border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
              />
              <span className="text-[11px]">Select All ({conversations.length})</span>
            </label>

            {selectedConvIds.length > 0 && (
              <div className="flex items-center gap-2 animate-fadeIn">
                <span className="text-[10px] text-blue-500 font-bold font-mono">
                  {selectedConvIds.length} selected
                </span>
                <button
                  type="button"
                  onClick={handleBulkDeleteConversations}
                  disabled={isDeletingConv}
                  className="px-2.5 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                >
                  <Trash2 size={11} />
                  <span>Delete ({selectedConvIds.length})</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Conversation Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/50">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <MessageSquare size={28} className="mx-auto opacity-30 text-slate-400" />
              <p className="text-xs font-semibold">No active conversations found.</p>
              <p className="text-[10px] text-slate-500">Inbound WhatsApp messages or manual customer triggers will appear here in real time.</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = selectedConv?.id === conv.id;
              const isSessionValid = conv.is_session_active;

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    setSelectedConv(conv);
                    loadConversationDetails(conv.id);
                  }}
                  className={`p-3.5 cursor-pointer transition-all group relative ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-600/15 border-l-4 border-blue-600'
                      : 'hover:bg-slate-50 dark:hover:bg-[#0f172a] border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedConvIds.includes(conv.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleSelectConv(conv.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded bg-white dark:bg-[#070b14] border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0 cursor-pointer shrink-0"
                      />
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                        {conv.contact_name?.charAt(0) || 'W'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {conv.contact_name}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono block truncate">
                          {conv.phone}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {conv.last_message_at ? new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                        {conv.unread_count > 0 && (
                          <span className="px-1.5 py-0.2 bg-emerald-500 text-white rounded-full text-[9px] font-extrabold shadow-sm">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      {/* Single delete button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConversation(conv.id, conv.contact_name);
                        }}
                        title="Delete conversation"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Message Preview Snippet */}
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1 leading-snug pl-10 mb-2">
                    {conv.last_message_text || 'Conversation initiated'}
                  </p>

                  {/* Badges: 24h Window Timer & Priority */}
                  <div className="flex items-center justify-between pl-10 text-[9px]">
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold flex items-center gap-1 ${
                        isSessionValid
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                      }`}
                    >
                      <Clock size={10} />
                      <span>{isSessionValid ? formatSessionRemaining(conv.session_remaining_ms) : '24h Window Expired'}</span>
                    </span>

                    {conv.priority === 'urgent' && (
                      <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded font-black uppercase">
                        Urgent
                      </span>
                    )}
                    {conv.status === 'bot_handling' && (
                      <span className="px-1.5 py-0.5 bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded font-bold flex items-center gap-0.5">
                        <Bot size={9} /> Bot
                      </span>
                    )}
                    {isSuperadmin && conv.company_name && (
                      <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 rounded font-semibold text-[9px] flex items-center gap-0.5 truncate max-w-[120px]" title={conv.company_name}>
                        <Building2 size={9} className="shrink-0" />
                        <span className="truncate">{conv.company_name}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. CENTER ACTIVE CHAT PANEL */}
      {selectedConv ? (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#070b14] overflow-hidden transition-colors duration-200">
          {/* Active Chat Header */}
          <div className="p-3.5 px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0a0f20] flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
                {selectedConv.contact_name?.charAt(0) || 'W'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {selectedConv.contact_name}
                  </h3>
                  <span className="text-xs text-slate-500 font-mono font-semibold">
                    {selectedConv.phone}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                  {activeWhatsAppGw?.type === 'whatsapp_baileys' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30">
                      <Zap size={11} className="text-cyan-400" />
                      <span>Baileys Web Socket (Direct & Unrestricted)</span>
                    </span>
                  ) : (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                        selectedConv.is_session_active
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                      }`}
                    >
                      <Clock size={11} />
                      <span>24h Session: {selectedConv.is_session_active ? formatSessionRemaining(selectedConv.session_remaining_ms) : 'Expired (Template Required)'}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions & Handover Controls */}
            <div className="flex items-center gap-2.5">
              {/* Status Selector */}
              <select
                value={selectedConv.status}
                onChange={(e: any) => handleUpdateStatus(e.target.value)}
                className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:border-blue-500"
              >
                <option value="open">🟢 Open</option>
                <option value="bot_handling">🤖 Bot Handling</option>
                <option value="pending">🟡 Pending</option>
                <option value="resolved">⚪ Resolved</option>
              </select>

              {/* Priority Selector */}
              <select
                value={selectedConv.priority}
                onChange={(e: any) => handleUpdatePriority(e.target.value)}
                className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:border-blue-500"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">🔥 Urgent</option>
              </select>

              {/* Agent Assign */}
              <select
                value={selectedConv.assigned_agent_id || ''}
                onChange={(e) => handleAssignAgent(e.target.value)}
                className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:border-blue-500 max-w-[140px]"
              >
                <option value="">👤 Unassigned</option>
                {agents.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.full_name}
                  </option>
                ))}
              </select>

              {/* Template Dispatch Trigger */}
              <button
                onClick={() => setShowTemplateModal(true)}
                className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <FileText size={13} />
                <span>Templates</span>
              </button>

              {/* Delete Conversation from Live Box */}
              <button
                type="button"
                onClick={() => handleDeleteConversation(selectedConv.id, selectedConv.contact_name || selectedConv.phone)}
                disabled={isDeletingConv}
                title="Remove Contact & Chat History from WhatsApp Live Box"
                className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </div>
          </div>

          {/* Banner: Baileys Unrestricted vs Meta 24-Hour Session Expired */}
          {activeWhatsAppGw?.type === 'whatsapp_baileys' ? (
            <div className="bg-cyan-500/10 border-b border-cyan-500/25 px-6 py-2 flex items-center justify-between text-xs text-cyan-300">
              <div className="flex items-center gap-2 font-medium">
                <Zap size={14} className="text-cyan-400 shrink-0" />
                <span>
                  <strong>Baileys Multi-Device Protocol:</strong> Freeform replies are unrestricted. You can message this customer at any time without Meta 24-hour template constraints.
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-black">
                UNRESTRICTED
              </span>
            </div>
          ) : (
            !selectedConv.is_session_active && (
              <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2 flex items-center justify-between text-xs text-amber-300">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle size={15} className="text-amber-400 shrink-0" />
                  <span>The customer's 24-hour WhatsApp messaging window has expired. Standard freeform replies are blocked by WhatsApp policy.</span>
                </div>
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="px-3 py-1 bg-amber-500 text-slate-950 font-bold text-[11px] rounded-md hover:bg-amber-400 shadow transition-all"
                >
                  Send Approved Template
                </button>
              </div>
            )
          )}

          {/* Chat Bubble Message Stream */}
          <div className="flex-1 p-6 overflow-y-auto space-y-3.5 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
            {messages.map((msg) => {
              const isOutbound = msg.direction === 'outbound';
              const isNote = msg.message_type === 'note';
              const isBot = msg.sender_type === 'bot';

              if (isNote) {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                    <div className="max-w-lg p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40 rounded-2xl text-amber-900 dark:text-amber-200 text-xs shadow-sm space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-[10px] text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                        <Lock size={12} />
                        <span>Private Internal Note • {msg.sender_name}</span>
                        <span className="text-slate-400 ml-auto font-mono text-[9px]">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-md p-3.5 rounded-2xl text-xs space-y-1.5 shadow-md relative group ${
                      isOutbound
                        ? isBot
                          ? 'bg-cyan-900/40 border border-cyan-500/40 text-cyan-100 rounded-tr-none'
                          : 'bg-blue-600 text-white rounded-tr-none shadow-blue-600/20'
                        : 'bg-white dark:bg-[#131b31] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-none'
                    }`}
                  >
                    {/* Header Author Info */}
                    <div className="flex items-center justify-between text-[10px] opacity-75 font-semibold gap-4">
                      <span>{isOutbound ? (isBot ? '🤖 OmniReach AI Bot' : msg.sender_name) : selectedConv.contact_name}</span>
                      <span className="font-mono text-[9px]">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Template Badge Indicator */}
                    {msg.template_name && (
                      <span className="inline-block text-[9px] font-bold bg-white/20 px-2 py-0.5 rounded">
                        📋 Template: {msg.template_name}
                      </span>
                    )}

                    {/* Message Body */}
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                    {/* Delivery Status Tick Marks (WhatsApp Protocol) */}
                    {isOutbound && (
                      <div className="flex justify-end items-center gap-1 text-[10px] opacity-80 pt-1">
                        {(msg.status as any) === 'sending' || (msg.status as any) === 'queued' ? (
                          <span title="Sending..." className="flex items-center gap-0.5 text-slate-300">
                            <Clock size={12} className="animate-pulse" />
                          </span>
                        ) : msg.status === 'read' ? (
                          <span title="Read by recipient" className="flex items-center gap-0.5">
                            <CheckCheck size={14} className="text-emerald-400" />
                          </span>
                        ) : msg.status === 'delivered' ? (
                          <span title="Delivered to recipient" className="flex items-center gap-0.5">
                            <CheckCheck size={14} className="text-slate-300" />
                          </span>
                        ) : msg.status === 'failed' ? (
                          <span title="Failed to send" className="flex items-center gap-0.5 text-rose-400">
                            <AlertCircle size={13} />
                          </span>
                        ) : (
                          <span title="Sent" className="flex items-center gap-0.5">
                            <Check size={14} className="text-slate-300" />
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Canned Responses Floating Quick Selector */}
          {showCannedPicker && (
            <div className="p-3 bg-white dark:bg-[#0c1326] border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto animate-fadeIn">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                Quick Replies:
              </span>
              {cannedResponses.map((cr) => (
                <button
                  key={cr.id}
                  onClick={() => {
                    setInputText(cr.content);
                    setShowCannedPicker(false);
                  }}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-blue-500 hover:text-white rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all shrink-0 cursor-pointer"
                >
                  <span className="text-blue-500 dark:text-blue-400 font-mono mr-1">{cr.shortcut}</span>
                  <span>{cr.title}</span>
                </button>
              ))}
            </div>
          )}

          {/* Message Composer Area */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#090e1c] shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              {/* Note / WhatsApp Toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrivateNote(!isPrivateNote)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isPrivateNote
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                  }`}
                >
                  <Lock size={12} />
                  <span>{isPrivateNote ? 'Private Internal Note' : 'WhatsApp Reply'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCannedPicker(!showCannedPicker)}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Zap size={12} className="text-amber-400" />
                  <span>Canned Responses</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                {/* Gateway Selector (Multi-Baileys & Multi-Gateway Support) */}
                {whatsappGateways.length > 0 && !isPrivateNote && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400 text-[11px] font-semibold">Via:</span>
                    <select
                      value={activeWhatsAppGw?.id || ''}
                      onChange={(e) => {
                        const gw = whatsappGateways.find((g: any) => g.id === e.target.value);
                        if (gw) setActiveWhatsAppGw(gw);
                      }}
                      className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:border-cyan-500 max-w-[180px]"
                    >
                      {whatsappGateways.map((gw) => (
                        <option key={gw.id} value={gw.id}>
                          {gw.type === 'whatsapp_baileys' ? '📱' : '☁️'} {gw.name || gw.type}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <span className="text-[10px] text-slate-500 font-semibold hidden sm:inline">
                  Press <strong>Enter</strong> to send
                </span>
              </div>
            </div>

            {(() => {
              const canSendMsg = isPrivateNote || activeWhatsAppGw?.type === 'whatsapp_baileys' || selectedConv.is_session_active;
              return (
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <textarea
                    rows={2}
                    placeholder={
                      isPrivateNote
                        ? 'Write a private internal note for the team (customer cannot see this)...'
                        : canSendMsg
                        ? 'Type a WhatsApp reply (type / for canned responses)...'
                        : '24h session expired: Standard reply blocked. Use WhatsApp Template button above.'
                    }
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      if (e.target.value.startsWith('/')) setShowCannedPicker(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={!canSendMsg}
                    className={`flex-1 rounded-2xl p-3 text-xs focus:outline-none transition-all resize-none ${
                      isPrivateNote
                        ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-100 placeholder-amber-400'
                        : 'bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 disabled:opacity-50'
                    }`}
                  />

                  <button
                    type="submit"
                    disabled={isSending || !canSendMsg}
                    className={`px-5 rounded-2xl text-xs font-bold text-white shadow-lg flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer ${
                      isPrivateNote
                        ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/25'
                    }`}
                  >
                    <Send size={16} />
                  </button>
                </form>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-white dark:bg-[#070b14]">
          <MessageSquare size={48} className="opacity-25 mb-3 text-slate-500" />
          <h3 className="text-base font-bold text-slate-300">No Conversation Selected</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Select a conversation thread from the left or click "Simulate" to test an inbound customer interaction.
          </p>
        </div>
      )}

      {/* 3. RIGHT CRM & ACTIVE JOURNEY SIDEPANEL */}
      {selectedConv && (
        <div className="w-80 shrink-0 border-l border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#090e1c] flex flex-col h-full overflow-y-auto p-5 space-y-5 transition-colors duration-200">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                <User size={14} className="text-cyan-400" />
                <span>Contact & CRM Profile</span>
              </h3>
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono font-bold">
                {selectedConv.urn || 'CRM-LEAD'}
              </span>
            </div>

            <div className="mt-3 space-y-2.5 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">Full Customer Name</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedConv.contact_name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">Verified WhatsApp Phone</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{selectedConv.phone}</span>
              </div>
              {selectedConv.lead_email && (
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">Email Address</span>
                  <span className="text-slate-700 dark:text-slate-300 font-mono">{selectedConv.lead_email}</span>
                </div>
              )}
              {selectedConv.city && (
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">Location / City</span>
                  <span className="text-slate-700 dark:text-slate-300">{selectedConv.city}</span>
                </div>
              )}
              {selectedConv.pan_no && (
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">PAN / Identification</span>
                  <span className="text-purple-600 dark:text-purple-400 font-mono font-bold">{selectedConv.pan_no}</span>
                </div>
              )}
            </div>
          </div>

          {/* Channel Opt-in Indicators */}
          <div className="p-3 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Communication Opt-ins</span>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">WhatsApp Opt-in:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedConv.whatsapp_optin !== false ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                {selectedConv.whatsapp_optin !== false ? 'OPTED IN' : 'UNSUBSCRIBED'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 dark:text-slate-400">Email Opt-in:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${selectedConv.email_optin !== false ? 'bg-blue-500/15 text-blue-400' : 'bg-rose-500/15 text-rose-400'}`}>
                {selectedConv.email_optin !== false ? 'OPTED IN' : 'UNSUBSCRIBED'}
              </span>
            </div>
          </div>

          {/* Active Journey Status */}
          <div className="p-4 bg-white dark:bg-[#0f172a] border border-cyan-500/30 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                <Zap size={12} />
                <span>Active Journey Workflow</span>
              </span>
              {activeJourney && (
                <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded font-bold">
                  IN PROGRESS
                </span>
              )}
            </div>

            {activeJourney ? (
              <div className="space-y-1.5 text-xs">
                <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{activeJourney.journey_name}</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Current Node: <strong className="text-cyan-400">{activeJourney.current_node_id}</strong>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">Contact is not currently enrolled in any active journey workflow.</p>
            )}

            {/* Quick Enroll in Journey Dropdown */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="text-[10px] font-bold text-slate-400 block mb-1">Trigger Journey Pipeline:</label>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleEnrollLeadInJourney(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                className="w-full bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="" disabled>Select Journey to Enroll...</option>
                {journeys.map((j) => (
                  <option key={j.id} value={j.id}>
                    ⚡ {j.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Delete Contact & Chat from Live Box */}
          <div className="pt-2">
            <button
              type="button"
              disabled={isDeletingConv}
              onClick={() => handleDeleteConversation(selectedConv.id, selectedConv.contact_name || selectedConv.phone)}
              className="w-full py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Trash2 size={14} />
              <span>Remove Contact from Live Box</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. MODAL: WhatsApp Template Message Picker */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-50 dark:bg-[#070b14] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <FileText size={16} className="text-emerald-500" />
                  <span>Select WhatsApp Meta Template</span>
                </h3>
                <p className="text-xs text-slate-500">Initiate or re-open 24h WhatsApp session with an approved template</p>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {templates.length === 0 ? (
                <div className="text-center text-slate-400 py-8 text-xs">
                  No approved WhatsApp templates found. Create one in Templates Studio first.
                </div>
              ) : (
                templates.map((tpl) => (
                  <div
                    key={tpl.id}
                    onClick={() => setSelectedTemplate(tpl)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      selectedTemplate?.id === tpl.id
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'bg-white dark:bg-[#070b14] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-slate-900 dark:text-white">{tpl.name}</span>
                      <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded font-extrabold">
                        {tpl.meta_status || 'APPROVED'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap line-clamp-3">
                      {tpl.body_content}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-[#070b14] border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedTemplate}
                onClick={() => handleSendTemplate(selectedTemplate)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Send size={14} />
                <span>Send Template to Customer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: Inbound Customer Simulator */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 dark:bg-[#070b14] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles size={16} className="text-emerald-500" />
                  <span>Simulate Inbound WhatsApp Message</span>
                </h3>
                <p className="text-xs text-slate-500">Test live customer replies, 24h window reset, and bot interactions</p>
              </div>
              <button
                onClick={() => setShowSimulateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSimulateInbound} className="p-5 space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Customer Name</label>
                <input
                  type="text"
                  required
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Customer Phone Number</label>
                <input
                  type="text"
                  required
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Message Body (Customer Inbound Text)</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Hi, I want to know about the property in Sector 45 or check my loan application status..."
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5"
                >
                  <Sparkles size={14} />
                  <span>Send Inbound Message</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
