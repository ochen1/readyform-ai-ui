import React from 'react';
import type { FormField, FieldType } from '../../store/types';
import { Calendar, DollarSign, Percent, Scale, Hash, MapPin, List, Calculator } from 'lucide-react';

/**
 * Props for all input components
 */
interface InputProps {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Base input styling classes
 */
const baseInputClass = "flex-1 px-5 py-4 rounded-xl border-2 text-xl focus:outline-none transition-all duration-200";

/**
 * Get icon component for field type
 */
export function getFieldTypeIcon(type: FieldType): React.ReactNode {
  const iconProps = { size: 20, className: "text-slate-400" };
  
  switch (type) {
    case 'date':
      return <Calendar {...iconProps} />;
    case 'currency':
      return <DollarSign {...iconProps} />;
    case 'percentage':
      return <Percent {...iconProps} />;
    case 'weight':
    case 'number':
      return <Scale {...iconProps} />;
    case 'reference':
      return <Hash {...iconProps} />;
    case 'address':
      return <MapPin {...iconProps} />;
    case 'selection':
      return <List {...iconProps} />;
    case 'calculated':
      return <Calculator {...iconProps} />;
    default:
      return null;
  }
}

/**
 * Text Input - Default for most text fields
 */
export function TextInput({ field, value, onChange, onFocus, disabled, className }: InputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      disabled={disabled}
      className={`${baseInputClass} ${className}`}
      placeholder={`Enter ${field.name.toLowerCase()}...`}
    />
  );
}

/**
 * Number Input - For numeric values with optional step control
 */
export function NumberInput({ field, value, onChange, onFocus, disabled, className }: InputProps) {
  return (
    <div className="flex-1 relative">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        disabled={disabled}
        className={`${baseInputClass} ${className} pr-12`}
        placeholder="0"
        step="any"
      />
      {field.unit && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
          {field.unit}
        </span>
      )}
    </div>
  );
}

/**
 * Weight Input - For weight measurements with unit display
 */
export function WeightInput({ field, value, onChange, onFocus, disabled, className }: InputProps) {
  const unit = field.unit || 'kg';
  
  return (
    <div className="flex-1 flex gap-2">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        disabled={disabled}
        className={`${baseInputClass} ${className}`}
        placeholder="0"
        step="0.01"
        min="0"
      />
      <div className="flex items-center px-4 bg-amber-50 border-2 border-amber-200 rounded-xl text-amber-700 font-medium">
        {unit}
      </div>
    </div>
  );
}

/**
 * Currency Input - For monetary values with currency symbol
 */
export function CurrencyInput({ field, value, onChange, onFocus, disabled, className }: InputProps) {
  const currency = field.unit || '$';
  
  return (
    <div className="flex-1 relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-600 text-xl font-medium">
        {currency}
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        disabled={disabled}
        className={`${baseInputClass} ${className} pl-10`}
        placeholder="0.00"
        step="0.01"
        min="0"
      />
    </div>
  );
}

/**
 * Percentage Input - For percentage values with % suffix
 */
export function PercentageInput({ field, value, onChange, onFocus, disabled, className }: InputProps) {
  return (
    <div className="flex-1 relative">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        disabled={disabled}
        className={`${baseInputClass} ${className} pr-12`}
        placeholder="0"
        step="0.1"
        min="0"
        max="100"
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-600 text-xl font-medium">
        %
      </span>
    </div>
  );
}

/**
 * Date Input - Native date picker
 */
export function DateInput({ field, value, onChange, onFocus, disabled, className }: InputProps) {
  // Convert various date formats to yyyy-mm-dd for input
  const normalizeDate = (dateStr: string): string => {
    if (!dateStr) return '';
    
    // If already in yyyy-mm-dd format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    
    // If in yyyymmdd format (common in forms)
    if (/^\d{8}$/.test(dateStr)) {
      return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    }
    
    // Try to parse as date
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    
    return dateStr;
  };

  // Format output value based on field format hint
  const formatOutput = (inputValue: string): string => {
    if (!inputValue) return '';
    
    // If field expects yyyymmdd format
    if (field.format?.toLowerCase().includes('yyyymmdd')) {
      return inputValue.replace(/-/g, '');
    }
    
    return inputValue;
  };

  return (
    <input
      type="date"
      value={normalizeDate(value)}
      onChange={(e) => onChange(formatOutput(e.target.value))}
      onFocus={onFocus}
      disabled={disabled}
      className={`${baseInputClass} ${className}`}
    />
  );
}

