import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  X,
  QrCode,
  Phone,
  RefreshCw,
  Play,
  Key,
  Copy,
  Check,
  XCircle,
  AlertCircle,
  CheckCircle2,
  PhoneOff,
  Unlink,
  Send,
  Clock,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useSocket } from '../../context/SocketContext';

interface BaileysPairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  gateway: any;
  onSuccess?: () => void;
}

export const BaileysPairingModal: React.FC<BaileysPairingModalProps> = ({
  isOpen,
  onClose,
  gateway,
  onSuccess,
}) => {
  const { lastEvent } = useSocket();

  const [sessionData, setSessionData] = useState<any | null>(null);
  const [pairingMethod, setPairingMethod] = useState<'qr' | 'code'>('qr');
  const [pairingPhoneInput, setPairingPhoneInput] = useState('');
  const [pairingCodeResult, setPairingCodeResult] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const [isStarting, setIsStarting] = useState(false);
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [qrCountdown, setQrCountdown] = useState<number>(30);
  const [pairingRejectionReason, setPairingRejectionReason] = useState<string | null>(null);

  // Diagnostic Test Message
  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('🚀 Hello from OmniReach Baileys WhatsApp Gateway! Socket connection verified.');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const gatewayId = gateway?.id;

  // Load gateway status whenever modal opens
  useEffect(() => {
    if (isOpen && gatewayId) {
      fetchStatus();
      setPairingRejectionReason(null);
      setPairingCodeResult(null);
    }
  }, [isOpen, gatewayId]);

  const fetchStatus = async () => {
    if (!gatewayId) return;
    try {
      const res = await axios.get(`/api/baileys/${gatewayId}/status`);
      if (res.data.success) {
        setSessionData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch Baileys status:', err);
    }
  };

  // Listen to WebSocket events for this gateway
  useEffect(() => {
    if (!lastEvent || !isOpen || !gatewayId) return;
    const { type, data } = lastEvent;

    if (data?.gatewayId !== gatewayId) return;

    if (type === 'BAILEYS_QR') {
      setSessionData((prev: any) => ({
        ...prev,
        status: 'qr_ready',
        qrCodeDataUrl: data.qrCodeDataUrl,
        hasQr: true,
      }));
      setQrCountdown(30);
      setPairingRejectionReason(null);
    }

    if (type === 'BAILEYS_STATUS') {
      setSessionData((prev: any) => ({
        ...prev,
        status: data.status,
        phoneNumber: data.phoneNumber || prev?.phoneNumber,
        pushName: data.pushName || prev?.pushName,
        connectedAt: data.connectedAt || prev?.connectedAt,
      }));

      if (data.reason === 'pairing_rejected') {
        setPairingRejectionReason(
          'Pairing was rejected or cancelled on your WhatsApp mobile device. Please try scanning the QR code or requesting a new code.'
        );
        setPairingCodeResult(null);
      } else if (data.reason === 'pairing_timeout') {
        setPairingRejectionReason('Pairing request timed out. Please refresh the QR code or request a new code.');
      } else if (data.reason === 'pairing_cancelled') {
        setPairingRejectionReason(null);
        setPairingCodeResult(null);
      } else if (data.status === 'connected') {
        setPairingRejectionReason(null);
        setPairingCodeResult(null);
        if (onSuccess) onSuccess();
      }
    }

    if (type === 'BAILEYS_PAIRING_CODE') {
      setPairingCodeResult(data.pairingCode);
      setPairingRejectionReason(null);
    }
  }, [lastEvent, isOpen, gatewayId]);

  // QR Countdown Timer
  useEffect(() => {
    let timer: any = null;
    if (sessionData?.status === 'qr_ready' && qrCountdown > 0) {
      timer = setTimeout(() => {
        setQrCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [sessionData?.status, qrCountdown]);

  const handleStartQR = async () => {
    if (!gatewayId) return;
    setIsStarting(true);
    setPairingCodeResult(null);
    setPairingRejectionReason(null);
    setQrCountdown(30);
    try {
      const res = await axios.post(`/api/baileys/${gatewayId}/connect`, {});
      if (res.data.success) {
        setSessionData((prev: any) => ({
          ...prev,
          status: res.data.status,
          qrCodeDataUrl: res.data.qrCodeDataUrl,
          pairingCode: res.data.pairingCode,
        }));
        setQrCountdown(30);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to start Baileys QR socket.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gatewayId || !pairingPhoneInput.trim()) return;
    setIsRequestingCode(true);
    setPairingCodeResult(null);
    setPairingRejectionReason(null);
    try {
      const res = await axios.post(`/api/baileys/${gatewayId}/pairing-code`, {
        phone_number: pairingPhoneInput.trim(),
      });
      if (res.data.success) {
        setPairingCodeResult(res.data.pairingCode);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to request pairing code.');
    } finally {
      setIsRequestingCode(false);
    }
  };

  const copyPairingCode = () => {
    if (!pairingCodeResult) return;
    navigator.clipboard.writeText(pairingCodeResult);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCancelPairing = async () => {
    if (!gatewayId) return;
    setIsCancelling(true);
    try {
      await axios.post(`/api/baileys/${gatewayId}/cancel-pairing`);
      setSessionData((prev: any) => ({
        ...prev,
        status: 'disconnected',
        qrCodeDataUrl: null,
        pairingCode: null,
      }));
      setPairingCodeResult(null);
      setPairingRejectionReason('Pairing was cancelled.');
    } catch (err: any) {
      console.error('Failed to cancel pairing:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDisconnect = async () => {
    if (!gatewayId) return;
    if (!confirm('Are you sure you want to disconnect and unlink this WhatsApp session?')) return;
    setIsDisconnecting(true);
    try {
      const res = await axios.post(`/api/baileys/${gatewayId}/disconnect`, { purge_auth: true });
      if (res.data.success) {
        setSessionData((prev: any) => ({
          ...prev,
          status: 'disconnected',
          phoneNumber: null,
          pushName: null,
          qrCodeDataUrl: null,
        }));
        setPairingCodeResult(null);
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to disconnect session.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleResetSession = async () => {
    if (!gatewayId) return;
    if (!confirm('This will purge all cached session tokens and reset the socket to a fresh state. Continue?')) return;
    setIsResetting(true);
    try {
      await axios.post(`/api/baileys/${gatewayId}/reset-session`);
      setSessionData((prev: any) => ({
        ...prev,
        status: 'disconnected',
        phoneNumber: null,
        pushName: null,
        qrCodeDataUrl: null,
        pairingCode: null,
      }));
      setPairingCodeResult(null);
      setPairingRejectionReason(null);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reset session.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gatewayId || !testPhone.trim()) return;
    setIsSendingTest(true);
    setTestFeedback(null);
    try {
      const res = await axios.post(`/api/baileys/${gatewayId}/test-message`, {
        recipient_phone: testPhone.trim(),
        message: testMsg.trim(),
      });
      setTestFeedback({
        success: res.data.success,
        message: res.data.message || 'Diagnostic message delivered successfully!',
      });
    } catch (err: any) {
      setTestFeedback({
        success: false,
        message: err.response?.data?.message || 'Failed to dispatch test message.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  if (!isOpen || !gateway) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#0b1222] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-[#070c17]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <QrCode size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>WhatsApp Baileys Multi-Device Connection</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Gateway: <strong className="text-slate-200">{gateway.name}</strong> • Partition: {gateway.company_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-3.5 bg-[#070b14] border border-slate-800/80 rounded-2xl">
            <div className="text-xs font-semibold text-slate-400">Connection Status:</div>
            <div>
              {sessionData?.status === 'connected' ? (
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Connected & Active
                </span>
              ) : sessionData?.status === 'qr_ready' ? (
                <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5">
                  <QrCode size={13} />
                  QR Ready to Scan
                </span>
              ) : sessionData?.status === 'connecting' ? (
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

          {/* Rejection / Notice Banner */}
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
                  if (pairingMethod === 'qr') handleStartQR();
                }}
                className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-[11px] font-bold shrink-0 transition-all cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}

          {/* CONNECTED STATE */}
          {sessionData?.status === 'connected' ? (
            <div className="space-y-6">
              <div className="p-5 bg-[#070b14] border border-emerald-500/30 rounded-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 font-semibold">Active Linked WhatsApp Device</div>
                    <div className="text-lg font-mono font-extrabold text-white tracking-wide">
                      +{sessionData.phoneNumber || gateway.credentials?.display_phone_number || 'Linked Account'}
                    </div>
                    <div className="text-xs text-emerald-400 font-medium mt-0.5">
                      Push Name: {sessionData.pushName || gateway.credentials?.push_name || 'Enterprise WhatsApp'}
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
                      <PhoneOff size={13} /> Auto-Reject Calls (Polite Notice)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 gap-2 flex-wrap">
                  <div className="text-[11px] text-slate-400">
                    Persistent session in PostgreSQL & local secure vault
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetSession}
                      disabled={isResetting}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={12} className={isResetting ? 'animate-spin' : ''} />
                      <span>{isResetting ? 'Resetting...' : 'Hard Reset'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      disabled={isDisconnecting}
                      className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Unlink size={13} />
                      <span>{isDisconnecting ? 'Disconnecting...' : 'Unlink & Disconnect'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Diagnostic Test Box */}
              <div className="p-5 bg-[#070b14] border border-slate-800 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Send size={13} className="text-cyan-400" />
                  <span>Send Diagnostic Test WhatsApp Message</span>
                </h4>
                <form onSubmit={handleSendTestMessage} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="Recipient Phone (e.g. 919876543210)"
                      className="px-3 py-2 bg-[#0f172a] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    <input
                      type="text"
                      value={testMsg}
                      onChange={(e) => setTestMsg(e.target.value)}
                      placeholder="Test message content"
                      className="px-3 py-2 bg-[#0f172a] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSendingTest}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send size={13} />
                    <span>{isSendingTest ? 'Delivering...' : 'Send Test via Baileys'}</span>
                  </button>
                </form>
                {testFeedback && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      testFeedback.success
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}
                  >
                    {testFeedback.success ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                    <span>{testFeedback.message}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* CONNECTION FLOW: QR CODE OR PAIRING CODE */
            <div className="space-y-5">
              {/* Method Selector Tabs */}
              <div className="flex items-center p-1 bg-[#070b14] border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPairingMethod('qr')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
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
                  className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    pairingMethod === 'code'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Phone size={14} />
                  <span>Link with Phone Number (No Camera)</span>
                </button>
              </div>

              {/* Mode A: Scan QR Code */}
              {pairingMethod === 'qr' && (
                <div className="flex flex-col items-center justify-center p-6 bg-[#070b14] border border-slate-800 rounded-2xl space-y-5 text-center">
                  {sessionData?.qrCodeDataUrl ? (
                    <div className="space-y-4 w-full max-w-sm">
                      {/* QR Code Container with Countdown & Status */}
                      <div className="relative inline-block p-4 bg-white rounded-2xl shadow-2xl ring-4 ring-cyan-500/40">
                        <img
                          src={sessionData.qrCodeDataUrl}
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
                              onClick={handleStartQR}
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
                          onClick={handleStartQR}
                          disabled={isStarting}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <RefreshCw size={13} className={isStarting ? 'animate-spin' : ''} />
                          <span>{isStarting ? 'Refreshing...' : 'Refresh QR'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelPairing}
                          disabled={isCancelling}
                          className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <XCircle size={13} />
                          <span>{isCancelling ? 'Cancelling...' : 'Cancel Pairing'}</span>
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
                        onClick={handleStartQR}
                        disabled={isStarting}
                        className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-extrabold rounded-xl shadow-lg flex items-center justify-center gap-2 mx-auto transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Play size={14} />
                        <span>{isStarting ? 'Generating QR Code...' : 'Generate WhatsApp QR Code'}</span>
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
                      disabled={isRequestingCode}
                      className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Key size={14} />
                      <span>{isRequestingCode ? 'Requesting Pairing Code...' : 'Request 8-Digit Pairing Code'}</span>
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
                          onClick={copyPairingCode}
                          className="px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          {copiedCode ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                          <span>{copiedCode ? 'Copied to Clipboard!' : 'Copy Code'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelPairing}
                          disabled={isCancelling}
                          className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                          <XCircle size={13} />
                          <span>{isCancelling ? 'Cancelling...' : 'Cancel / Reject'}</span>
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
      </div>
    </div>
  );
};
