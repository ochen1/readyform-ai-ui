import { useState } from 'react';
import { User, Mail, Phone, MapPin, Building, Calendar, Pen, Hash, Globe, Plus, Trash2, Edit2, Check, X, Wand2, CreditCard, Users } from 'lucide-react';
import type { PersonalMemoryEntry, PersonalMemoryFieldType } from '../store/types';
import {
  getPersonalMemory,
  addMemoryEntry,
  updateMemoryEntry,
  deleteMemoryEntry,
  clearPersonalMemory,
  getMemoryTypeLabel,
} from '../services/personalMemoryService';

const MEMORY_FIELD_TYPES: PersonalMemoryFieldType[] = [
  'fullName',
  'firstName',
  'lastName',
  'email',
  'phone',
  'telephoneNumber',
  'address',
  'addressLine1',
  'addressLine2',
  'city',
  'province',
  'provinceOrTerritory',
  'postalCode',
  'country',
  'companyName',
  'jobTitle',
  'dateOfBirth',
  'sin',
  'spouseFirstName',
  'spouseLastName',
  'spousePhone',
  'spousePostalCode',
];

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  Calendar,
  Pen,
  Hash,
  Globe,
  CreditCard,
  Users,
};

function getIconForType(type: PersonalMemoryFieldType): React.ReactNode {
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
  const Icon = iconMap[iconNames[type]] || User;
  return <Icon size={18} className="text-slate-500" />;
}

interface PersonalMemorySettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PersonalMemorySettings({ isOpen, onClose }: PersonalMemorySettingsProps) {
  const [entries, setEntries] = useState<PersonalMemoryEntry[]>(() => {
    const memory = getPersonalMemory();
    return memory.entries;
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newEntryType, setNewEntryType] = useState<PersonalMemoryFieldType>('fullName');
  const [newEntryValue, setNewEntryValue] = useState('');
  const [newEntryPerson, setNewEntryPerson] = useState<'self' | 'spouse' | 'child' | 'parent' | 'other'>('self');
  const [newEntryVariantLabel, setNewEntryVariantLabel] = useState('');

  const refreshEntries = () => {
    const memory = getPersonalMemory();
    setEntries(memory.entries);
  };

  const handleAdd = () => {
    if (!newEntryValue.trim()) return;
    
    addMemoryEntry({
      type: newEntryType,
      label: newEntryVariantLabel ? `${getMemoryTypeLabel(newEntryType)} (${newEntryVariantLabel})` : getMemoryTypeLabel(newEntryType),
      value: newEntryValue.trim(),
      person: newEntryPerson,
      variantLabel: newEntryVariantLabel || undefined,
    });
    
    setNewEntryValue('');
    setNewEntryVariantLabel('');
    setIsAdding(false);
    refreshEntries();
  };

  const handleEdit = (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (entry) {
      setEditingId(id);
      setEditValue(entry.value);
    }
  };

  const handleSaveEdit = () => {
    if (editingId && editValue.trim()) {
      updateMemoryEntry(editingId, { value: editValue.trim() });
      setEditingId(null);
      setEditValue('');
      refreshEntries();
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this entry?')) {
      deleteMemoryEntry(id);
      refreshEntries();
    }
  };

  const handleClearAll = () => {
    if (confirm('Clear all personal memory entries? This cannot be undone.')) {
      clearPersonalMemory();
      setEntries([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-xl">
                <Wand2 size={24} className="text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-black">Personal Memory</h2>
                <p className="text-sm text-slate-600">
                  Store your info for quick autofill
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {entries.length === 0 && !isAdding ? (
            <div className="text-center py-8">
              <User size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-600 mb-2">No personal information stored</p>
              <p className="text-sm text-slate-500 mb-4">
                Add your details to enable autofill suggestions
              </p>
              <button
                onClick={() => setIsAdding(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors flex items-center gap-2 mx-auto"
              >
                <Plus size={18} />
                Add First Entry
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200"
                  >
                    <div className="shrink-0">{getIconForType(entry.type)}</div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-slate-600">{entry.label}</div>
                        {entry.person && entry.person !== 'self' && (
                          <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded capitalize">
                            {entry.person}
                          </span>
                        )}
                        {entry.variantLabel && (
                          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                            {entry.variantLabel}
                          </span>
                        )}
                      </div>
                      {editingId === entry.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 px-2 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
                          <button
                            onClick={handleSaveEdit}
                            className="p-1 text-emerald-600 hover:bg-emerald-100 rounded"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 text-slate-500 hover:bg-slate-200 rounded"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-900 truncate">{entry.value}</div>
                      )}
                      {(entry.usageCount || 0) > 1 && (
                        <div className="text-xs text-slate-400 mt-0.5">
                          Used {entry.usageCount} times
                        </div>
                      )}
                    </div>

                    {editingId !== entry.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleEdit(entry.id)}
                          className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {isAdding ? (
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Field Type</label>
                    <select
                      value={newEntryType}
                      onChange={(e) => setNewEntryType(e.target.value as PersonalMemoryFieldType)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {MEMORY_FIELD_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {getMemoryTypeLabel(type)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Value</label>
                    <input
                      type="text"
                      value={newEntryValue}
                      onChange={(e) => setNewEntryValue(e.target.value)}
                      placeholder={`Enter ${getMemoryTypeLabel(newEntryType).toLowerCase()}`}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAdd();
                        if (e.key === 'Escape') setIsAdding(false);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Person</label>
                    <select
                      value={newEntryPerson}
                      onChange={(e) => setNewEntryPerson(e.target.value as 'self' | 'spouse' | 'child' | 'parent' | 'other')}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="self">Myself (default)</option>
                      <option value="spouse">Spouse/Partner</option>
                      <option value="child">Child</option>
                      <option value="parent">Parent</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Label (optional)</label>
                    <input
                      type="text"
                      value={newEntryVariantLabel}
                      onChange={(e) => setNewEntryVariantLabel(e.target.value)}
                      placeholder="e.g., Home, Work, Mobile"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAdd();
                        if (e.key === 'Escape') setIsAdding(false);
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAdd}
                      disabled={!newEntryValue.trim()}
                      className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                        newEntryValue.trim()
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      Add Entry
                    </button>
                    <button
                      onClick={() => {
                        setIsAdding(false);
                        setNewEntryValue('');
                        setNewEntryVariantLabel('');
                        setNewEntryPerson('self');
                      }}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsAdding(true)}
                  className="w-full py-2 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Add Entry
                </button>
              )}
            </>
          )}
        </div>

        {entries.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
            <button
              onClick={handleClearAll}
              className="w-full py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
            >
              Clear All Memory
            </button>
          </div>
        )}
      </div>
    </div>
  );
}