/**
 * Reference Input - For IDs, codes, ticket numbers
 */
export function ReferenceInput({ field, value, onChange, onFocus, disabled, className }: InputProps) {
  return (
    <div className="flex-1 relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
        <Hash size={20} />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onFocus={onFocus}
        disabled={disabled}
        className={`${baseInputClass} ${className} pl-12 font-mono tracking-wider`}
        placeholder={field.name}
      />
    </div>
  );
}

/**
 * Selection Input - Dropdown for predefined options
 */
export function SelectionInput({ field, value, onChange, onFocus, disabled, className }: InputProps) {
  const options = field.options || [];
  
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      disabled={disabled}
      className={`${baseInputClass} ${className} cursor-pointer`}
    >
      <option value="">Select {field.name}...</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

/**
 * Address Input - Multi-line textarea for addresses
 */
export function AddressInput({ field, value, onChange, onFocus, disabled, className }: InputProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      disabled={disabled}
      rows={3}
      className={`${baseInputClass} ${className} resize-none`}
      placeholder={`Enter ${field.name.toLowerCase()}...`}
    />
  );
}

/**
 * Calculated Input - Read-only display with calculation hint and live updates
 */
export function CalculatedInput({ field, value, className }: InputProps) {
  // Format the display value based on type hints
  const formatValue = (val: string): string => {
    if (!val || val === '') return '—';
    
    const numVal = parseFloat(val);
    if (isNaN(numVal)) return val;
    
    // Format based on unit type
    if (field.unit?.toLowerCase().includes('cad') || field.unit === '$') {
      return `$${numVal.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    
    // Weight or general numbers
    if (Number.isInteger(numVal)) {
      return numVal.toLocaleString();
    }
    
    return numVal.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="flex-1 flex flex-col gap-1">
      <div className="flex gap-2">
        <div className={`${baseInputClass} ${className} cursor-not-allowed bg-gradient-to-r from-blue-50 to-slate-50 border-blue-200 text-blue-900 font-semibold`}>
          {formatValue(value)}
        </div>
        {field.unit && !field.unit.includes('$') && !field.unit.toLowerCase().includes('cad') && (
          <div className="flex items-center px-4 bg-blue-50 border-2 border-blue-200 rounded-xl text-blue-600 font-medium">
            {field.unit}
          </div>
        )}
      </div>
      {field.calculationHint && (
        <div className="text-xs text-slate-500 italic pl-2">
          ƒ {field.calculationHint}
        </div>
      )}
    </div>
  );
}

/**
 * Grade Input - For classifications/grades (could be text or selection)
 */
export function GradeInput({ field, value, onChange, onFocus, disabled, className }: InputProps) {
  // If options are provided, use selection
  if (field.options && field.options.length > 0) {
    return (
      <SelectionInput
        field={field}
        value={value}
        onChange={onChange}
        onFocus={onFocus}
        disabled={disabled}
        className={className}
      />
    );
  }
  
  // Otherwise use text input
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      disabled={disabled}
      className={`${baseInputClass} ${className} font-medium`}
      placeholder={`Enter ${field.name.toLowerCase()}...`}
    />
  );
}

/**
 * Get the appropriate input component for a field type
 */
export function getInputComponent(type: FieldType): React.ComponentType<InputProps> {
  switch (type) {
    case 'number':
      return NumberInput;
    case 'weight':
      return WeightInput;
    case 'currency':
      return CurrencyInput;
    case 'percentage':
      return PercentageInput;
    case 'date':
      return DateInput;
    case 'reference':
      return ReferenceInput;
    case 'selection':
      return SelectionInput;
    case 'address':
      return AddressInput;
    case 'calculated':
      return CalculatedInput;
    case 'grade':
      return GradeInput;
    case 'text':
    default:
      return TextInput;
  }
}

/**
 * Dynamic Input Component - Renders the appropriate input based on field type
 */
export function DynamicInput(props: InputProps) {
  const InputComponent = getInputComponent(props.field.type);
  return <InputComponent {...props} />;
}