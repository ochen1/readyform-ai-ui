import { cn } from "../../lib/utils";
import { motion, type HTMLMotionProps } from "framer-motion";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export const GlassCard = ({ 
  children, 
  className, 
  hoverEffect = false,
  ...props 
}: GlassCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-glass",
        hoverEffect && "hover:bg-white/20 hover:shadow-glass-hover hover:border-white/30 transition-all duration-300 cursor-pointer",
        className
      )}
      {...props}
    >
      {/* Noise texture overlay for extra realism */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};