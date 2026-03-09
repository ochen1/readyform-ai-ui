import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FormField, FieldType } from '../../store/types';
import { Calendar, DollarSign, Percent, Scale, Hash, MapPin, List, Calculator, ToggleLeft, CheckSquare, Phone, Mail, MapPinned } from 'lucide-react';

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
const baseInputClass = "w-full flex-1 px-5 py-4 rounded-xl border-2 text-xl focus:outline-none transition-all duration-200 placeholder-slate-700";

/**
 * Get icon component for field type
 */
export function getFieldTypeIcon(type: FieldType): React.ReactNode {
  const iconProps = { size: 20, className: "text-slate-700" };

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
    case 'boolean':
      return <ToggleLeft {...iconProps} />;
    case 'checkbox':
      return <CheckSquare {...iconProps} />;
    case 'phone':
      return <Phone {...iconProps} />;
    case 'email':
      return <Mail {...iconProps} />;
    case 'postalcode':
      return <MapPinned {...iconProps} />;
    default:
      return null;
  }
}

/**
 * Text Input - Default for most text fields
 */
export function TextInput({ field, value, onChange, onFocus, disabled, className }: InputProps) {
  const { t } = useTranslation();
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      disabled={disabled}
      className={`${baseInputClass} ${className}`}
      placeholder={t('inputs.enterField', { field: (field.localizedName || field.name).toLowerCase() })}
    />
  );
}

/**
 * Number Input - For numeric values with optional step control
 */
export function NumberInput({ field, value, onChange, onFocus, disabled, className }: InputProps) {
  return (
    <div className="flex-1 flex gap-2">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        disabled={disabled}
        className={`flex-1 px-5 py-4 rounded-xl border-2 text-xl focus:outline-none transition-all duration-200 placeholder-slate-700 ${className}`}
        placeholder="0"
        step="any"
      />
      {field.unit && (
        <div className="flex items-center px-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 font-medium shrink-0">
          {field.unit}
        </div>
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
        className={`flex-1 px-5 py-4 rounded-xl border-2 text-xl focus:outline-none transition-all duration-200 placeholder-slate-700 ${className}`}
        placeholder="0"
        step="0.01"
        min="0"
      />
      <div className="flex items-center px-4 bg-amber-50 border-2 border-amber-200 rounded-xl text-amber-700 font-medium shrink-0">
        {unit}
      </div>
    </div>
  );
}

/**
 * Currency Input - For monetary values with currency symbol
 */
export function CurrencyInput({ field: _field, value, onChange, onFocus, disabled, className }: InputProps) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      disabled={disabled}
      className={`flex-1 px-5 py-4 rounded-xl border-2 text-xl focus:outline-none transition-all duration-200 placeholder-slate-700 ${className}`}
      placeholder="0.00"
      step="0.01"
      min="0"
    />
  );
}

/**
 * Percentage Input - For percentage values with % suffix
 */
export function PercentageInput({ field: _field, value, onChange, onFocus, disabled, className }: InputProps) {
  return (
    <div className="flex-1 flex gap-2">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        disabled={disabled}
        className={`flex-1 px-5 py-4 rounded-xl border-2 text-xl focus:outline-none transition-all duration-200 placeholder-slate-700 ${className}`}
        placeholder="0"
        step="0.1"
        min="0"
        max="100"
      />
      <div className="flex items-center px-4 bg-purple-50 border-2 border-purple-200 rounded-xl text-purple-700 font-medium shrink-0">
        %
      </div>
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
export function ReferenceInput({ field: _field, value, onChange, onFocus, disabled, className }: InputProps) {
  const { t } = useTranslation();
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      onFocus={onFocus}
      disabled={disabled}
      className={`flex-1 px-5 py-4 rounded-xl border-2 text-xl focus:outline-none transition-all duration-200 placeholder-slate-700 font-mono tracking-wider ${className}`}
      placeholder={t('inputs.enterReference')}
    />
  );
}

/**
 * Selection Input - Dropdown for predefined options
 */
export function SelectionInput({ field, value, onChange, onFocus, disabled, className }: InputProps) {
  const { t } = useTranslation();
  const options = field.options || [];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      disabled={disabled}
      className={`${baseInputClass} ${className} cursor-pointer`}
    >
      <option value="">{t('inputs.selectField', { field: field.localizedName || field.name })}</option>
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
  const { t } = useTranslation();
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      disabled={disabled}
      rows={3}
      className={`${baseInputClass} ${className} resize-none`}
      placeholder={t('inputs.enterField', { field: (field.localizedName || field.name).toLowerCase() })}
    />
  );
}

