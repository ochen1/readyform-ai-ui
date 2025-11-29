import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { type LucideIcon } from "lucide-react";

interface SuperInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  badgeIcon?: LucideIcon;
  badgeText?: string;
  containerClassName?: string;
  isHighlighted?: boolean;
}

export const SuperInput = ({
  label,
  badgeIcon: Icon,
  badgeText,
  className,
  containerClassName,
  isHighlighted,
  onFocus,
  onBlur,
  ...props
}: SuperInputProps) => {
  return (
    <motion.div 
      className={cn("group relative", containerClassName)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <label className="mb-2 block text-sm font-medium text-slate-500 uppercase tracking-wider">
        {label}
      </label>
      
      <div className="relative">
        <input
          className={cn(
            "peer block w-full rounded-xl border-0 bg-white/50 px-6 py-4 text-2xl font-semibold text-slate-800 shadow-sm ring-1 ring-inset ring-slate-200/50 placeholder:text-slate-300 focus:ring-2 focus:ring-inset focus:ring-gov-blue sm:text-2xl sm:leading-6 h-20 transition-all duration-300",
            "focus:shadow-glow focus:bg-white/80",
            isHighlighted && "ring-4 ring-gov-blue/50 ring-offset-2 shadow-glow bg-white/80",
            className
          )}
          onFocus={onFocus}
          onBlur={onBlur}
          {...props}
        />
        
        {/* Smart Badge */}
        {(Icon || badgeText) && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 rounded-full bg-white/60 px-3 py-1.5 text-xs font-medium text-gov-blue backdrop-blur-md shadow-sm border border-white/40 transition-opacity opacity-70 group-hover:opacity-100 peer-focus:opacity-100">
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {badgeText && <span>{badgeText}</span>}
          </div>
        )}

        {/* Focus Indicator Line */}
        <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-gov-blue scale-x-0 transition-transform duration-500 peer-focus:scale-x-100" />
      </div>
    </motion.div>
  );
};