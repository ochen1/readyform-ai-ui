import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "../ui/GlassCard";
import { SuperInput } from "../ui/SuperInput";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { 
  Truck, 
  Scale, 
  Wheat, 
  DollarSign, 
  Info, 
  CheckCircle2, 
  Wand2,
  Calendar,
  User,
  FileText
} from "lucide-react";
import { useFormContext } from "../../store/FormContext";
import { cn } from "../../lib/utils";

export const GrainReceiptForm = () => {
  const { state, dispatch, getCalculatedValues } = useFormContext();
  const { netWeight, totalValue } = getCalculatedValues();

  // Section refs for voice navigation
  const sectionRefs = {
    logistics: useRef<HTMLElement>(null),
    weights: useRef<HTMLElement>(null),
    grading: useRef<HTMLElement>(null),
    financials: useRef<HTMLElement>(null)
  };

  // Listen for navigation events from voice tools
  useEffect(() => {
    const handleNavigate = (e: CustomEvent<{ section: string }>) => {
      const ref = sectionRefs[e.detail.section as keyof typeof sectionRefs];
      ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    
    window.addEventListener('form:navigate', handleNavigate as EventListener);
    return () => window.removeEventListener('form:navigate', handleNavigate as EventListener);
  }, []);

  // Helper functions for field highlighting
  const isFieldActive = (fieldName: string) => state.activeField === fieldName;
  const wasFieldUpdated = (fieldName: string) => 
    state.lastUpdatedField === fieldName && 
    Date.now() - state.lastUpdateTimestamp < 2000;

  // Determine current insight based on active field
  const insights = {
    default: {
      title: "Regulatory Insight",
      content: "Select a field to view specific regulatory requirements and data usage policies.",
      icon: Info
    },
    producer: {
      title: "Producer Identification",
      content: "Verified against the National Producer Database. This ensures eligibility for the Cash Advance Payments Program.",
      icon: User
    },
    date: {
      title: "Delivery Date",
      content: "The delivery date affects pricing calculations and must match the scale ticket timestamp.",
      icon: Calendar
    },
    weights: {
      title: "Weight Verification",
      content: "Gross and Tare weights must be captured from a certified scale. Discrepancies >1% trigger an automatic audit.",
      icon: Scale
    },
    grossWeight: {
      title: "Gross Weight",
      content: "Total weight of vehicle plus grain, measured on arrival at the elevator.",
      icon: Scale
    },
    vehicleWeight: {
      title: "Vehicle Tare Weight",
      content: "Weight of empty vehicle, either from registered tare or measured after unloading.",
      icon: Scale
    },
    grainType: {
      title: "Grain Classification",
      content: "Grain type per Canadian Grain Commission standards. CWRS = Canada Western Red Spring.",
      icon: Wheat
    },
    dockage: {
      title: "Dockage Assessment",
      content: "Dockage is assessed according to the Official Grain Grading Guide. This deduction directly impacts the net weight for payment.",
      icon: Wheat
    },
    pricePerTonne: {
      title: "Price per Tonne",
      content: "Current market price for this grain type and grade at time of delivery.",
      icon: DollarSign
    },
    financials: {
      title: "Payment Calculation",
      content: "Final payment is calculated based on Net Weight minus Dockage, multiplied by the daily spot price. Levies are automatically deducted.",
      icon: DollarSign
    }
  };

  const getInsightKey = () => {
    if (!state.activeField) return 'default';
    if (state.activeField in insights) {
      return state.activeField as keyof typeof insights;
    }
    return 'default';
  };

  const currentInsight = insights[getInsightKey()];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-full gap-6 p-8 overflow-hidden"
    >
      {/* Main Form Area */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-8 pb-20">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gov-blue">Grain Receipt #00001</h1>
            <p className="text-slate-500">Primary Elevator Receipt • Form 6</p>
          </div>
          <div className="px-4 py-2 bg-emerald-500/10 text-emerald-600 rounded-full text-sm font-medium border border-emerald-500/20 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Auto-Save Active
          </div>
        </header>

        {/* Section 1: Logistics */}
        <section ref={sectionRefs.logistics} className="space-y-6">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Truck className="w-4 h-4" /> Logistics & Identification
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <SuperInput 
              label="Producer Name"
              value={state.data.producer}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'producer', value: e.target.value })}
              badgeIcon={CheckCircle2}
              badgeText="Verified"
              onFocus={() => dispatch({ type: 'SET_ACTIVE_FIELD', field: 'producer' })}
              onBlur={() => dispatch({ type: 'SET_ACTIVE_FIELD', field: null })}
              isHighlighted={isFieldActive('producer')}
              className={cn(wasFieldUpdated('producer') && 'animate-pulse bg-emerald-50')}
            />
            <SuperInput 
              label="Licensee"
              value={state.data.licensee}
              readOnly
              className="bg-slate-100/50 text-slate-500"
            />
            <SuperInput 
              label="Delivery Date"
              type="date"
              value={state.data.date}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'date', value: e.target.value })}
              badgeIcon={Calendar}
              onFocus={() => dispatch({ type: 'SET_ACTIVE_FIELD', field: 'date' })}
              onBlur={() => dispatch({ type: 'SET_ACTIVE_FIELD', field: null })}
              isHighlighted={isFieldActive('date')}
              className={cn(wasFieldUpdated('date') && 'animate-pulse bg-emerald-50')}
            />
            <SuperInput 
              label="Receipt Number"
              value={state.data.receiptNumber}
              readOnly
              className="font-mono text-slate-500"
            />
          </div>
        </section>

        {/* Section 2: The Scale */}
        <section ref={sectionRefs.weights} className="space-y-6">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Scale className="w-4 h-4" /> Weight Data (kg)
          </h2>
          <GlassCard 
            className={cn(
              "p-8 grid grid-cols-3 gap-8",
              (isFieldActive('grossWeight') || isFieldActive('vehicleWeight')) && 'ring-4 ring-gov-blue/30'
            )}
          >
            <div 
              className={cn(
                "space-y-2 p-2 rounded-lg transition-all",
                isFieldActive('grossWeight') && 'bg-gov-blue/10 ring-2 ring-gov-blue/50',
                wasFieldUpdated('grossWeight') && 'animate-pulse bg-emerald-50'
              )}
            >
              <label className="text-xs font-medium text-slate-500 uppercase">Gross Weight</label>
              <div className="text-4xl font-bold text-slate-800">
                <AnimatedNumber value={state.data.grossWeight} />
              </div>
            </div>
            <div 
              className={cn(
                "space-y-2 p-2 rounded-lg transition-all",
                isFieldActive('vehicleWeight') && 'bg-gov-blue/10 ring-2 ring-gov-blue/50',
                wasFieldUpdated('vehicleWeight') && 'animate-pulse bg-emerald-50'
              )}
            >
              <label className="text-xs font-medium text-slate-500 uppercase">Vehicle Tare</label>
              <div className="text-4xl font-bold text-slate-800">
                <AnimatedNumber value={state.data.vehicleWeight} />
              </div>
            </div>
            <div className="space-y-2 relative">
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-[1px] h-12 bg-slate-300" />
              <label className="text-xs font-bold text-gov-blue uppercase">Net Weight</label>
              <div className="text-5xl font-bold text-gov-blue">
                <AnimatedNumber value={netWeight} />
              </div>
            </div>
          </GlassCard>
        </section>

        {/* Section 3: Grading & Dockage */}
        <section ref={sectionRefs.grading} className="space-y-6">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Wheat className="w-4 h-4" /> Grading & Dockage
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <SuperInput 
              label="Grain Type"
              value={state.data.grainType}
              onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'grainType', value: e.target.value })}
              badgeIcon={Wand2}
              badgeText="AI Detected"
              onFocus={() => dispatch({ type: 'SET_ACTIVE_FIELD', field: 'grainType' })}
              onBlur={() => dispatch({ type: 'SET_ACTIVE_FIELD', field: null })}
              isHighlighted={isFieldActive('grainType')}
              className={cn(wasFieldUpdated('grainType') && 'animate-pulse bg-emerald-50')}
            />
            
            {/* Visual Dockage Slider */}
            <GlassCard 
              className={cn(
                "p-4 flex flex-col justify-center",
                isFieldActive('dockage') && 'ring-4 ring-gov-blue/50',
                wasFieldUpdated('dockage') && 'animate-pulse bg-emerald-50'
              )} 
              hoverEffect
            >
              <div className="flex justify-between mb-4">
                <label className="text-sm font-medium text-slate-500 uppercase">Dockage Assessment</label>
                <span className="text-2xl font-bold text-gov-blue">{state.data.dockage}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="10" 
                step="0.1"
                value={state.data.dockage}
                onChange={(e) => {
                  dispatch({ type: 'SET_FIELD', field: 'dockage', value: parseFloat(e.target.value) });
                }}
                onFocus={() => dispatch({ type: 'SET_ACTIVE_FIELD', field: 'dockage' })}
                onBlur={() => dispatch({ type: 'SET_ACTIVE_FIELD', field: null })}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-gov-blue"
              />
              <div className="flex justify-between mt-2 text-xs text-slate-400">
                <span>Clean (0%)</span>
                <span>High (10%)</span>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Section 4: Financials */}
        <section ref={sectionRefs.financials} className="space-y-6">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Financials
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <SuperInput 
              label="Price per Tonne"
              value={`$${state.data.pricePerTonne.toFixed(2)}`}
              onChange={(e) => {
                const value = parseFloat(e.target.value.replace('$', '')) || 0;
                dispatch({ type: 'SET_FIELD', field: 'pricePerTonne', value });
              }}
              badgeIcon={DollarSign}
              onFocus={() => dispatch({ type: 'SET_ACTIVE_FIELD', field: 'pricePerTonne' })}
              onBlur={() => dispatch({ type: 'SET_ACTIVE_FIELD', field: null })}
              isHighlighted={isFieldActive('pricePerTonne')}
              className={cn(wasFieldUpdated('pricePerTonne') && 'animate-pulse bg-emerald-50')}
            />
            <GlassCard className="p-6 bg-gov-blue/5 border-gov-blue/20 flex flex-col justify-center">
              <label className="text-xs font-bold text-gov-blue uppercase mb-1">Total Net Payable</label>
              <div className="text-4xl font-bold text-gov-blue">
                <AnimatedNumber value={totalValue} prefix="$" decimals={2} />
              </div>
              <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <div className="w-4 h-3 bg-slate-200 rounded-sm" /> 
                <span>CAD to USD: ${(totalValue * 0.73).toFixed(2)}</span>
              </div>
            </GlassCard>
          </div>
        </section>
      </div>

      {/* Regulatory Insight Panel (RAG Simulation) */}
      <motion.aside 
        className="w-80 shrink-0"
        initial={{ x: 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="sticky top-8 space-y-4">
          <div className="p-4 rounded-xl bg-gov-blue/5 border border-gov-blue/10">
            <h3 className="text-xs font-bold text-gov-blue uppercase tracking-wider mb-1">Regulatory Assistant</h3>
            <p className="text-xs text-slate-500">Context-aware guidance active.</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentInsight.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <GlassCard className="p-6 border-l-4 border-l-gov-blue">
                <div className="w-10 h-10 rounded-full bg-gov-blue/10 flex items-center justify-center mb-4">
                  <currentInsight.icon className="w-5 h-5 text-gov-blue" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{currentInsight.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {currentInsight.content}
                </p>
              </GlassCard>
            </motion.div>
          </AnimatePresence>

          {/* Simulated RAG Sources */}
          <div className="mt-8">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Referenced Acts</h4>
            <ul className="space-y-2">
              <li className="text-xs text-slate-500 flex items-center gap-2 p-2 rounded-lg hover:bg-white/50 transition-colors cursor-pointer">
                <FileText className="w-3 h-3" /> Canada Grain Act (R.S.C., 1985)
              </li>
              <li className="text-xs text-slate-500 flex items-center gap-2 p-2 rounded-lg hover:bg-white/50 transition-colors cursor-pointer">
                <FileText className="w-3 h-3" /> Canada Grain Regulations
              </li>
            </ul>
          </div>
        </div>
      </motion.aside>
    </motion.div>
  );
};