/**
 * Calculated Input - Read-only display with live updates
 */
export function CalculatedInput({ field, value, onFocus: _onFocus, onChange: _onChange, disabled: _disabled, className: _className }: InputProps) {
  // Determine if this is a currency field
  const isCurrency = field.unit?.toLowerCase().includes('cad') || field.unit === '$';

  // Format the display value based on type hints
  const formatValue = (val: string): string => {
    if (!val || val === '') return '—';

    const numVal = parseFloat(val);
    if (isNaN(numVal)) return val;

    // For currency, just format the number (no $ prefix since we show it separately)
    if (isCurrency) {
      return numVal.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Weight or general numbers
    if (Number.isInteger(numVal)) {
      return numVal.toLocaleString();
    }

    return numVal.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="flex-1 flex gap-2">
      <div className={`flex-1 px-5 py-4 rounded-xl border-2 text-xl transition-all duration-200 placeholder-slate-700 cursor-not-allowed bg-gradient-to-r from-blue-50 to-slate-50 border-blue-200 text-blue-900 font-semibold`}>
        {formatValue(value)}
      </div>
      {field.unit && !isCurrency && (
        <div className="flex items-center px-4 bg-blue-50 border-2 border-blue-200 rounded-xl text-blue-600 font-medium shrink-0">
          {field.unit}
        </div>
      )}
    </div>
  );
}

/**
 * Grade Input - For classifications/grades (could be text or selection)
 */
export function GradeInput({ field, value, onChange, onFocus, disabled, className }: InputProps) {
  const { t } = useTranslation();
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
      placeholder={t('inputs.enterField', { field: (field.localizedName || field.name).toLowerCase() })}
    />
  );
}

/**
 * Boolean Input - Toggle switch for Yes/No questions
 */
