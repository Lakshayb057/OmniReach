import React from 'react';
import {
  Zap,
  Smartphone,
  Mail,
  Clock,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Layers,
  Flame,
  HeartHandshake,
  Baby,
  Globe,
  MessageSquare,
  UserCheck,
  Database,
  ArrowDownRight,
  GitBranch,
} from 'lucide-react';

export interface JourneyNode {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  config: any;
  position?: { x: number; y: number };
}

export interface JourneyEdge {
  id: string;
  from?: string;
  to?: string;
  source?: string;
  target?: string;
  label?: string;
}

interface JourneyVisualCanvasProps {
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  onSelectNode: (node: JourneyNode) => void;
  selectedNodeId?: string;
}

export const JourneyVisualCanvas: React.FC<JourneyVisualCanvasProps> = ({
  nodes,
  edges,
  onSelectNode,
  selectedNodeId,
}) => {
  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'trigger':
        return <Zap size={18} className="text-purple-400" />;
      case 'action_whatsapp':
      case 'message_whatsapp':
        return <Smartphone size={18} className="text-emerald-400" />;
      case 'prompt_input':
      case 'user_input':
        return <MessageSquare size={18} className="text-cyan-400" />;
      case 'action_api':
      case 'api_node':
        return <Globe size={18} className="text-blue-400" />;
      case 'action_handover':
      case 'bot_handover':
        return <UserCheck size={18} className="text-amber-400" />;
      case 'action_update_lead':
        return <Database size={18} className="text-violet-400" />;
      case 'action_email':
        return <Mail size={18} className="text-blue-400" />;
      case 'delay':
        return <Clock size={18} className="text-amber-400" />;
      case 'condition':
        return <GitBranch size={18} className="text-cyan-400" />;
      case 'goal':
        return <CheckCircle2 size={18} className="text-emerald-400" />;
      default:
        return <Layers size={18} className="text-slate-400" />;
    }
  };

  const getNodeBorderColor = (type: string, isSelected: boolean) => {
    if (isSelected) {
      return 'border-cyan-500 ring-2 ring-cyan-500/40 bg-cyan-50/90 dark:bg-[#0c1933] shadow-lg';
    }
    switch (type) {
      case 'trigger':
        return 'border-purple-300 dark:border-purple-500/40 hover:border-purple-500 bg-purple-50/90 dark:bg-[#0f1226]';
      case 'action_whatsapp':
      case 'message_whatsapp':
        return 'border-emerald-300 dark:border-emerald-500/40 hover:border-emerald-500 bg-emerald-50/90 dark:bg-[#0a1c1a]';
      case 'prompt_input':
      case 'user_input':
        return 'border-cyan-300 dark:border-cyan-500/40 hover:border-cyan-500 bg-cyan-50/90 dark:bg-[#061d2b]';
      case 'action_api':
      case 'api_node':
        return 'border-blue-300 dark:border-blue-500/40 hover:border-blue-500 bg-blue-50/90 dark:bg-[#0b1b36]';
      case 'action_handover':
      case 'bot_handover':
        return 'border-amber-300 dark:border-amber-500/40 hover:border-amber-500 bg-amber-50/90 dark:bg-[#211606]';
      case 'action_update_lead':
        return 'border-violet-300 dark:border-violet-500/40 hover:border-violet-500 bg-violet-50/90 dark:bg-[#1a0e2e]';
      case 'action_email':
        return 'border-blue-300 dark:border-blue-500/40 hover:border-blue-500 bg-blue-50/90 dark:bg-[#0c172e]';
      case 'delay':
        return 'border-amber-300 dark:border-amber-500/40 hover:border-amber-500 bg-amber-50/90 dark:bg-[#1f1709]';
      case 'condition':
        return 'border-cyan-300 dark:border-cyan-500/40 hover:border-cyan-500 bg-cyan-50/90 dark:bg-[#081b24]';
      case 'goal':
        return 'border-teal-300 dark:border-teal-500/40 hover:border-teal-500 bg-teal-50/90 dark:bg-[#0a1f18]';
      default:
        return 'border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 bg-white dark:bg-[#0f172a]';
    }
  };

  return (
    <div className="w-full bg-slate-50 dark:bg-[#050811] rounded-3xl border border-slate-200 dark:border-slate-800 p-8 overflow-x-auto min-h-[460px] relative shadow-inner select-none flex flex-col justify-center transition-colors duration-200">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none"></div>

      {/* Nodes Flow Layout */}
      <div className="flex items-center space-x-6 min-w-max py-6 relative z-10">
        {nodes.map((node, index) => {
          const isSelected = selectedNodeId === node.id;
          const outgoingEdges = edges.filter((e) => (e.from === node.id || e.source === node.id));

          return (
            <React.Fragment key={node.id}>
              {/* Node Card */}
              <div
                onClick={() => onSelectNode(node)}
                className={`w-64 p-4 rounded-2xl border cursor-pointer transition-all duration-200 shadow-md dark:shadow-xl relative group ${getNodeBorderColor(
                  node.type,
                  isSelected
                )}`}
              >
                {/* Node Step Badge */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-white/80 dark:bg-[#070b14]/80 border border-slate-200 dark:border-slate-800 shadow-xs">
                      {getNodeIcon(node.type)}
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600 dark:text-slate-400">
                      {node.type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 font-bold">
                    #{index + 1}
                  </span>
                </div>

                <div className="font-bold text-xs text-slate-900 dark:text-white leading-snug mb-1">
                  {node.title}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {node.subtitle}
                </div>

                {/* Node Extra Meta Badges */}
                <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[10px]">
                  {node.type === 'delay' && (
                    <span className="text-amber-700 dark:text-amber-300 font-mono font-semibold">
                      ⏳ {node.config?.value || 1} {node.config?.delay_type || 'HOURS'}
                    </span>
                  )}
                  {(node.type === 'action_whatsapp' || node.type === 'message_whatsapp') && (
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                      📱 WhatsApp Message
                    </span>
                  )}
                  {(node.type === 'prompt_input' || node.type === 'user_input') && (
                    <span className="text-cyan-700 dark:text-cyan-300 font-semibold font-mono text-[9px]">
                      📥 Save &#123;&#123;{node.config?.variable_name || 'input'}&#125;&#125;
                    </span>
                  )}
                  {(node.type === 'action_api' || node.type === 'api_node') && (
                    <span className="text-blue-700 dark:text-blue-400 font-semibold font-mono text-[9px]">
                      🌐 {node.config?.method || 'POST'} API Node
                    </span>
                  )}
                  {(node.type === 'action_handover' || node.type === 'bot_handover') && (
                    <span className="text-amber-700 dark:text-amber-300 font-semibold">
                      👤 Live Chat Handover
                    </span>
                  )}
                  {node.type === 'action_email' && (
                    <span className="text-blue-700 dark:text-blue-400 font-semibold">
                      ✉️ HTML Impact Email
                    </span>
                  )}
                  {node.type === 'condition' && (
                    <span className="text-cyan-700 dark:text-cyan-300 font-semibold">
                      🔀 Decision Branch
                    </span>
                  )}
                  {node.type === 'goal' && (
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                      🎯 Goal Reached
                    </span>
                  )}
                  {node.type === 'trigger' && (
                    <span className="text-purple-700 dark:text-purple-400 font-semibold">
                      ⚡ Dynamic Trigger
                    </span>
                  )}
                  <span className="text-slate-500 font-mono text-[9px]">Inspect</span>
                </div>
              </div>

              {/* Connecting Laser Arrow / Edge */}
              {index < nodes.length - 1 && (
                <div className="flex flex-col items-center justify-center px-1">
                  {outgoingEdges.length > 0 && outgoingEdges[0]?.label && (
                    <span className="text-[9px] font-mono font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded mb-1 whitespace-nowrap">
                      {outgoingEdges[0].label}
                    </span>
                  )}
                  <div className="flex items-center space-x-1">
                    <div className="w-8 h-[2px] bg-gradient-to-r from-slate-700 via-blue-500 to-cyan-400"></div>
                    <ArrowRight size={14} className="text-cyan-400" />
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
