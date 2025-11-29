import { motion } from "framer-motion";
import { GlassCard } from "../ui/GlassCard";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { Activity, ShieldCheck, Wifi, ArrowRight, FileText } from "lucide-react";

interface DashboardProps {
  onResume: () => void;
}

export const Dashboard = ({ onResume }: DashboardProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-8 h-full overflow-y-auto"
    >
      <header className="mb-12">
        <motion.h1 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-4xl font-bold text-gov-blue mb-2"
        >
          Welcome back, Producer.
        </motion.h1>
        <motion.p 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-slate-500 text-lg"
        >
          Your digital command center is ready.
        </motion.p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* Recent Activity - Grain Receipt */}
        <GlassCard className="col-span-8 p-8 relative overflow-hidden group" hoverEffect>
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FileText className="w-48 h-48 text-gov-blue" />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gov-blue/10 rounded-lg">
                <Activity className="w-6 h-6 text-gov-blue" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700">Active Grain Receipt</h3>
            </div>

            <div className="flex items-end gap-4 mb-8">
              <div className="text-6xl font-bold text-gov-blue">
                <AnimatedNumber value={75} suffix="%" />
              </div>
              <div className="text-slate-500 mb-2 font-medium">Completion Status</div>
            </div>

            <div className="w-full bg-slate-200 rounded-full h-2 mb-8 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "75%" }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full bg-gov-blue rounded-full shadow-[0_0_10px_rgba(0,45,114,0.5)]"
              />
            </div>

            <button 
              onClick={onResume}
              className="group/btn flex items-center gap-3 bg-gov-blue text-white px-8 py-4 rounded-xl font-semibold shadow-lg shadow-gov-blue/30 hover:shadow-gov-blue/50 hover:scale-105 transition-all duration-300"
            >
              <span>Resume Receipt #00001</span>
              <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </div>
        </GlassCard>

        {/* Digital ID Card */}
        <GlassCard className="col-span-4 p-6 relative overflow-hidden" hoverEffect>
          <div className="absolute inset-0 bg-gradient-to-br from-gov-blue/5 to-transparent" />
          
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Digital ID</h3>
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="relative w-32 h-32 mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-gov-blue/30 animate-[spin_10s_linear_infinite]" />
              <div className="absolute inset-2 rounded-full border border-gov-blue/20 animate-[spin_15s_linear_infinite_reverse]" />
              <img 
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces" 
                alt="User" 
                className="w-full h-full rounded-full object-cover p-2"
              />
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center shadow-lg">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
            </div>
            
            <h2 className="text-xl font-bold text-slate-800">Oliver Smith</h2>
            <p className="text-sm text-slate-500">Licensed Producer</p>
            <p className="text-xs text-gov-blue mt-2 font-mono bg-gov-blue/10 px-3 py-1 rounded-full">ID: 8842-9910-22</p>
          </div>
        </GlassCard>

        {/* Service Status */}
        <GlassCard className="col-span-12 p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping absolute inset-0" />
              <div className="w-3 h-3 bg-emerald-500 rounded-full relative z-10" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-700">Government API Services</h3>
              <p className="text-xs text-slate-500">All systems operational</p>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase">Latency</p>
              <p className="font-mono text-emerald-600 font-bold">12ms</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase">Uptime</p>
              <p className="font-mono text-emerald-600 font-bold">99.99%</p>
            </div>
            <Wifi className="w-6 h-6 text-slate-300" />
          </div>
        </GlassCard>
      </div>
    </motion.div>
  );
};