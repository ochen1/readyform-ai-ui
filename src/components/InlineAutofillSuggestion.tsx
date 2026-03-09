import React from 'react';
import { Wand2, Check, X, User, Mail, Phone, MapPin, Building, Calendar, CreditCard, Hash, Globe, Users, Pen } from 'lucide-react';
import type { AutofillMatch, PersonalMemoryFieldType } from '../store/types';

interface InlineAutofillSuggestionProps {
  match: AutofillMatch;
  onAccept: () => void;
  onDismiss: () => void;
}

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  Calendar,
  CreditCard,
  Hash,
  Globe,
  Users,
  Pen,
};

function getIconForType(type: PersonalMemoryFieldType): React.ComponentType<{ size?: number; className?: string }> {
  const iconNames: Record<PersonalMemoryFieldType, string> = {
    firstName: 'User',
    lastName: 'User',
    fullName: 'User',
    email: 'Mail',
    phone: 'Phone',
    telephoneNumber: 'Phone',
    address: 'MapPin',
    addressLine1: 'MapPin',
    addressLine2: 'MapPin',
    city: 'Building',
    province: 'MapPin',
    provinceOrTerritory: 'MapPin',
    postalCode: 'Hash',
    country: 'Globe',
    companyName: 'Building',
    jobTitle: 'Building',
    dateOfBirth: 'Calendar',
    signature: 'Pen',
    sin: 'CreditCard',
    spouseFirstName: 'Users',
    spouseLastName: 'Users',
    spousePhone: 'Phone',
    spousePostalCode: 'Hash',
    custom: 'User',
  };
  return iconMap[iconNames[type]] || User;
}

export function InlineAutofillSuggestion({ match, onAccept, onDismiss }: InlineAutofillSuggestionProps) {
  const Icon = getIconForType(match.memoryEntry.type);
  const personLabel = match.memoryEntry.person ? ` (${match.memoryEntry.person})` : '';

  return (
    <div className="absolute z-20 mt-1 bg-white rounded-lg shadow-lg border border-blue-200 p-2 min-w-[200px] animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-start gap-2">
        <div className="shrink-0 mt-0.5">
          <Icon size={14} className="text-blue-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <Wand2 size={12} className="text-blue-500" />
            <span className="text-xs font-medium text-blue-700">
              From Memory{personLabel}
            </span>
          </div>
          
          <div className="text-sm text-slate-900 truncate mb-2">
            {match.suggestedValue}
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={onAccept}
              className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
              title="Use this value"
            >
              <Check size={12} />
              Use
            </button>
            <button
              onClick={onDismiss}
              className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs rounded transition-colors"
              title="Dismiss suggestion"
            >
              <X size={12} />
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
