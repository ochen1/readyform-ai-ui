import { motion } from "framer-motion";
import { LayoutDashboard, FileText, User, Settings, Eye, Type, Volume2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { useUltravox } from "../../ultravox/UltravoxProvider";

interface SidebarProps {
  currentView: 'dashboard' | 'form' | 'settings';
  onViewChange: (view: 'dashboard' | 'form' | 'settings') => void;
}

export const Sidebar = ({ currentView, onViewChange }: SidebarProps) => {
  const { status, isConnected } = useUltravox();
  
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'form', icon: FileText, label: 'My Documents' },
    { id: 'profile', icon: User, label: 'Profile' },
  ];

  const getStatusText = () => {
    if (!isConnected) return 'Click to start';
    switch (status) {
      case 'connecting': return 'Connecting...';
      case 'listening': return 'Listening...';
      case 'speaking': return 'Speaking...';
      case 'thinking': return 'Thinking...';
      case 'idle': return 'Ready';
      default: return 'Ready';
    }
  };

  return (
    <motion.aside 
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed left-0 top-0 h-screen w-80 bg-white/40 backdrop-blur-2xl border-r border-white/20 flex flex-col z-50 shadow-2xl"
    >
      {/* AI Agent Orb */}
      <div className="p-8 flex flex-col items-center border-b border-white/10">
        <div className="relative w-24 h-24 mb-4 flex items-center justify-center">
          {isConnected && (
            <>
              <div className="absolute inset-0 rounded-full bg-gov-blue/20 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-gov-blue/30 animate-pulse" />
            </>
          )}
          {!isConnected && (
            <>
              <div className="absolute inset-0 rounded-full bg-slate-400/20" />
              <div className="absolute inset-2 rounded-full bg-slate-400/30" />
            </>
          )}
          <div className={cn(
            "relative w-16 h-16 rounded-full shadow-glow flex items-center justify-center",
            isConnected 
              ? "bg-gradient-to-br from-gov-blue to-indigo-600" 
              : "bg-gradient-to-br from-slate-400 to-slate-500"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-white animate-bounce" : "bg-white/50"
            )} />
          </div>
        </div>
        <h2 className="text-sm font-semibold text-gov-blue tracking-widest uppercase">
          {isConnected ? 'FormAI Active' : 'FormAI Ready'}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {getStatusText()}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-6 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => item.id !== 'profile' && onViewChange(item.id as 'dashboard' | 'form' | 'settings')}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group",
              currentView === item.id 
                ? "bg-gov-blue text-white shadow-lg shadow-gov-blue/30" 
                : "text-slate-600 hover:bg-white/50"
            )}
          >
            <item.icon className={cn("w-5 h-5", currentView === item.id ? "text-white" : "text-slate-400 group-hover:text-gov-blue")} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Accessibility HUD */}
      <div className="p-6 bg-white/30 backdrop-blur-md border-t border-white/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Accessibility HUD</h3>
          <div className={cn(
            "w-2 h-2 rounded-full",
            isConnected 
              ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
              : "bg-slate-400"
          )} />
        </div>
        
        <div className="space-y-4">
          {/* Font Size Slider Simulation */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <Type className="w-3 h-3" />
              <span>100%</span>
            </div>
            <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-gov-blue rounded-full" />
            </div>
          </div>

          {/* Contrast Slider Simulation */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <Eye className="w-3 h-3" />
              <span>Normal</span>
            </div>
            <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full w-1/2 bg-gov-blue rounded-full" />
            </div>
          </div>

          {/* Voice Speed Slider Simulation */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <Volume2 className="w-3 h-3" />
              <span>1.0x</span>
            </div>
            <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-gov-blue rounded-full" />
            </div>
          </div>
        </div>

        <button 
          onClick={() => onViewChange('settings')}
          className="mt-6 w-full py-2 flex items-center justify-center gap-2 text-xs font-medium text-gov-blue bg-white/50 rounded-lg hover:bg-white/80 transition-colors"
        >
          <Settings className="w-3 h-3" />
          Advanced Settings
        </button>
      </div>
    </motion.aside>
  );
};