export function BooleanInput({ field, value, onChange, onFocus, disabled, className: _className }: InputProps) {
  const { t } = useTranslation();
  const isYes = value.toLowerCase() === 'yes' || value === 'true' || value === '1';

  return (
    <div className="flex-1 flex items-center gap-4">
      <button
        type="button"
        onClick={() => {
          onFocus();
          onChange(isYes ? 'No' : 'Yes');
        }}
        disabled={disabled}
        className={`relative w-16 h-9 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isYes ? 'bg-emerald-500' : 'bg-slate-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        aria-label={`${field.localizedName || field.name}: ${isYes ? t('inputs.yes') : t('inputs.no')}`}
      >
        <span
          className={`absolute top-1 left-0 w-7 h-7 rounded-full bg-white shadow-md transition-transform duration-200 ${isYes ? 'translate-x-8' : 'translate-x-1'
            }`}
        />
      </button>
      <span className={`text-xl font-medium ${isYes ? 'text-emerald-600' : 'text-slate-800'}`}>
        {isYes ? t('inputs.yes') : t('inputs.no')}
      </span>
    </div>
  );
}

/**
 * Checkbox Input - Single checkbox for consent/agreement
 */
export function CheckboxInput({ field, value, onChange, onFocus, disabled, className: _className }: InputProps) {
  const isChecked = value.toLowerCase() === 'yes' || value === 'true' || value === '1' || value === 'checked';

  return (
    <div className="flex-1 flex items-center gap-4">
      <button
        type="button"
        onClick={() => {
          onFocus();
          onChange(isChecked ? '' : 'checked');
        }}
        disabled={disabled}
        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all duration-200 placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isChecked
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-white border-slate-300 hover:border-blue-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        aria-label={field.localizedName || field.name}
        aria-checked={isChecked}
        role="checkbox"
      >
        {isChecked && (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <span className={`text-lg ${isChecked ? 'text-slate-900' : 'text-slate-800'}`}>
        {field.description || field.localizedName || field.name}
      </span>
    </div>
  );
}

/**
 * Phone Input - Formatted phone number input
 */
export function PhoneInput({ field, value, onChange, onFocus, disabled, className }: InputProps) {
  // Format phone number as user types (North American format)
  const formatPhone = (input: string): string => {
    // Remove all non-digits
    const digits = input.replace(/\D/g, '');

    // Limit to 10 digits (North American)
    const limited = digits.slice(0, 10);

    // Format based on length
    if (limited.length <= 3) {
      return limited;
    } else if (limited.length <= 6) {
      return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
    } else {
      return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    onChange(formatted);
  };

  return (
    <div className="flex-1 flex gap-2">
      <input
        type="tel"
        value={value}
        onChange={handleChange}
        onFocus={onFocus}
        disabled={disabled}
        className={`flex-1 px-5 py-4 rounded-xl border-2 text-xl focus:outline-none transition-all duration-200 placeholder-slate-700 ${className}`}
        placeholder={field.format || "(999) 999-9999"}
      />
    </div>
  );
}

/**
 * Email Input - Email address with validation styling
 */
export function EmailInput({ field, value, onChange, onFocus, disabled, className }: InputProps) {
  const { t } = useTranslation();
  // Basic email validation
  const isValidEmail = (email: string): boolean => {
    if (!email) return true; // Empty is valid (not required)
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const valid = isValidEmail(value);

  return (
    <input
      type="email"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      disabled={disabled}
      className={`flex-1 px-5 py-4 rounded-xl border-2 text-xl focus:outline-none transition-all duration-200 placeholder-slate-700 ${!valid ? 'border-red-300 bg-red-50' : ''
        } ${className}`}
      placeholder={t('inputs.enterField', { field: (field.localizedName || field.name).toLowerCase() })}
    />
  );
}

/**
 * Postal Code Input - Canadian postal code format (A1A 1A1)
 */
export function PostalCodeInput({ field, value, onChange, onFocus, disabled, className }: InputProps) {
  // Format Canadian postal code as user types
  const formatPostalCode = (input: string): string => {
    // Remove all non-alphanumeric and convert to uppercase
    const cleaned = input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // Limit to 6 characters
    const limited = cleaned.slice(0, 6);

    // Add space after first 3 characters
    if (limited.length > 3) {
      return `${limited.slice(0, 3)} ${limited.slice(3)}`;
    }
    return limited;
  };

  // Validate Canadian postal code format
  const isValidPostalCode = (code: string): boolean => {
    if (!code) return true; // Empty is valid
    // Canadian postal code: letter-digit-letter space digit-letter-digit
    return /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/.test(code.toUpperCase());
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPostalCode(e.target.value);
    onChange(formatted);
  };

  const valid = isValidPostalCode(value);

  return (
    <div className="flex-1 flex gap-2">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={onFocus}
        disabled={disabled}
        className={`flex-1 px-5 py-4 rounded-xl border-2 text-xl focus:outline-none transition-all duration-200 placeholder-slate-700 font-mono tracking-wider ${value && !valid ? 'border-amber-300' : ''
          } ${className}`}
        placeholder={field.format || "A1A 1A1"}
        maxLength={7}
      />
    </div>
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
    case 'boolean':
      return BooleanInput;
    case 'checkbox':
      return CheckboxInput;
    case 'phone':
      return PhoneInput;
    case 'email':
      return EmailInput;
    case 'postalcode':
      return PostalCodeInput;
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