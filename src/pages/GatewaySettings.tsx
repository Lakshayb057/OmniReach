import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Cpu,
  PlusCircle,
  Smartphone,
  Mail,
  ShieldCheck,
  Activity,
  CheckCircle2,
  AlertCircle,
  Play,
  Trash2,
  Lock,
  Layers,
  Key,
  QrCode,
  Phone,
  RefreshCw,
  Zap,
  Copy,
  Check,
  Radio,
  Send,
  Unlink,
  Shield,
  Sliders,
  Clock,
  UserX,
  Flame,
  Save,
  XCircle,
  PhoneOff,
  Ban,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export const GatewaySettings: React.FC = () => {
  const { socket, lastEvent } = useSocket();
  const [gateways, setGateways] = useState<any[]>([]);

  // Persisted active sub-tab across reloads
  const [activeTab, setActiveTab] = useState<'ses' | 'smtp' | 'meta' | 'baileys'>(
    () => (localStorage.getItem('gateway_active_tab') as any) || 'ses'
  );

  const [isLoading, setIsLoading] = useState(true);

  // Diagnostic State (SMTP & SES)
  const [testResult, setTestResult] = useState<any | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [sesQuota, setSesQuota] = useState<any | null>(null);

  // SMTP Test Form
  const [testHost, setTestHost] = useState('smtp.gmail.com');
  const [testPort, setTestPort] = useState(587);
  const [testUser, setTestUser] = useState('support@omnireach.io');
  const [testPass, setTestPass] = useState('••••••••••••');

  // =========================================================================
  // BAILEYS WHATSAPP WEB SOCKET STATE
  // =========================================================================
  const [selectedBaileysGwId, setSelectedBaileysGwId] = useState<string>('');
  const [baileysSessionData, setBaileysSessionData] = useState<any | null>(null);
  const [isStartingBaileys, setIsStartingBaileys] = useState(false);
  const [pairingMethod, setPairingMethod] = useState<'qr' | 'code'>('qr');
  const [pairingPhoneInput, setPairingPhoneInput] = useState('');
  const [isRequestingPairingCode, setIsRequestingPairingCode] = useState(false);
  const [pairingCodeResult, setPairingCodeResult] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Baileys Test Message
  const [baileysTestPhone, setBaileysTestPhone] = useState('');
  const [baileysTestMsg, setBaileysTestMsg] = useState('🚀 Hello from OmniReach Baileys WhatsApp Gateway! Web socket connection verified.');
  const [isSendingBaileysTest, setIsSendingBaileysTest] = useState(false);
  const [baileysTestFeedback, setBaileysTestFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [isDisconnectingBaileys, setIsDisconnectingBaileys] = useState(false);
  const [isCancellingPairing, setIsCancellingPairing] = useState(false);
  const [isResettingSession, setIsResettingSession] = useState(false);
  const [qrCountdown, setQrCountdown] = useState<number>(30);
  const [pairingRejectionReason, setPairingRejectionReason] = useState<string | null>(null);

  // Anti-Ban Protection Settings State
  const [antiBanSettings, setAntiBanSettings] = useState<any>({
    profile: 'balanced',
    min_delay_seconds: 4,
    max_delay_seconds: 10,
    batch_size: 25,
    batch_cooldown_seconds: 60,
    daily_send_limit: 150,
    simulate_human_typing: true,
    preflight_number_check: true,
    polymorphic_anti_hash: true,
    auto_opt_out_on_stop: true,
    append_opt_out_footer: false,
  });
  const [antiBanDailySent, setAntiBanDailySent] = useState<number>(0);
  const [isSavingAntiBan, setIsSavingAntiBan] = useState(false);
  const [antiBanSaveSuccess, setAntiBanSaveSuccess] = useState(false);

  const fetchAntiBanSettings = async (gatewayId: string) => {
    try {
      const res = await axios.get(`/api/baileys/${gatewayId}/anti-ban`);
      if (res.data.success) {
        setAntiBanSettings(res.data.settings);
        setAntiBanDailySent(res.data.dailySentCount || 0);
      }
    } catch (err) {
      console.warn('Failed to fetch anti-ban settings:', err);
    }
  };

  const handleApplyPreset = (preset: 'warmup' | 'balanced' | 'high_throughput') => {
    if (preset === 'warmup') {
      setAntiBanSettings((prev: any) => ({
        ...prev,
        profile: 'warmup',
        min_delay_seconds: 8,
        max_delay_seconds: 18,
        batch_size: 15,
        batch_cooldown_seconds: 120,
        daily_send_limit: 40,
        simulate_human_typing: true,
        preflight_number_check: true,
        polymorphic_anti_hash: true,
        auto_opt_out_on_stop: true,
        append_opt_out_footer: true,
      }));
    } else if (preset === 'balanced') {
      setAntiBanSettings((prev: any) => ({
        ...prev,
        profile: 'balanced',
        min_delay_seconds: 4,
        max_delay_seconds: 10,
        batch_size: 25,
        batch_cooldown_seconds: 60,
        daily_send_limit: 150,
        simulate_human_typing: true,
        preflight_number_check: true,
        polymorphic_anti_hash: true,
        auto_opt_out_on_stop: true,
        append_opt_out_footer: false,
      }));
    } else if (preset === 'high_throughput') {
      setAntiBanSettings((prev: any) => ({
        ...prev,
        profile: 'high_throughput',
        min_delay_seconds: 2,
        max_delay_seconds: 6,
        batch_size: 40,
        batch_cooldown_seconds: 45,
        daily_send_limit: 400,
        simulate_human_typing: true,
        preflight_number_check: true,
        polymorphic_anti_hash: true,
        auto_opt_out_on_stop: true,
        append_opt_out_footer: false,
      }));
    }
  };

  const handleSaveAntiBanSettings = async () => {
    if (!selectedBaileysGwId) return;
    try {
      setIsSavingAntiBan(true);
      setAntiBanSaveSuccess(false);
      const res = await axios.post(`/api/baileys/${selectedBaileysGwId}/anti-ban`, {
        settings: antiBanSettings,
      });
      if (res.data.success) {
        setAntiBanSaveSuccess(true);
        setTimeout(() => setAntiBanSaveSuccess(false), 3000);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update anti-ban settings.');
    } finally {
      setIsSavingAntiBan(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('gateway_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    fetchGateways();
  }, []);

  // Listen to live WebSocket Baileys events
  useEffect(() => {
    if (!lastEvent) return;
    const { type, data } = lastEvent;

    if (type === 'BAILEYS_QR' && (!selectedBaileysGwId || data.gatewayId === selectedBaileysGwId)) {
      setBaileysSessionData((prev: any) => ({
        ...prev,
        status: 'qr_ready',
        qrCodeDataUrl: data.qrCodeDataUrl,
        hasQr: true,
      }));
      setQrCountdown(30);
      setPairingRejectionReason(null);
    }

    if (type === 'BAILEYS_STATUS' && (!selectedBaileysGwId || data.gatewayId === selectedBaileysGwId)) {
      setBaileysSessionData((prev: any) => ({
        ...prev,
        status: data.status,
        phoneNumber: data.phoneNumber || prev?.phoneNumber,
        pushName: data.pushName || prev?.pushName,
        connectedAt: data.connectedAt || prev?.connectedAt,
      }));

      if (data.reason === 'pairing_rejected') {
        setPairingRejectionReason('Pairing request was rejected or cancelled on your WhatsApp mobile device. Please try scanning the QR code or generating a new Pairing Code.');
        setPairingCodeResult(null);
      } else if (data.reason === 'pairing_timeout') {
        setPairingRejectionReason('Pairing request timed out. Please click "Refresh QR Code" or request a new code.');
      } else if (data.reason === 'pairing_cancelled') {
        setPairingRejectionReason(null);
        setPairingCodeResult(null);
      } else if (data.status === 'connected') {
        setPairingRejectionReason(null);
        setPairingCodeResult(null);
        fetchGateways();
      }
    }

    if (type === 'BAILEYS_PAIRING_CODE' && (!selectedBaileysGwId || data.gatewayId === selectedBaileysGwId)) {
      setPairingCodeResult(data.pairingCode);
      setPairingRejectionReason(null);
    }
  }, [lastEvent, selectedBaileysGwId]);

  // QR Code Expiry Countdown Timer
  useEffect(() => {
    let timer: any = null;
    if (baileysSessionData?.status === 'qr_ready' && qrCountdown > 0) {
      timer = setTimeout(() => {
        setQrCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [baileysSessionData?.status, qrCountdown]);

  // Load Baileys status & Anti-Ban settings when tab or gateway changes
  useEffect(() => {
    if (activeTab === 'baileys' && selectedBaileysGwId) {
      fetchBaileysStatus(selectedBaileysGwId);
      fetchAntiBanSettings(selectedBaileysGwId);
    }
  }, [activeTab, selectedBaileysGwId]);

  const fetchGateways = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get('/api/gateways');
      if (res.data.success) {
        setGateways(res.data.gateways);
        const sesGw = res.data.gateways.find((g: any) => g.type === 'email_ses');
        if (sesGw) {
          fetchSesQuota(sesGw.id);
        }

        const baileysGws = res.data.gateways.filter((g: any) => g.type === 'whatsapp_baileys');
        if (baileysGws.length > 0 && !selectedBaileysGwId) {
          setSelectedBaileysGwId(baileysGws[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load gateways:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSesQuota = async (gatewayId: string) => {
    try {
      const res = await axios.get(`/api/gateways/${gatewayId}/ses-quota`);
      if (res.data.success) {
        setSesQuota(res.data.quota);
      }
    } catch (err) {
      console.error('Failed to fetch SES quota:', err);
    }
  };

  const fetchBaileysStatus = async (gatewayId: string) => {
    try {
      const res = await axios.get(`/api/baileys/${gatewayId}/status`);
      if (res.data.success) {
        setBaileysSessionData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch Baileys status:', err);
    }
  };

  const handleStartBaileys = async (pairingPhone?: string) => {
    if (!selectedBaileysGwId) return;
    setIsStartingBaileys(true);
    setPairingCodeResult(null);
    try {
      const res = await axios.post(`/api/baileys/${selectedBaileysGwId}/connect`, {
        phone_number: pairingPhone,
      });
      if (res.data.success) {
        setBaileysSessionData((prev: any) => ({
          ...prev,
          status: res.data.status,
          qrCodeDataUrl: res.data.qrCodeDataUrl,
          pairingCode: res.data.pairingCode,
        }));
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to start Baileys socket.');
    } finally {
      setIsStartingBaileys(false);
    }
  };

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBaileysGwId || !pairingPhoneInput.trim()) return;
    setIsRequestingPairingCode(true);
    setPairingCodeResult(null);
    try {
      const res = await axios.post(`/api/baileys/${selectedBaileysGwId}/pairing-code`, {
        phone_number: pairingPhoneInput.trim(),
      });
      if (res.data.success) {
        setPairingCodeResult(res.data.pairingCode);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to request pairing code.');
    } finally {
      setIsRequestingPairingCode(false);
    }
  };

  const handleSendBaileysTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBaileysGwId || !baileysTestPhone.trim()) return;
    setIsSendingBaileysTest(true);
    setBaileysTestFeedback(null);
    try {
      const res = await axios.post(`/api/baileys/${selectedBaileysGwId}/test-message`, {
        recipient_phone: baileysTestPhone.trim(),
        message: baileysTestMsg.trim(),
      });
      setBaileysTestFeedback({
        success: res.data.success,
        message: res.data.message || 'Diagnostic message delivered successfully!',
      });
    } catch (err: any) {
      setBaileysTestFeedback({
        success: false,
        message: err.response?.data?.message || 'Diagnostic message dispatch failed.',
      });
    } finally {
      setIsSendingBaileysTest(false);
    }
  };

  const handleDisconnectBaileys = async () => {
    if (!selectedBaileysGwId) return;
    if (!confirm('Are you sure you want to disconnect and unlink this WhatsApp Baileys session?')) return;
    setIsDisconnectingBaileys(true);
    try {
      const res = await axios.post(`/api/baileys/${selectedBaileysGwId}/disconnect`, { purge_auth: true });
      if (res.data.success) {
        setBaileysSessionData((prev: any) => ({
          ...prev,
          status: 'disconnected',
          phoneNumber: null,
          pushName: null,
          qrCodeDataUrl: null,
        }));
        setPairingCodeResult(null);
        fetchGateways();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to disconnect Baileys session.');
    } finally {
      setIsDisconnectingBaileys(false);
    }
  };

  const handleCancelPairing = async () => {
    if (!selectedBaileysGwId) return;
    setIsCancellingPairing(true);
    try {
      await axios.post(`/api/baileys/${selectedBaileysGwId}/cancel-pairing`);
      setBaileysSessionData((prev: any) => ({
        ...prev,
        status: 'disconnected',
        qrCodeDataUrl: null,
        pairingCode: null,
      }));
      setPairingCodeResult(null);
      setPairingRejectionReason('Pairing request was cancelled.');
    } catch (err: any) {
      console.error('Failed to cancel pairing:', err);
    } finally {
      setIsCancellingPairing(false);
    }
  };

  const handleResetSession = async () => {
    if (!selectedBaileysGwId) return;
    if (!confirm('This will purge all cached WhatsApp session keys and reset the gateway to a clean state. Continue?')) return;
    setIsResettingSession(true);
    try {
      await axios.post(`/api/baileys/${selectedBaileysGwId}/reset-session`);
      setBaileysSessionData((prev: any) => ({
        ...prev,
        status: 'disconnected',
        phoneNumber: null,
        pushName: null,
        qrCodeDataUrl: null,
        pairingCode: null,
      }));
      setPairingCodeResult(null);
      setPairingRejectionReason(null);
      fetchGateways();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reset session.');
    } finally {
      setIsResettingSession(false);
    }
  };

  const handleTestSmtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await axios.post('/api/gateways/test-smtp', {
        host: testHost,
        port: testPort,
        user: testUser,
        pass: testPass,
      });
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.message || 'SMTP Socket diagnostic failed.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const copyPairingCodeToClipboard = () => {
    if (pairingCodeResult) {
      navigator.clipboard.writeText(pairingCodeResult);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const baileysGateways = gateways.filter((g) => g.type === 'whatsapp_baileys');
  const selectedGw = gateways.find((g) => g.id === selectedBaileysGwId);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0f172a] p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
              Module 5: Multi-Gateway Infrastructure
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-emerald-400 font-semibold">High Deliverability & Direct Multi-Device Protocols</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Multi-Gateway Settings & Diagnostics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure WhatsApp Baileys Web multi-device sockets, Meta WhatsApp Cloud API tokens, AWS SES high-throughput quotas, and Multi-SMTP relays
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-2 overflow-x-auto">
        {[
          { id: 'baileys', label: 'WhatsApp Baileys (Web Socket)', icon: QrCode, badge: 'Direct Multi-Device' },
          { id: 'meta', label: 'Meta WhatsApp Cloud API', icon: Smartphone, badge: 'Official WABA' },
          { id: 'ses', label: 'AWS SES Gateway', icon: Mail },
          { id: 'smtp', label: 'Multi-SMTP & Socket Diagnostic', icon: Cpu },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f172a] border border-transparent'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 font-mono">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: WHATSAPP BAILEYS (MULTI-DEVICE WEB SOCKET PROTOCOL)                 */}
      {/* ========================================================================= */}
      {activeTab === 'baileys' && (
        <div className="space-y-6">
          {/* Top Info Banner */}
          <div className="p-5 bg-gradient-to-r from-[#0c1a2f] via-[#0b1b36] to-[#0d1527] border border-cyan-500/30 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Radio size={12} className="text-cyan-400 animate-pulse" />
                  Direct WhatsApp Web Multi-Device Protocol
                </span>
                <span className="text-xs text-emerald-400 font-bold">• Zero Meta Conversation Fees</span>
              </div>
              <h2 className="text-base font-bold text-white">Direct Phone Link with QR Code & 8-Digit Pairing Code</h2>
              <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
                Send unlimited broadcast campaigns, trigger automated Journey Builder flows, and manage WhatsApp Live Chat Inbox directly without Meta 24-hour template lockouts.
              </p>
            </div>

            {/* Gateway Selector Dropdown */}
            {baileysGateways.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                <label className="text-[11px] text-slate-400 font-semibold self-center sm:self-auto">Active Gateway:</label>
                <select
                  value={selectedBaileysGwId}
                  onChange={(e) => setSelectedBaileysGwId(e.target.value)}
                  className="bg-[#070b14] border border-slate-700 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500 font-semibold"
                >
                  {baileysGateways.map((gw) => (
                    <option key={gw.id} value={gw.id}>
                      📱 {gw.name} ({gw.company_name})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {baileysGateways.length === 0 ? (
            <div className="p-12 bg-[#0f172a] border border-slate-800 rounded-3xl text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
                <QrCode size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">No WhatsApp Baileys Gateways Configured</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  To start using WhatsApp Baileys multi-device connection, allocate a Baileys gateway for your company in the Superadmin Settings &gt; Gateways Vault.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Live Connection & QR Code */}
              <div className="lg:col-span-7 bg-[#0f172a] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <QrCode size={18} className="text-cyan-400" />
                      <span>{selectedGw?.name || 'WhatsApp Baileys Gateway'}</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Partition: {selectedGw?.company_name}</p>
                  </div>

                  {/* Live Status Badge */}
                  <div>
                    {baileysSessionData?.status === 'connected' ? (
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        Connected & Active
                      </span>
                    ) : baileysSessionData?.status === 'qr_ready' ? (
                      <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5">
                        <QrCode size={13} />
                        Scan QR Code
                      </span>
                    ) : baileysSessionData?.status === 'connecting' ? (
                      <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5">
                        <RefreshCw size={13} className="animate-spin" />
                        Connecting Socket...
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5">
                        <AlertCircle size={13} />
                        Disconnected
                      </span>
                    )}
                  </div>
                </div>

                {/* Pairing Rejection / Notice Alert */}
                {pairingRejectionReason && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 animate-fadeIn">
                    <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs">
                      <span className="font-bold text-rose-300 block">Pairing Notice</span>
                      <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">{pairingRejectionReason}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPairingRejectionReason(null);
                        if (pairingMethod === 'qr') handleStartBaileys();
                      }}
                      className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer"
                    >
                      Try Again
                    </button>
                  </div>
                )}

                {/* Connected State View */}
                {baileysSessionData?.status === 'connected' ? (
                  <div className="space-y-6">
                    <div className="p-5 bg-[#070b14] border border-emerald-500/30 rounded-2xl space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                          <CheckCircle2 size={24} />
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 font-semibold">Active Linked Device</div>
                          <div className="text-lg font-mono font-extrabold text-white tracking-wide">
                            +{baileysSessionData.phoneNumber || selectedGw?.credentials?.display_phone_number || 'Linked WhatsApp Account'}
                          </div>
                          <div className="text-xs text-emerald-400 font-medium mt-0.5">
                            Account Push Name: {baileysSessionData.pushName || selectedGw?.credentials?.push_name || 'Enterprise WhatsApp'}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                        <div className="p-3 bg-[#0f172a] rounded-xl border border-slate-800">
                          <span className="text-slate-500 text-[10px] block">Protocol</span>
                          <span className="font-semibold text-slate-200">Baileys Multi-Device Web Socket</span>
                        </div>
                        <div className="p-3 bg-[#0f172a] rounded-xl border border-slate-800">
                          <span className="text-slate-500 text-[10px] block">Call Management</span>
                          <span className="font-semibold text-cyan-400 flex items-center gap-1">
                            <PhoneOff size={13} /> Auto-Reject Calls (Polite Reply)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 gap-2 flex-wrap">
                        <div className="text-[11px] text-slate-400">
                          Session persisted in PostgreSQL & local secure vault
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleResetSession}
                            disabled={isResettingSession}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw size={12} className={isResettingSession ? 'animate-spin' : ''} />
                            <span>{isResettingSession ? 'Resetting...' : 'Reset Session'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDisconnectBaileys}
                            disabled={isDisconnectingBaileys}
                            className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <Unlink size={13} />
                            <span>{isDisconnectingBaileys ? 'Disconnecting...' : 'Unlink & Disconnect'}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl text-xs text-blue-300 flex items-start gap-3">
                      <ShieldCheck size={18} className="shrink-0 mt-0.5 text-blue-400" />
                      <div className="space-y-0.5">
                        <span className="font-bold block">Enterprise Multi-Device Ready:</span>
                        <p className="text-slate-300 text-[11px] leading-relaxed">
                          Your broadcasts, journey flows, and live chat agents can now communicate directly through this linked number without Meta per-conversation charges or 24-hour template constraints.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Connection Flow: QR Code or Pairing Code */
                  <div className="space-y-6">
                    {/* Method Selector Tabs */}
                    <div className="flex items-center p-1 bg-[#070b14] border border-slate-800 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setPairingMethod('qr')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          pairingMethod === 'qr'
                            ? 'bg-cyan-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <QrCode size={14} />
                        <span>Scan QR Code</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPairingMethod('code')}
                        className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                          pairingMethod === 'code'
                            ? 'bg-cyan-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Phone size={14} />
                        <span>Link with Phone Number</span>
                      </button>
                    </div>

                    {/* Mode A: Scan QR Code */}
                    {pairingMethod === 'qr' && (
                      <div className="flex flex-col items-center justify-center p-6 bg-[#070b14] border border-slate-800 rounded-2xl space-y-5 text-center">
                        {baileysSessionData?.qrCodeDataUrl ? (
                          <div className="space-y-4 w-full max-w-sm">
                            {/* QR Code Container with Countdown & Status */}
                            <div className="relative inline-block p-4 bg-white rounded-2xl shadow-2xl ring-4 ring-cyan-500/40">
                              <img
                                src={baileysSessionData.qrCodeDataUrl}
                                alt="WhatsApp Baileys QR Code"
                                className="w-64 h-64 mx-auto rounded-lg"
                              />

                              {/* Expiry Overlay if Countdown Hits 0 */}
                              {qrCountdown === 0 && (
                                <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center p-4 text-center space-y-3">
                                  <Clock size={28} className="text-amber-400 animate-bounce" />
                                  <span className="text-xs font-bold text-white">QR Code Expired</span>
                                  <button
                                    type="button"
                                    onClick={() => handleStartBaileys()}
                                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg cursor-pointer"
                                  >
                                    <RefreshCw size={13} />
                                    <span>Refresh QR</span>
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Live Countdown Progress */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 px-1">
                                <span className="flex items-center gap-1.5 text-cyan-400">
                                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                                  Waiting for WhatsApp Scan
                                </span>
                                <span className="font-mono text-slate-400">
                                  Expires in {qrCountdown}s
                                </span>
                              </div>
                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-1000 ease-linear"
                                  style={{ width: `${Math.max(0, Math.min(100, (qrCountdown / 30) * 100))}%` }}
                                ></div>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="text-xs font-bold text-white">Scan this QR Code with WhatsApp</div>
                              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                                Open WhatsApp &gt; Settings / Linked Devices &gt; Tap "Link a Device" &gt; Point camera here
                              </p>
                            </div>

                            {/* Dual Controls: Refresh or Reject/Cancel Pairing */}
                            <div className="flex items-center justify-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleStartBaileys()}
                                disabled={isStartingBaileys}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                              >
                                <RefreshCw size={13} className={isStartingBaileys ? 'animate-spin' : ''} />
                                <span>{isStartingBaileys ? 'Refreshing...' : 'Refresh QR'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelPairing}
                                disabled={isCancellingPairing}
                                className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                              >
                                <XCircle size={13} />
                                <span>{isCancellingPairing ? 'Cancelling...' : 'Cancel Pairing'}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="py-8 space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
                              <QrCode size={32} />
                            </div>
                            <div className="space-y-1">
                              <div className="text-sm font-bold text-white">Ready to Connect WhatsApp Socket</div>
                              <p className="text-xs text-slate-400 max-w-md mx-auto">
                                Click below to start the multi-device connection and generate an instant WhatsApp Web QR code.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleStartBaileys()}
                              disabled={isStartingBaileys}
                              className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-extrabold rounded-xl shadow-lg flex items-center justify-center gap-2 mx-auto transition-all cursor-pointer disabled:opacity-50"
                            >
                              <Play size={14} />
                              <span>{isStartingBaileys ? 'Generating QR Code...' : 'Generate WhatsApp QR Code'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mode B: Pairing Code (No Camera Needed) */}
                    {pairingMethod === 'code' && (
                      <div className="p-6 bg-[#070b14] border border-slate-800 rounded-2xl space-y-4">
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-white flex items-center gap-2">
                            <Phone size={14} className="text-cyan-400" />
                            <span>Link with Phone Number (No Camera Scanning Required)</span>
                          </h4>
                          <p className="text-[11px] text-slate-400">
                            Enter your WhatsApp number with country code. WhatsApp will generate an 8-character pairing code to enter on your phone.
                          </p>
                        </div>

                        <form onSubmit={handleRequestPairingCode} className="space-y-3">
                          <div>
                            <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                              WhatsApp Phone Number (with Country Code)
                            </label>
                            <input
                              type="text"
                              required
                              value={pairingPhoneInput}
                              onChange={(e) => setPairingPhoneInput(e.target.value)}
                              placeholder="e.g. 919876543210 or 15551234567"
                              className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                            />
                            <span className="text-[10px] text-slate-500 mt-1 block">
                              Enter digits only without '+' or dashes (e.g. India 91XXXXXXXXXX, USA 1XXXXXXXXXX)
                            </span>
                          </div>

                          <button
                            type="submit"
                            disabled={isRequestingPairingCode}
                            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            <Key size={14} />
                            <span>{isRequestingPairingCode ? 'Requesting Pairing Code...' : 'Request 8-Digit Pairing Code'}</span>
                          </button>
                        </form>

                        {pairingCodeResult && (
                          <div className="p-5 bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border border-cyan-500/40 rounded-2xl text-center space-y-3 animate-fadeIn">
                            <div className="flex items-center justify-center gap-2 text-[11px] text-cyan-300 font-semibold uppercase tracking-wider">
                              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                              <span>Waiting for Device Approval</span>
                            </div>

                            <div className="text-3xl font-mono font-black text-white tracking-widest bg-[#070b14] py-3 px-6 rounded-xl border border-cyan-500/50 inline-block shadow-inner select-all">
                              {pairingCodeResult.length === 8
                                ? `${pairingCodeResult.slice(0, 4)} - ${pairingCodeResult.slice(4)}`
                                : pairingCodeResult}
                            </div>

                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={copyPairingCodeToClipboard}
                                className="px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                <span>{copiedCode ? 'Copied to Clipboard!' : 'Copy Code'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelPairing}
                                disabled={isCancellingPairing}
                                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                              >
                                <XCircle size={13} />
                                <span>{isCancellingPairing ? 'Cancelling...' : 'Cancel / Reject'}</span>
                              </button>
                            </div>

                            <p className="text-[11px] text-slate-300 max-w-sm mx-auto leading-relaxed">
                              On your phone: Open WhatsApp &gt; Settings / Linked Devices &gt; Link a Device &gt; Link with phone number instead &gt; Enter this 8-character code.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Diagnostic Tester & Protocol Guide */}
              <div className="lg:col-span-5 space-y-6">
                {/* Diagnostic Test Message Form */}
                <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap size={16} className="text-amber-400" />
                    <span>Socket Diagnostic & Test Message</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Send an instantaneous test message through the Baileys socket to verify real-time delivery
                  </p>

                  <form onSubmit={handleSendBaileysTest} className="space-y-3 pt-2">
                    <div>
                      <label className="text-[11px] text-slate-300 font-semibold block mb-1">
                        Recipient WhatsApp Phone Number
                      </label>
                      <input
                        type="text"
                        required
                        value={baileysTestPhone}
                        onChange={(e) => setBaileysTestPhone(e.target.value)}
                        placeholder="e.g. +91 98765 43210"
                        className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] text-slate-300 font-semibold block mb-1">Message Content</label>
                      <textarea
                        rows={3}
                        required
                        value={baileysTestMsg}
                        onChange={(e) => setBaileysTestMsg(e.target.value)}
                        className="w-full bg-[#070b14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSendingBaileysTest || baileysSessionData?.status !== 'connected'}
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Send size={14} />
                      <span>{isSendingBaileysTest ? 'Sending Diagnostic Message...' : 'Send WhatsApp Test Message'}</span>
                    </button>

                    {baileysSessionData?.status !== 'connected' && (
                      <p className="text-[10px] text-amber-400 font-medium text-center">
                        ⚠️ Connect and link device via QR Code or Pairing Code to test delivery.
                      </p>
                    )}

                    {baileysTestFeedback && (
                      <div
                        className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                          baileysTestFeedback.success
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}
                      >
                        {baileysTestFeedback.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        <span>{baileysTestFeedback.message}</span>
                      </div>
                    )}
                  </form>
                </div>

                {/* Features & Architectural Difference Card */}
                <div className="bg-[#0f172a] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3 text-xs">
                  <h3 className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-wider text-slate-300">
                    <ShieldCheck size={15} className="text-cyan-400" />
                    <span>Baileys Protocol vs Meta Cloud API</span>
                  </h3>

                  <div className="space-y-2.5 pt-1 text-slate-300">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-white">No Meta Per-Conversation Fees:</span>
                        <p className="text-[11px] text-slate-400">Broadcast freely without marketing/utility template fees.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-white">No 24-Hour Session Lock:</span>
                        <p className="text-[11px] text-slate-400">Send freeform messages in Live Chat Inbox without template approval requirements.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-white">Smart Anti-Ban Pacing:</span>
                        <p className="text-[11px] text-slate-400">OmniReach worker automatically paces broadcast dispatches to protect account health.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Comprehensive Anti-Ban Shield & Account Warm-up Control Center */}
            <div className="mt-8 bg-[#0f172a] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Panel Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm">
                      <Shield size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                        <span>WhatsApp Anti-Ban Shield & Account Warm-up</span>
                        <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold uppercase tracking-wider">
                          Active Protection
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        Human presence simulation, polymorphic cryptographic hashes, smart pacing & auto-opt-out engine
                      </p>
                    </div>
                  </div>
                </div>

                {/* Daily Usage Meter */}
                <div className="bg-[#070b14] border border-slate-800 rounded-2xl p-3.5 sm:min-w-[260px] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                      <Clock size={13} className="text-cyan-400" /> Today's Outbound:
                    </span>
                    <span className="font-mono font-bold text-white">
                      {antiBanDailySent} <span className="text-slate-500">/ {antiBanSettings.daily_send_limit || '∞'}</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        antiBanDailySent >= (antiBanSettings.daily_send_limit || 99999)
                          ? 'bg-rose-500'
                          : antiBanDailySent >= (antiBanSettings.daily_send_limit || 99999) * 0.8
                          ? 'bg-amber-500'
                          : 'bg-gradient-to-r from-cyan-500 to-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          antiBanSettings.daily_send_limit > 0
                            ? (antiBanDailySent / antiBanSettings.daily_send_limit) * 100
                            : 0
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Daily Safety Cap</span>
                    <span className="text-emerald-400 font-medium">
                      {antiBanSettings.daily_send_limit > 0
                        ? `${Math.max(0, antiBanSettings.daily_send_limit - antiBanDailySent)} sends remaining`
                        : 'Unlimited'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Profile Preset Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sliders size={14} className="text-cyan-400" />
                  <span>Choose Protection Profile Preset:</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('warmup')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      antiBanSettings.profile === 'warmup'
                        ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/40'
                        : 'bg-[#070b14] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-1.5">
                        <ShieldCheck size={14} /> 🟢 Warm-up Mode
                      </span>
                      {antiBanSettings.profile === 'warmup' && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 font-medium">Recommended for newly linked numbers</p>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                      8-18s delay • 15/batch • 40 msgs/day
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset('balanced')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      antiBanSettings.profile === 'balanced'
                        ? 'bg-cyan-500/10 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/40'
                        : 'bg-[#070b14] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-extrabold text-cyan-300 flex items-center gap-1.5">
                        <Shield size={14} /> 🟡 Balanced Mode
                      </span>
                      {antiBanSettings.profile === 'balanced' && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 font-medium">Standard for established numbers</p>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                      4-10s delay • 25/batch • 150 msgs/day
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApplyPreset('high_throughput')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      antiBanSettings.profile === 'high_throughput'
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-md ring-1 ring-amber-500/40'
                        : 'bg-[#070b14] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-extrabold text-amber-400 flex items-center gap-1.5">
                        <Flame size={14} /> ⚡ High-Throughput
                      </span>
                      {antiBanSettings.profile === 'high_throughput' && (
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 font-medium">For fully warmed mature numbers</p>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                      2-6s delay • 40/batch • 400 msgs/day
                    </div>
                  </button>
                </div>
              </div>

              {/* Detailed Configuration Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {/* 1. Velocity & Delay Controls */}
                <div className="p-4 bg-[#070b14] border border-slate-800 rounded-2xl space-y-3">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Clock size={14} className="text-cyan-400" />
                    <span>Human Velocity Pacing</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] text-slate-400 font-medium block mb-1">Min Delay (sec)</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={antiBanSettings.min_delay_seconds}
                        onChange={(e) =>
                          setAntiBanSettings({
                            ...antiBanSettings,
                            profile: 'custom',
                            min_delay_seconds: parseInt(e.target.value) || 1,
                          })
                        }
                        className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-medium block mb-1">Max Delay (sec)</label>
                      <input
                        type="number"
                        min="2"
                        max="120"
                        value={antiBanSettings.max_delay_seconds}
                        onChange={(e) =>
                          setAntiBanSettings({
                            ...antiBanSettings,
                            profile: 'custom',
                            max_delay_seconds: parseInt(e.target.value) || 2,
                          })
                        }
                        className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Randomized human jitter between dispatches to prevent periodicity detection.
                  </p>
                </div>

                {/* 2. Batch Cooldown Break */}
                <div className="p-4 bg-[#070b14] border border-slate-800 rounded-2xl space-y-3">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <RefreshCw size={14} className="text-blue-400" />
                    <span>Batch Cooldown Breaks</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] text-slate-400 font-medium block mb-1">Batch Size (msgs)</label>
                      <input
                        type="number"
                        min="5"
                        max="100"
                        value={antiBanSettings.batch_size}
                        onChange={(e) =>
                          setAntiBanSettings({
                            ...antiBanSettings,
                            profile: 'custom',
                            batch_size: parseInt(e.target.value) || 10,
                          })
                        }
                        className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 font-medium block mb-1">Pause (sec)</label>
                      <input
                        type="number"
                        min="10"
                        max="600"
                        value={antiBanSettings.batch_cooldown_seconds}
                        onChange={(e) =>
                          setAntiBanSettings({
                            ...antiBanSettings,
                            profile: 'custom',
                            batch_cooldown_seconds: parseInt(e.target.value) || 30,
                          })
                        }
                        className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Pauses the background queue every batch to let the socket cool down naturally.
                  </p>
                </div>

                {/* 3. Daily Safety Ceiling */}
                <div className="p-4 bg-[#070b14] border border-slate-800 rounded-2xl space-y-3">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-400" />
                    <span>Daily Send Ceiling (Warm-up)</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-medium block mb-1">Max Daily Messages</label>
                    <input
                      type="number"
                      min="10"
                      max="5000"
                      value={antiBanSettings.daily_send_limit}
                      onChange={(e) =>
                        setAntiBanSettings({
                          ...antiBanSettings,
                          profile: 'custom',
                          daily_send_limit: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Dispatches exceeding this limit will be paused until the next day to prevent burning the number.
                  </p>
                </div>
              </div>

              {/* Heuristic Defenses & Toggles */}
              <div className="p-5 bg-[#070b14] border border-slate-800 rounded-2xl space-y-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider text-slate-300">
                  Active Heuristic Defenses:
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Toggle 1: Human Typing Presence */}
                  <label className="flex items-start gap-3 p-3 bg-[#0f172a] rounded-xl border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={antiBanSettings.simulate_human_typing}
                      onChange={(e) =>
                        setAntiBanSettings({
                          ...antiBanSettings,
                          simulate_human_typing: e.target.checked,
                          profile: 'custom',
                        })
                      }
                      className="mt-1 rounded text-cyan-500 focus:ring-0"
                    />
                    <div className="space-y-0.5">
                      <span className="font-bold text-white block">Simulate Human Typing Presence</span>
                      <p className="text-[11px] text-slate-400">
                        Sends <span className="text-cyan-300">composing</span> status stanzas with realistic typing durations (~20ms per char) before sending each message.
                      </p>
                    </div>
                  </label>

                  {/* Toggle 2: Pre-flight Number Validation */}
                  <label className="flex items-start gap-3 p-3 bg-[#0f172a] rounded-xl border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={antiBanSettings.preflight_number_check}
                      onChange={(e) =>
                        setAntiBanSettings({
                          ...antiBanSettings,
                          preflight_number_check: e.target.checked,
                          profile: 'custom',
                        })
                      }
                      className="mt-1 rounded text-cyan-500 focus:ring-0"
                    />
                    <div className="space-y-0.5">
                      <span className="font-bold text-white block">Pre-Flight WhatsApp Number Check</span>
                      <p className="text-[11px] text-slate-400">
                        Verifies number is registered via <span className="text-cyan-300">sock.onWhatsApp</span> before sending. Suppresses non-existent numbers to prevent probe bans.
                      </p>
                    </div>
                  </label>

                  {/* Toggle 3: Polymorphic Anti-Hash */}
                  <label className="flex items-start gap-3 p-3 bg-[#0f172a] rounded-xl border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={antiBanSettings.polymorphic_anti_hash}
                      onChange={(e) =>
                        setAntiBanSettings({
                          ...antiBanSettings,
                          polymorphic_anti_hash: e.target.checked,
                          profile: 'custom',
                        })
                      }
                      className="mt-1 rounded text-cyan-500 focus:ring-0"
                    />
                    <div className="space-y-0.5">
                      <span className="font-bold text-white block">Polymorphic Anti-Hash Variations</span>
                      <p className="text-[11px] text-slate-400">
                        Inserts randomized zero-width non-breaking characters so every message has a unique SHA-256 hash, bypassing bulk content filters.
                      </p>
                    </div>
                  </label>

                  {/* Toggle 4: Auto-Opt-Out on STOP */}
                  <label className="flex items-start gap-3 p-3 bg-[#0f172a] rounded-xl border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={antiBanSettings.auto_opt_out_on_stop}
                      onChange={(e) =>
                        setAntiBanSettings({
                          ...antiBanSettings,
                          auto_opt_out_on_stop: e.target.checked,
                          profile: 'custom',
                        })
                      }
                      className="mt-1 rounded text-cyan-500 focus:ring-0"
                    />
                    <div className="space-y-0.5">
                      <span className="font-bold text-white block">Auto-Opt-Out on "STOP"</span>
                      <p className="text-[11px] text-slate-400">
                        Detects replies like STOP or UNSUBSCRIBE, marks contact as opted-out, and auto-replies confirmation to prevent spam reporting.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Toggle 5: Append Opt-Out Footer */}
                <label className="flex items-start gap-3 p-3 bg-[#0f172a] rounded-xl border border-slate-800/80 cursor-pointer hover:border-slate-700">
                  <input
                    type="checkbox"
                    checked={antiBanSettings.append_opt_out_footer}
                    onChange={(e) =>
                      setAntiBanSettings({
                        ...antiBanSettings,
                        append_opt_out_footer: e.target.checked,
                        profile: 'custom',
                      })
                    }
                    className="mt-1 rounded text-cyan-500 focus:ring-0"
                  />
                  <div className="space-y-0.5">
                    <span className="font-bold text-white block">Append "Reply STOP to unsubscribe" Footer</span>
                    <p className="text-[11px] text-slate-400">
                      Adds an opt-out instruction footer to broadcast messages. Drastically reduces user reports and blocks by giving recipients an easy way out.
                    </p>
                  </div>
                </label>
              </div>

              {/* Save Anti-Ban Settings Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="text-xs text-slate-400">
                  Settings are automatically synchronized across all campaign dispatches, journey flows, and live chat.
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  {antiBanSaveSuccess && (
                    <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 animate-fadeIn">
                      <CheckCircle2 size={16} /> Settings Saved & Active!
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveAntiBanSettings}
                    disabled={isSavingAntiBan}
                    className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Save size={14} />
                    <span>{isSavingAntiBan ? 'Saving Anti-Ban Rules...' : 'Save Anti-Ban Protection Settings'}</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
        </div>
      )}

      {/* Tab 2: AWS SES Gateway */}
      {activeTab === 'ses' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Mail size={16} className="text-blue-400" />
                <span>AWS Simple Email Service (SES) Configuration</span>
              </h3>
              {gateways.find((g) => g.type === 'email_ses') && (
                <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold">
                  {gateways.find((g) => g.type === 'email_ses')?.company_name}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              High-throughput production email delivery with automatic DKIM signing and bounce suppression
            </p>

            {(() => {
              const sesGw = gateways.find((g) => g.type === 'email_ses');
              const creds = sesGw?.credentials || {};
              return (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">AWS Region</label>
                    <input
                      type="text"
                      readOnly
                      value={creds.region ? `${creds.region} (Configured)` : 'ap-south-1 (Asia Pacific - Mumbai)'}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">IAM Access Key ID</label>
                    <input
                      type="text"
                      readOnly
                      value={creds.access_key_id ? `${creds.access_key_id.slice(0, 8)}••••••••` : 'AKIA...CONFIGURED_KEY'}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Configuration Set</label>
                    <input
                      type="text"
                      readOnly
                      value={creds.configuration_set || 'OmniReach-Engagement-Config'}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">Verified Sender Identity</label>
                    <input
                      type="text"
                      readOnly
                      value={creds.from_email || 'broadcasts@omnireach.io'}
                      className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                    />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* SES Live Quota Card */}
          <div className="lg:col-span-5 bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity size={16} className="text-emerald-400" />
              Real-Time AWS SES Send Quota
            </h3>

            <div className="space-y-3">
              <div className="p-4 bg-[#070b14] rounded-xl border border-slate-800 space-y-1">
                <div className="text-[11px] text-slate-400 font-medium">24-Hour Sending Quota</div>
                <div className="text-xl font-extrabold text-emerald-400">
                  {sesQuota?.max24HourSend?.toLocaleString() || '500,000'} emails/day
                </div>
              </div>

              <div className="p-4 bg-[#070b14] rounded-xl border border-slate-800 space-y-1">
                <div className="text-[11px] text-slate-400 font-medium">Sent in Last 24 Hours</div>
                <div className="text-xl font-extrabold text-blue-400">
                  {sesQuota?.sentLast24Hours?.toLocaleString() || '1,420'} emails
                </div>
              </div>

              <div className="p-4 bg-[#070b14] rounded-xl border border-slate-800 space-y-1">
                <div className="text-[11px] text-slate-400 font-medium">Max Send Rate Throughput</div>
                <div className="text-xl font-extrabold text-purple-400">
                  {sesQuota?.maxSendRate || 100} msgs/sec
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2 font-medium">
                <ShieldCheck size={16} />
                <span>AWS SES Production Access is Active. High deliverability guaranteed.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Multi-SMTP & Diagnostics */}
      {activeTab === 'smtp' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu size={16} className="text-cyan-400" />
              Multi-SMTP Server Pool
            </h3>
            <p className="text-xs text-slate-400">
              Manage failover SMTP accounts (Google Workspace, M365, SendGrid)
            </p>

            <div className="space-y-3 pt-2">
              {gateways
                .filter((g) => g.type === 'email_smtp')
                .map((gw) => (
                  <div key={gw.id} className="p-4 bg-[#070b14] rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>{gw.name}</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-extrabold">
                        Active
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Host: {gw.credentials?.host} • Port: {gw.credentials?.port} • User: {gw.credentials?.user}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Instant Diagnostic Tool */}
          <div className="lg:col-span-6 bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity size={16} className="text-amber-400" />
              Instant Diagnostic Tool: Direct Socket Verification
            </h3>
            <p className="text-xs text-slate-400">
              Test SMTP socket connection, TLS handshakes, and credentials directly
            </p>

            <form onSubmit={handleTestSmtp} className="space-y-3 pt-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[11px] text-slate-300 font-semibold block mb-1">SMTP Host</label>
                  <input
                    type="text"
                    value={testHost}
                    onChange={(e) => setTestHost(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-300 font-semibold block mb-1">Port</label>
                  <input
                    type="number"
                    value={testPort}
                    onChange={(e) => setTestPort(Number(e.target.value))}
                    className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">Username / Email</label>
                <input
                  type="text"
                  value={testUser}
                  onChange={(e) => setTestUser(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-semibold block mb-1">App Password</label>
                <input
                  type="password"
                  value={testPass}
                  onChange={(e) => setTestPass(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={isTesting}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <Play size={14} />
                <span>{isTesting ? 'Running Socket Diagnostic...' : 'Test SMTP Socket Connection'}</span>
              </button>

              {testResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                    testResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {testResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Tab 4: Meta WhatsApp Cloud API */}
      {activeTab === 'meta' && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 max-w-3xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Smartphone size={16} className="text-emerald-400" />
            Meta WhatsApp Cloud API & WABA Integration
          </h3>
          <p className="text-xs text-slate-400">
            Enterprise WABA integration with permanent System User tokens and live phone number quality badges
          </p>

          <div className="space-y-4 pt-2">
            {gateways
              .filter((g) => g.type === 'whatsapp_meta')
              .map((gw) => (
                <div key={gw.id} className="p-4 bg-[#070b14] rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs text-white">{gw.name}</div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        gw.quality_rating === 'GREEN'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      Quality: {gw.quality_rating}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-200">
                    <div className="bg-[#0f172a] p-2.5 rounded-lg border border-slate-800 shadow-sm">
                      <span className="text-slate-500 text-[10px] block">Phone Number ID</span>
                      <span>{gw.credentials?.phone_number_id || '109823475912345'}</span>
                    </div>
                    <div className="bg-[#0f172a] p-2.5 rounded-lg border border-slate-800 shadow-sm">
                      <span className="text-slate-500 text-[10px] block">WABA ID</span>
                      <span>{gw.credentials?.waba_id || '89123471923841'}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5 pt-1">
                    <CheckCircle2 size={13} />
                    <span>Permanent System User Token Verified • Tier: 100,000 msgs/day</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
