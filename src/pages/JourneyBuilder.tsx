import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  GitFork,
  PlusCircle,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Mail,
  Zap,
  Users,
  Layers,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Trash2,
  ArrowRight,
  HeartHandshake,
  Baby,
  Activity,
  X,
  Send,
  Eye,
  Building2,
  Globe,
  MessageSquare,
  UserCheck,
  Database,
  Copy,
  Check,
  Code,
  Terminal,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { JourneyVisualCanvas } from '../components/Journey/JourneyVisualCanvas';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';

export const JourneyBuilder: React.FC = () => {
  const { user, isSuperadmin } = useAuth();

  const [journeys, setJourneys] = useState<any[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  const [selectedJourney, setSelectedJourney] = useState<any | null>(null);
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [journeyLogs, setJourneyLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentMsg, setEnrollmentMsg] = useState('');
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [selectedJourneyIds, setSelectedJourneyIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // New Custom Journey Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('CUSTOMER_LIFECYCLE');
  const [targetCompany, setTargetCompany] = useState(isSuperadmin ? 'OmniReach Global' : (user?.company_name || 'Acme Enterprise'));
  const [starterFlow, setStarterFlow] = useState<'loan_app' | 'lead_qual' | 'welcome' | 'alert'>('loan_app');
  const [isCreating, setIsCreating] = useState(false);

  // Interactive Flow Simulator State
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);
  const [simStep, setSimStep] = useState(0);
  const [simVariables, setSimVariables] = useState<Record<string, any>>({});
  const [simLead, setSimLead] = useState({
    full_name: 'Lakshay Sharma',
    phone: '+91 98765 43210',
    email: 'lakshay@example.com',
    pan_no: 'ABCDE1234F',
    city: 'New Delhi',
  });
  const [simReplyInput, setSimReplyInput] = useState('');
  const [simHistory, setSimHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchJourneys();
    fetchCompanies();
  }, [selectedCompanyFilter]);

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

  const fetchJourneys = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get('/api/journeys', {
        params: { company_name: selectedCompanyFilter !== 'all' ? selectedCompanyFilter : undefined },
      });
      if (res.data.success) {
        setJourneys(res.data.journeys);
        if (res.data.journeys.length > 0 && !selectedJourney) {
          loadJourneyDetails(res.data.journeys[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load journeys:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadJourneyDetails = async (id: string) => {
    try {
      const res = await axios.get(`/api/journeys/${id}`);
      if (res.data.success) {
        const j = res.data.journey;
        j.nodes = typeof j.nodes_json === 'string' ? JSON.parse(j.nodes_json) : j.nodes_json;
        j.edges = typeof j.edges_json === 'string' ? JSON.parse(j.edges_json) : j.edges_json;
        j.stats = typeof j.stats_json === 'string' ? JSON.parse(j.stats_json) : j.stats_json;
        setSelectedJourney(j);
        setJourneyLogs(res.data.logs || []);
        if (j.nodes && j.nodes.length > 0) {
          setSelectedNode(j.nodes[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load journey details:', err);
    }
  };

  const handleToggleStatus = async (id: string) => {
    try {
      const res = await axios.post(`/api/journeys/${id}/toggle-status`);
      if (res.data.success) {
        fetchJourneys();
        if (selectedJourney?.id === id) {
          setSelectedJourney({ ...selectedJourney, status: res.data.journey.status });
        }
      }
    } catch (err) {
      alert('Failed to toggle journey status.');
    }
  };

  const handleEnrollAllLeads = async () => {
    if (!selectedJourney) return;
    setIsEnrolling(true);
    setEnrollmentMsg('');
    try {
      const res = await axios.post(`/api/journeys/${selectedJourney.id}/enroll-all-leads`);
      if (res.data.success) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
        setEnrollmentMsg(res.data.message);
        loadJourneyDetails(selectedJourney.id);
        fetchJourneys();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Enrollment failed.');
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleDeleteJourney = async (id: string) => {
    if (!confirm('Are you sure you want to delete this journey?')) return;
    try {
      setIsDeleting(true);
      await axios.delete(`/api/journeys/${id}`);
      setSelectedJourneyIds((prev) => prev.filter((i) => i !== id));
      if (selectedJourney?.id === id) {
        setSelectedJourney(null);
      }
      fetchJourneys();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete journey.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleSelectJourney = (id: string) => {
    setSelectedJourneyIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllJourneys = () => {
    if (selectedJourneyIds.length === journeys.length) {
      setSelectedJourneyIds([]);
    } else {
      setSelectedJourneyIds(journeys.map((j) => j.id));
    }
  };

  const handleBulkDeleteJourneys = async () => {
    if (selectedJourneyIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete all ${selectedJourneyIds.length} selected journey(s)?`)) {
      return;
    }
    try {
      setIsDeleting(true);
      await axios.post('/api/journeys/batch-delete', {
        journey_ids: selectedJourneyIds,
      });
      if (selectedJourney && selectedJourneyIds.includes(selectedJourney.id)) {
        setSelectedJourney(null);
      }
      setSelectedJourneyIds([]);
      fetchJourneys();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to bulk delete journeys.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyWebhook = (journeyId: string) => {
    const url = `${window.location.origin}/api/journeys/${journeyId}/callback`;
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const handleCreateJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) {
      alert('Journey Name is required.');
      return;
    }
    setIsCreating(true);

    try {
      let nodes: any[] = [];
      let edges: any[] = [];

      if (starterFlow === 'loan_app') {
        // Gupshup Loan Application & Credit Check Blueprint
        nodes = [
          {
            id: 'node_1_trigger',
            type: 'trigger',
            title: 'User Sends "Apply Now" or Ad Trigger',
            subtitle: 'Inbound WhatsApp trigger or External CRM Event',
            config: { trigger_type: 'inbound_keyword', keyword: 'Apply Now' },
          },
          {
            id: 'node_2_welcome',
            type: 'action_whatsapp',
            title: 'Welcome & Application Greeting',
            subtitle: 'Instant WhatsApp greeting message',
            config: {
              header_text: '🏦 Instant Loan Verification',
              body: 'Hello {{name}}! Welcome to the instant loan approval assistant. Let us verify your eligibility in 60 seconds.',
            },
          },
          {
            id: 'node_3_prompt_pan',
            type: 'prompt_input',
            title: 'Ask PAN Number',
            subtitle: 'Prompt customer & save to variable {{pan_no}}',
            config: {
              prompt_text: 'Please reply with your 10-character PAN Number (e.g. ABCDE1234F):',
              variable_name: 'pan_no',
            },
          },
          {
            id: 'node_4_prompt_amount',
            type: 'prompt_input',
            title: 'Ask Desired Loan Amount',
            subtitle: 'Save to variable {{loan_amount}}',
            config: {
              prompt_text: 'Thank you! What is your required loan amount (e.g. 500000)?',
              variable_name: 'loan_amount',
            },
          },
          {
            id: 'node_5_api_credit',
            type: 'action_api',
            title: 'Credit Score & Underwriting API',
            subtitle: 'Call external backend & extract approval status',
            config: {
              url: 'https://api.internal-banking.io/v1/credit-check',
              method: 'POST',
              body_json: { pan: '{{pan_no}}', amount: '{{loan_amount}}' },
              response_mappings: { status: 'status', credit_score: 'score', lead_id: 'lead_id' },
            },
          },
          {
            id: 'node_6_condition',
            type: 'condition',
            title: 'Is Application Approved?',
            subtitle: 'Check if variable {{status}} == approved',
            config: {
              condition_type: 'VARIABLE_MATCH',
              variable_name: 'status',
              operator: '==',
              target_value: 'approved',
            },
          },
          {
            id: 'node_7_approved',
            type: 'action_whatsapp',
            title: 'Send Pre-Approved Offer Template',
            subtitle: 'WhatsApp confirmation template with sanction link',
            config: {
              header_text: '🎉 Congratulations {{name}}!',
              body: 'Your loan application of ₹{{loan_amount}} is PRE-APPROVED (Ref: {{lead_id}}).\n\nClick below to complete 100% digital KYC.',
              button_text: 'Complete Digital KYC 📄',
            },
          },
          {
            id: 'node_7_declined',
            type: 'action_whatsapp',
            title: 'Send Regret Notice & Alternative Options',
            subtitle: 'Polite decline message with advisor connect',
            config: {
              body: 'Dear {{name}}, we are unable to approve your application for ₹{{loan_amount}} at this time based on credit criteria.\n\nOur financial advisor will review alternative programs with you.',
            },
          },
          {
            id: 'node_8_handover',
            type: 'action_handover',
            title: 'Bot to Human Handover in Live Inbox',
            subtitle: 'Transfer conversation to Senior Loan Officer queue',
            config: {
              reason: 'Customer completed loan verification flow',
              priority: 'urgent',
            },
          },
        ];
        edges = [
          { id: 'e1-2', from: 'node_1_trigger', to: 'node_2_welcome' },
          { id: 'e2-3', from: 'node_2_welcome', to: 'node_3_prompt_pan' },
          { id: 'e3-4', from: 'node_3_prompt_pan', to: 'node_4_prompt_amount' },
          { id: 'e4-5', from: 'node_4_prompt_amount', to: 'node_5_api_credit' },
          { id: 'e5-6', from: 'node_5_api_credit', to: 'node_6_condition' },
          { id: 'e6-7y', from: 'node_6_condition', to: 'node_7_approved', label: 'Approved (True)' },
          { id: 'e6-7n', from: 'node_6_condition', to: 'node_7_declined', label: 'Declined (False)' },
          { id: 'e7y-8', from: 'node_7_approved', to: 'node_8_handover' },
          { id: 'e7n-8', from: 'node_7_declined', to: 'node_8_handover' },
        ];
      } else if (starterFlow === 'lead_qual') {
        nodes = [
          {
            id: 'node_1_trigger',
            type: 'trigger',
            title: 'Lead Ingested from Ad / Form',
            subtitle: 'Meta Lead Gen or Webhook trigger',
            config: { trigger_type: 'segment_entry' },
          },
          {
            id: 'node_2_prompt_city',
            type: 'prompt_input',
            title: 'Ask Interested City / Property',
            subtitle: 'Save to variable {{preferred_city}}',
            config: {
              prompt_text: 'Hi {{name}}, thanks for your interest in our premium real estate portfolio! Which city are you exploring properties in?',
              variable_name: 'preferred_city',
            },
          },
          {
            id: 'node_3_api_crm',
            type: 'action_api',
            title: 'Update CRM & Check Inventory',
            subtitle: 'Sync lead with CRM database',
            config: {
              url: 'https://api.mycrm.io/leads/update',
              method: 'POST',
              body_json: { phone: '{{phone}}', city: '{{preferred_city}}' },
              response_mappings: { inventory_available: 'has_inventory' },
            },
          },
          {
            id: 'node_4_handover',
            type: 'action_handover',
            title: 'Route to City Sales Concierge',
            subtitle: 'Create Live Chat ticket in Inbox',
            config: { priority: 'high', reason: 'High-intent real estate buyer' },
          },
        ];
        edges = [
          { id: 'e1-2', from: 'node_1_trigger', to: 'node_2_prompt_city' },
          { id: 'e2-3', from: 'node_2_prompt_city', to: 'node_3_api_crm' },
          { id: 'e3-4', from: 'node_3_api_crm', to: 'node_4_handover' },
        ];
      } else {
        nodes = [
          {
            id: 'node_1_trigger',
            type: 'trigger',
            title: 'Customer Onboarding Trigger',
            subtitle: 'New signup registration event',
            config: { trigger_type: 'segment_entry' },
          },
          {
            id: 'node_2_wa',
            type: 'action_whatsapp',
            title: 'Instant WhatsApp Welcome Guide',
            subtitle: 'Send welcome message with account details',
            config: {
              body: 'Welcome {{name}}! Your workspace is ready. Let us know if you have any questions.',
            },
          },
          {
            id: 'node_3_delay',
            type: 'delay',
            title: 'Wait 2 Days',
            subtitle: 'Allow usage exploration window',
            config: { value: 2, delay_type: 'DAYS' },
          },
          {
            id: 'node_4_email',
            type: 'action_email',
            title: 'Follow-Up Feature Walkthrough',
            subtitle: 'Pro tips and tutorials',
            config: {
              subject: 'Getting started with your workspace, {{name}}',
              body: '<p>Dear {{name}}, here are 3 quick power features to automate your broadcast campaigns.</p>',
            },
          },
        ];
        edges = [
          { id: 'e1-2', from: 'node_1_trigger', to: 'node_2_wa' },
          { id: 'e2-3', from: 'node_2_wa', to: 'node_3_delay' },
          { id: 'e3-4', from: 'node_3_delay', to: 'node_4_email' },
        ];
      }

      const res = await axios.post('/api/journeys', {
        name: newName,
        description: newDesc,
        category: newCategory,
        company_name: isSuperadmin ? targetCompany : user?.company_name,
        trigger_config: { type: 'segment_entry', rule: 'all_verified_leads' },
        nodes_json: nodes,
        edges_json: edges,
      });

      if (res.data.success) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        setShowCreateModal(false);
        setNewName('');
        setNewDesc('');
        fetchJourneys();
        loadJourneyDetails(res.data.journey.id);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create journey.');
    } finally {
      setIsCreating(false);
    }
  };

  // Flow Simulator Controls
  const startSimulator = () => {
    if (!selectedJourney || !selectedJourney.nodes || selectedJourney.nodes.length === 0) return;
    setSimStep(0);
    setSimVariables({});
    setSimHistory([
      {
        node: selectedJourney.nodes[0],
        type: 'system',
        text: `⚡ Trigger Activated: ${selectedJourney.nodes[0].title}`,
      },
    ]);
    setShowSimulatorModal(true);
  };

  const advanceSimulator = () => {
    if (!selectedJourney) return;
    const currentNode = selectedJourney.nodes[simStep];
    const outgoing = selectedJourney.edges?.filter((e: any) => e.from === currentNode?.id || e.source === currentNode?.id);

    if (!outgoing || outgoing.length === 0) {
      setSimHistory((prev) => [...prev, { type: 'goal', text: '🎯 Journey Completed successfully!' }]);
      return;
    }

    const nextNodeId = outgoing[0].to || outgoing[0].target;
    const nextNodeIndex = selectedJourney.nodes.findIndex((n: any) => n.id === nextNodeId);

    if (nextNodeIndex >= 0) {
      const nextNode = selectedJourney.nodes[nextNodeIndex];
      setSimStep(nextNodeIndex);

      let displayText = nextNode.title;
      if (nextNode.type === 'action_whatsapp' || nextNode.type === 'prompt_input') {
        displayText = nextNode.config?.body || nextNode.config?.prompt_text || nextNode.title;
      }

      setSimHistory((prev) => [
        ...prev,
        {
          node: nextNode,
          type: nextNode.type,
          text: displayText,
        },
      ]);
    }
  };

  const handleSimReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simReplyInput.trim()) return;

    const currentNode = selectedJourney.nodes[simStep];
    const targetVar = currentNode?.config?.variable_name || 'user_reply';

    const updatedVars = { ...simVariables, [targetVar]: simReplyInput.trim() };
    setSimVariables(updatedVars);

    setSimHistory((prev) => [
      ...prev,
      {
        type: 'user_reply',
        text: `💬 Customer Replied: "${simReplyInput.trim()}" -> saved to variable {{${targetVar}}}`,
      },
    ]);

    setSimReplyInput('');
    advanceSimulator();
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto animate-fadeIn select-none">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#0f172a] p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl transition-colors duration-200">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-500/30">
              Gupshup-Style Workflow Studio
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Prompts, API Nodes, Variables & Live Handover</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Journey Builder & Automation Engine
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Build intelligent WhatsApp state machines with user prompts, REST API actions, JSON path mappings, conditional branching, and Live Chat handovers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 flex items-center gap-2 transition-all hover:scale-[1.02] cursor-pointer"
          >
            <PlusCircle size={15} />
            <span>Create New Journey</span>
          </button>
        </div>
      </div>

      {/* Main Studio Grid: Left Journey List & Right Visual Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Journey Selector Cards */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1 flex items-center justify-between">
            <span>Configured Pipelines ({journeys.length})</span>
            <RefreshCw size={13} className="cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={fetchJourneys} />
          </div>

          {isSuperadmin && journeys.length > 0 && (
            <div className="flex items-center justify-between p-2.5 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl text-xs shadow-xs">
              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedJourneyIds.length === journeys.length}
                  onChange={handleSelectAllJourneys}
                  className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>Select All ({journeys.length})</span>
              </label>
              {selectedJourneyIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleBulkDeleteJourneys}
                  disabled={isDeleting}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer text-[11px]"
                >
                  <Trash2 size={12} />
                  <span>Delete ({selectedJourneyIds.length}) Selected</span>
                </button>
              )}
            </div>
          )}

          <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
            {journeys.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                <GitFork size={32} className="mx-auto opacity-30 text-cyan-500" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No active journeys found.</p>
                <p className="text-[11px] text-slate-500">Click "Create New Journey" above to build your first flow.</p>
              </div>
            ) : (
              journeys.map((j) => (
                <div
                  key={j.id}
                  onClick={() => loadJourneyDetails(j.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    selectedJourney?.id === j.id
                      ? 'bg-blue-50 dark:bg-blue-600/15 border-blue-400 dark:border-blue-500/80 ring-2 ring-blue-400/20 shadow-md'
                      : 'bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {isSuperadmin && (
                        <input
                          type="checkbox"
                          checked={selectedJourneyIds.includes(j.id)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => handleToggleSelectJourney(j.id)}
                          className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                          j.category === 'CRITICAL_ALERT'
                            ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
                            : j.category === 'CUSTOMER_ONBOARDING' || j.category === 'CUSTOMER_LIFECYCLE'
                            ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30'
                            : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                        }`}
                      >
                        {j.category?.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          j.status === 'active'
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                            : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                        }`}
                      >
                        {j.status.toUpperCase()}
                      </span>
                      {isSuperadmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteJourney(j.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                          title="Delete Journey"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1 mb-1">{j.name}</h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {j.description}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400">
                    <span>Enrolled: <strong className="text-slate-900 dark:text-white font-mono">{j.stats_json?.total_enrolled || 0}</strong></span>
                    <span>Active: <strong className="text-cyan-700 dark:text-cyan-400 font-mono">{j.active_enrollments || 0}</strong></span>
                    <span>Completed: <strong className="text-emerald-700 dark:text-emerald-400 font-mono">{j.completed_enrollments || 0}</strong></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Visual Flow Canvas & Node Inspector */}
        <div className="lg:col-span-8 space-y-6">
          {selectedJourney ? (
            <div className="space-y-6">
              {/* Journey Control Toolbar */}
              <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm dark:shadow-md transition-colors duration-200">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{selectedJourney.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedJourney.status === 'active'
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
                      }`}
                    >
                      {selectedJourney.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedJourney.nodes?.length || 0} State Nodes • Partition: {selectedJourney.company_name || 'OmniReach Global'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={startSimulator}
                    className="px-3 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-500/30 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Interactive Flow Simulator"
                  >
                    <Sparkles size={13} />
                    <span>Test Simulator</span>
                  </button>

                  <button
                    onClick={() => handleToggleStatus(selectedJourney.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      selectedJourney.status === 'active'
                        ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-500/25 border border-amber-300 dark:border-amber-500/30'
                        : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 border border-emerald-300 dark:border-emerald-500/30'
                    }`}
                  >
                    {selectedJourney.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                    <span>{selectedJourney.status === 'active' ? 'Pause Flow' : 'Activate Flow'}</span>
                  </button>

                  <button
                    onClick={handleEnrollAllLeads}
                    disabled={isEnrolling}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/25 flex items-center gap-1.5 transition-all hover:scale-[1.02] disabled:opacity-50 cursor-pointer"
                  >
                    <Send size={13} />
                    <span>{isEnrolling ? 'Enrolling...' : 'Enroll Master Leads'}</span>
                  </button>

                  {isSuperadmin && (
                    <button
                      onClick={() => handleDeleteJourney(selectedJourney.id)}
                      className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                      title="Delete Journey (Superadmin Only)"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* External Callback URL Card */}
              <div className="bg-slate-50 dark:bg-[#070b14] border border-cyan-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Globe size={18} className="text-cyan-400 shrink-0" />
                  <div>
                    <span className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300 block">
                      External CRM Trigger & Webhook Callback Endpoint
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      POST {window.location.origin}/api/journeys/{selectedJourney.id}/callback
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleCopyWebhook(selectedJourney.id)}
                  className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
                >
                  {copiedWebhook ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copiedWebhook ? 'Copied URL!' : 'Copy Webhook URL'}</span>
                </button>
              </div>

              {enrollmentMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{enrollmentMsg}</span>
                </div>
              )}

              {/* Interactive Visual Canvas */}
              <JourneyVisualCanvas
                nodes={selectedJourney.nodes || []}
                edges={selectedJourney.edges || []}
                onSelectNode={(node) => setSelectedNode(node)}
                selectedNodeId={selectedNode?.id}
              />

              {/* Node Inspector Detail Panel */}
              {selectedNode && (
                <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-4 transition-colors duration-200">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="flex items-center space-x-2.5">
                      <span className="text-xs font-bold text-cyan-700 dark:text-cyan-400 uppercase bg-cyan-50 dark:bg-cyan-500/10 px-2.5 py-0.5 rounded border border-cyan-200 dark:border-cyan-500/30">
                        {selectedNode.type.replace('_', ' ')}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{selectedNode.title}</h3>
                    </div>
                    <span className="text-xs text-slate-500 font-mono">Node ID: {selectedNode.id}</span>
                  </div>

                  {/* PROMPT / INPUT NODE INSPECTOR */}
                  {(selectedNode.type === 'prompt_input' || selectedNode.type === 'user_input') && (
                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-1">User Question / Prompt Text:</span>
                        <div className="p-3 bg-slate-50 dark:bg-[#070b14] border border-cyan-500/30 rounded-xl text-slate-900 dark:text-cyan-200 whitespace-pre-line leading-relaxed font-semibold">
                          {selectedNode.config?.prompt_text || selectedNode.config?.body}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400 font-semibold">Captured Variable Name:</span>
                        <span className="px-2.5 py-1 bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded-lg font-mono font-bold">
                          &#123;&#123;{selectedNode.config?.variable_name || 'user_response'}&#125;&#125;
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ACTION API NODE INSPECTOR */}
                  {(selectedNode.type === 'action_api' || selectedNode.type === 'api_node') && (
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-1">
                          <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-1">Method:</span>
                          <span className="px-2.5 py-1 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded font-bold font-mono">
                            {selectedNode.config?.method || 'POST'}
                          </span>
                        </div>
                        <div className="col-span-3">
                          <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-1">Target REST Endpoint:</span>
                          <div className="p-2 bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded font-mono text-slate-800 dark:text-slate-200 truncate">
                            {selectedNode.config?.url || 'https://api.internal.io/v1/resource'}
                          </div>
                        </div>
                      </div>

                      {selectedNode.config?.body_json && (
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-1">Request Payload JSON:</span>
                          <pre className="p-3 bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-xl text-emerald-600 dark:text-emerald-400 font-mono text-[11px] overflow-x-auto">
                            {JSON.stringify(selectedNode.config.body_json, null, 2)}
                          </pre>
                        </div>
                      )}

                      {selectedNode.config?.response_mappings && (
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-1">JSON Path Response to Variable Mappings:</span>
                          <div className="p-2.5 bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-xl space-y-1 font-mono text-[11px]">
                            {Object.entries(selectedNode.config.response_mappings).map(([k, v]: any) => (
                              <div key={k} className="flex justify-between text-slate-700 dark:text-slate-300">
                                <span>&#123;&#123;{k}&#125;&#125;</span>
                                <span className="text-cyan-600 dark:text-cyan-400">&larr; response.{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* HANDOVER NODE INSPECTOR */}
                  {(selectedNode.type === 'action_handover' || selectedNode.type === 'bot_handover') && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs space-y-2">
                      <div className="flex items-center gap-2 text-amber-300 font-bold">
                        <UserCheck size={16} />
                        <span>Live Chat Inbox Escalation</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        Transfers active customer conversation directly to human agents in the Live Chat Inbox with priority <strong>{selectedNode.config?.priority || 'high'}</strong>.
                      </p>
                      {selectedNode.config?.reason && (
                        <div className="text-[11px] text-amber-200">
                          Handover Reason: <em>"{selectedNode.config.reason}"</em>
                        </div>
                      )}
                    </div>
                  )}

                  {/* WhatsApp Action Inspector */}
                  {selectedNode.type === 'action_whatsapp' && (
                    <div className="space-y-3 text-xs">
                      {selectedNode.config?.header_text && (
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-1">Header:</span>
                          <div className="p-2.5 bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 font-semibold">
                            {selectedNode.config.header_text}
                          </div>
                        </div>
                      )}
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 font-semibold block mb-1">WhatsApp Message Body:</span>
                        <div className="p-3 bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                          {selectedNode.config?.body}
                        </div>
                      </div>
                      {selectedNode.config?.button_text && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 dark:text-slate-400 font-semibold">Interactive Button:</span>
                          <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 rounded-lg font-bold">
                            {selectedNode.config.button_text}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Condition Inspector */}
                  {selectedNode.type === 'condition' && (
                    <div className="p-4 bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-2xl text-xs space-y-1">
                      <div className="text-slate-500 dark:text-slate-400 font-semibold">Decision Evaluation Criteria:</div>
                      <div className="text-base font-bold text-cyan-700 dark:text-cyan-300">
                        {selectedNode.config?.variable_name ? (
                          <span>&#123;&#123;{selectedNode.config.variable_name}&#125;&#125; {selectedNode.config.operator || '=='} {selectedNode.config.target_value}</span>
                        ) : (
                          <span>Did recipient interact with previous campaign link?</span>
                        )}
                      </div>
                      <div className="flex gap-4 pt-2">
                        <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 rounded font-semibold">
                          Branch A: Yes (True)
                        </span>
                        <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 rounded font-semibold">
                          Branch B: No (False)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Execution Audit Trail */}
              {journeyLogs.length > 0 && (
                <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl space-y-3 transition-colors duration-200">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Live Journey Execution Audit Trail</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {journeyLogs.map((log) => (
                      <div key={log.id} className="p-3 bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">{log.lead_name}</span>
                          <span className="text-slate-500 dark:text-slate-400 text-[11px] ml-2">({log.lead_phone})</span>
                          <span className="text-slate-500 dark:text-slate-400 text-[11px] ml-2">• {log.action_taken}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-slate-500 py-24 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl">
              <GitFork size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs">Select a journey from the left to inspect its workflow and state machines</p>
            </div>
          )}
        </div>
      </div>

      {/* CREATE CUSTOM JOURNEY MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-slate-50 dark:bg-[#070b14] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <GitFork size={16} className="text-cyan-400" />
                  <span>Create Gupshup Workflow Journey</span>
                </h3>
                <p className="text-xs text-slate-500">Design multi-stage automated pipelines with prompts, APIs, and handover</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateJourney} className="p-6 space-y-4 overflow-y-auto">
              {isSuperadmin ? (
                <div className="p-3.5 bg-slate-50 dark:bg-[#070b14] border border-cyan-500/30 rounded-xl space-y-1.5">
                  <label className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300 flex items-center gap-1.5">
                    <Building2 size={14} />
                    <span>Target Company / Tenant Partition *</span>
                  </label>
                  <select
                    value={targetCompany}
                    onChange={(e) => setTargetCompany(e.target.value)}
                    className="w-full bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="OmniReach Global">🏢 OmniReach Global (Superadmin Global Pipeline)</option>
                    {companies.filter(c => c !== 'OmniReach Global').map((c) => (
                      <option key={c} value={c}>
                        🏢 {c} (Company Pipeline)
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-xl text-xs flex items-center justify-between text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-cyan-500" />
                    <span>Company Workspace: <strong>{user?.company_name || 'Acme Enterprise'}</strong></span>
                  </div>
                  <span className="text-[10px] bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded font-bold">
                    Scoped Partition
                  </span>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Journey Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Instant Loan Approval & Verification Flow"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Automated loan verification flow with PAN capture, API credit check, condition branching, and agent handover..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="CUSTOMER_LIFECYCLE">Customer Lifecycle</option>
                    <option value="FINANCIAL_SERVICES">Financial & Loan Verification</option>
                    <option value="LEAD_QUALIFICATION">Lead Qualification & Ingestion</option>
                    <option value="CRITICAL_ALERT">Critical Priority Alert</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Workflow Preset</label>
                  <select
                    value={starterFlow}
                    onChange={(e: any) => setStarterFlow(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-bold"
                  >
                    <option value="loan_app">🏦 Loan App (Prompts + API + Handover)</option>
                    <option value="lead_qual">🎯 Lead Qual (Prompt + CRM + Handover)</option>
                    <option value="welcome">💙 Onboarding & Delay (4 Nodes)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-[#070b14] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  <span>{isCreating ? 'Deploying...' : 'Deploy Workflow'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INTERACTIVE FLOW SIMULATOR MODAL */}
      {showSimulatorModal && selectedJourney && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 bg-slate-50 dark:bg-[#070b14] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-purple-400" />
                  <span>Interactive Flow Simulator • {selectedJourney.name}</span>
                </h3>
                <p className="text-xs text-slate-500">Simulate customer conversation, variable capture, API execution, and conditions</p>
              </div>
              <button
                onClick={() => setShowSimulatorModal(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-3 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]">
              {simHistory.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-2xl text-xs space-y-1 ${
                    item.type === 'user_reply'
                      ? 'bg-blue-600 text-white ml-12 shadow-sm'
                      : item.type === 'action_api'
                      ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-500/40 text-blue-900 dark:text-blue-200'
                      : item.type === 'action_handover'
                      ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-500/40 text-amber-900 dark:text-amber-200'
                      : 'bg-white dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="text-[10px] font-bold opacity-75 uppercase">
                    {item.node ? `${item.node.type.replace('_', ' ')} • #${simStep + 1}` : 'State Update'}
                  </div>
                  <div className="font-semibold">{item.text}</div>
                </div>
              ))}
            </div>

            {/* Variable State Bar */}
            <div className="px-5 py-2 bg-slate-100 dark:bg-[#070b14] border-t border-slate-200 dark:border-slate-800 flex items-center gap-3 text-[11px] overflow-x-auto">
              <span className="font-bold text-slate-500 uppercase tracking-wider shrink-0">Captured Variables:</span>
              {Object.keys(simVariables).length === 0 ? (
                <span className="text-slate-400 italic">None yet</span>
              ) : (
                Object.entries(simVariables).map(([k, v]) => (
                  <span key={k} className="px-2 py-0.5 bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 rounded font-mono font-bold shrink-0">
                    {k}: {String(v)}
                  </span>
                ))
              )}
            </div>

            {/* Simulator Controls */}
            <div className="p-4 bg-slate-50 dark:bg-[#090e1c] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              {selectedJourney.nodes[simStep]?.type === 'prompt_input' || selectedJourney.nodes[simStep]?.type === 'user_input' ? (
                <form onSubmit={handleSimReply} className="flex-1 flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder={`Reply to prompt (saving to {{${selectedJourney.nodes[simStep]?.config?.variable_name || 'response'}}})...`}
                    value={simReplyInput}
                    onChange={(e) => setSimReplyInput(e.target.value)}
                    className="flex-1 bg-white dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow"
                  >
                    Reply & Next Step
                  </button>
                </form>
              ) : (
                <div className="flex justify-end w-full">
                  <button
                    onClick={advanceSimulator}
                    className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-1.5"
                  >
                    <span>Execute Next Node Step</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
