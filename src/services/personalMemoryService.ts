import type { PersonalMemory, PersonalMemoryEntry, PersonalMemoryFieldType, AutofillMatch, FormField } from '../store/types';
import { getValidator } from './fieldValidators';

const STORAGE_KEY = 'personal-memory';
const STORAGE_VERSION = 'v1';

const DEFAULT_MEMORY: PersonalMemory = {
  version: STORAGE_VERSION,
  entries: [],
  lastUpdated: Date.now(),
};

const FIELD_TYPE_MATCHERS: Record<PersonalMemoryFieldType, (fieldName: string) => boolean> = {
  firstName: (name) => /^(first\s*name|fname|given\s*name|prénom)$/i.test(name),
  lastName: (name) => /^(last\s*name|lname|surname|family\s*name|nom)$/i.test(name),
  fullName: (name) => /^(full\s*name|name|complete\s*name|nom\s*complet)$/i.test(name),
  email: (name) => /^(email|e-mail|email\s*address|courriel)$/i.test(name),
  phone: (name) => /^(phone|telephone|tel|phone\s*number|cell|mobile)$/i.test(name),
  telephoneNumber: (name) => /^(telephone\s*number|tel\s*number|home\s*phone|work\s*phone|land\s*line)$/i.test(name),
  address: (name) => /^(address|street|street\s*address|adresse)$/i.test(name),
  addressLine1: (name) => /^(address\s*line\s*1|street\s*address|street\s*address\s*1|adresse\s*1)$/i.test(name),
  addressLine2: (name) => /^(address\s*line\s*2|street\s*address\s*2|apt|suite|unit|appartement)$/i.test(name),
  city: (name) => /^(city|ville|town|municipality)$/i.test(name),
  province: (name) => /^(province|state|region|territory)$/i.test(name),
  provinceOrTerritory: (name) => /^(province\s*or\s*territory|province\/territory|prov|territory)$/i.test(name),
  postalCode: (name) => /^(postal\s*code|zip\s*code|zip|postcode|code\s*postal)$/i.test(name),
  country: (name) => /^(country|pays)$/i.test(name),
  companyName: (name) => /^(company|company\s*name|organization|organisation|business\s*name|entreprise)$/i.test(name),
  jobTitle: (name) => /^(job\s*title|title|position|role|occupation)$/i.test(name),
  dateOfBirth: (name) => /^(date\s*of\s*birth|dob|birth\s*date|birthday|date\s*de\s*naissance)$/i.test(name),
  signature: (name) => /^(signature|sign)$/i.test(name),
  sin: (name) => /^(sin|social\s*insurance\s*number|ssn|social\s*security|assurance\s*sociale)$/i.test(name),
  spouseFirstName: (name) => /^(spouse\s*first\s*name|partner\s*first\s*name|wife\s*first\s*name|husband\s*first\s*name)$/i.test(name),
  spouseLastName: (name) => /^(spouse\s*last\s*name|partner\s*last\s*name|wife\s*last\s*name|husband\s*last\s*name|maiden\s*name)$/i.test(name),
  spousePhone: (name) => /^(spouse\s*phone|partner\s*phone|wife\s*phone|husband\s*phone|spouse\s*number|emergency\s*contact\s*phone)$/i.test(name),
  spousePostalCode: (name) => /^(spouse\s*postal\s*code|partner\s*postal\s*code|spouse\s*zip|partner\s*zip)$/i.test(name),
  custom: () => false,
};

export function getPersonalMemory(): PersonalMemory {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_MEMORY;
    }
    
    const memory: PersonalMemory = JSON.parse(stored);
    
    if (memory.version !== STORAGE_VERSION) {
      console.log('[PersonalMemory] Version mismatch, migrating...');
      return migrateMemory(memory);
    }
    
    return memory;
  } catch (error) {
    console.warn('[PersonalMemory] Failed to load:', error);
    return DEFAULT_MEMORY;
  }
}

export function savePersonalMemory(memory: PersonalMemory): void {
  try {
    memory.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
    console.log('[PersonalMemory] Saved', memory.entries.length, 'entries');
  } catch (error) {
    console.warn('[PersonalMemory] Failed to save:', error);
  }
}

export function addMemoryEntry(entry: Omit<PersonalMemoryEntry, 'id' | 'updatedAt'>): PersonalMemoryEntry {
  const memory = getPersonalMemory();
  
  const existingIndex = memory.entries.findIndex(e => e.type === entry.type && e.label === entry.label);
  
  const newEntry: PersonalMemoryEntry = {
    ...entry,
    id: existingIndex >= 0 ? memory.entries[existingIndex].id : `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    updatedAt: Date.now(),
  };
  
  if (existingIndex >= 0) {
    memory.entries[existingIndex] = newEntry;
  } else {
    memory.entries.push(newEntry);
  }
  
  savePersonalMemory(memory);
  return newEntry;
}

export function updateMemoryEntry(id: string, updates: Partial<Pick<PersonalMemoryEntry, 'value' | 'label' | 'matchPatterns' | 'usageCount' | 'lastUsedAt'>>): PersonalMemoryEntry | null {
  const memory = getPersonalMemory();
  const index = memory.entries.findIndex(e => e.id === id);
  
  if (index < 0) {
    console.warn('[PersonalMemory] Entry not found:', id);
    return null;
  }
  
  memory.entries[index] = {
    ...memory.entries[index],
    ...updates,
    updatedAt: Date.now(),
  };
  
  savePersonalMemory(memory);
  return memory.entries[index];
}

export function deleteMemoryEntry(id: string): boolean {
  const memory = getPersonalMemory();
  const index = memory.entries.findIndex(e => e.id === id);
  
  if (index < 0) {
    return false;
  }
  
  memory.entries.splice(index, 1);
  savePersonalMemory(memory);
  return true;
}

export function clearPersonalMemory(): void {
  localStorage.removeItem(STORAGE_KEY);
  console.log('[PersonalMemory] Cleared all entries');
}

export interface MemoryMatchOptions {
  /** Prefer entries with this person type (default: 'self') */
  preferredPerson?: 'self' | 'spouse' | 'child' | 'parent' | 'other';
  /** Prefer entries with this variant label (e.g., 'Home', 'Work') */
  variantLabel?: string;
  /** If true, only return exact type matches */
  strict?: boolean;
}

export function findMatchingMemoryEntry(
  fieldName: string, 
  fieldType?: string,
  options?: MemoryMatchOptions
): PersonalMemoryEntry | null {
  const memory = getPersonalMemory();
  
  const normalizedName = fieldName.toLowerCase().trim();
  const preferredPerson = options?.preferredPerson || 'self';
  const variantLabel = options?.variantLabel;
  const strict = options?.strict ?? false;
  
  const matches: { entry: PersonalMemoryEntry; score: number }[] = [];
  
  for (const entry of memory.entries) {
    let score = 0;
    
    if (entry.type === 'custom' && entry.matchPatterns) {
      for (const pattern of entry.matchPatterns) {
        if (normalizedName === pattern.toLowerCase() || new RegExp(pattern, 'i').test(fieldName)) {
          score = 10;
          break;
        }
      }
    } else if (entry.type !== 'custom') {
      const matcher = FIELD_TYPE_MATCHERS[entry.type];
      if (matcher && matcher(fieldName)) {
        score = 10;
      }
    }
    
    if (score > 0) {
      if (entry.person === preferredPerson) {
        score += 5;
      } else if (entry.person && entry.person !== 'self') {
        score -= 3;
      }
      
      if (variantLabel && entry.variantLabel === variantLabel) {
        score += 4;
      } else if (variantLabel && entry.variantLabel && entry.variantLabel !== variantLabel) {
        score -= 2;
      }
      
      if (entry.usageCount && entry.usageCount > 0) {
        score += Math.min(entry.usageCount * 0.5, 3);
      }
      
      if (entry.lastUsedAt) {
        const daysSinceUse = (Date.now() - entry.lastUsedAt) / (1000 * 60 * 60 * 24);
        if (daysSinceUse < 7) {
          score += 2;
        } else if (daysSinceUse < 30) {
          score += 1;
        } else if (daysSinceUse > 365) {
          score -= 1;
        }
      }
      
      if (strict && fieldType) {
        const typeMatches = fieldType.toLowerCase().includes(entry.type.toLowerCase());
        if (!typeMatches) {
          score = 0;
        }
      }
      
      if (score > 0) {
        matches.push({ entry, score });
      }
    }
  }
  
  if (matches.length === 0 && fieldType && !strict) {
    const typeToMemoryType: Record<string, PersonalMemoryFieldType[]> = {
      email: ['email'],
      phone: ['phone', 'telephoneNumber'],
      postalcode: ['postalCode'],
      address: ['address', 'addressLine1'],
      province: ['province', 'provinceOrTerritory'],
    };
    
    const memoryTypes = typeToMemoryType[fieldType.toLowerCase()];
    if (memoryTypes) {
      for (const mt of memoryTypes) {
        const entry = memory.entries.find(e => e.type === mt && (!e.person || e.person === preferredPerson));
        if (entry) {
          return entry;
        }
      }
      for (const mt of memoryTypes) {
        const entry = memory.entries.find(e => e.type === mt);
        if (entry) {
          return entry;
        }
      }
    }
  }
  
  if (matches.length > 0) {
    matches.sort((a, b) => b.score - a.score);
    return matches[0].entry;
  }
  
  return null;
}

export function detectPersonFromFieldName(fieldName: string): 'self' | 'spouse' | 'child' | 'parent' | 'other' {
  const lower = fieldName.toLowerCase();
  if (lower.includes('spouse') || lower.includes('wife') || lower.includes('husband') || lower.includes('partner')) {
    return 'spouse';
  }
  if (lower.includes('child') || lower.includes('son') || lower.includes('daughter') || lower.includes('kid') || lower.includes('dependent')) {
    return 'child';
  }
  if (lower.includes('parent') || lower.includes('mother') || lower.includes('father') || lower.includes('mom') || lower.includes('dad')) {
    return 'parent';
  }
  if (lower.includes('emergency') || lower.includes('contact')) {
    return 'other';
  }
  return 'self';
}

function detectVariantLabelFromFieldName(fieldName: string): string | undefined {
  const lower = fieldName.toLowerCase();
  if (lower.includes('home') || lower.includes('residence')) {
    return 'Home';
  }
  if (lower.includes('work') || lower.includes('business') || lower.includes('office')) {
    return 'Work';
  }
  if (lower.includes('mobile') || lower.includes('cell') || lower.includes('cellular')) {
    return 'Mobile';
  }
  if (lower.includes('fax')) {
    return 'Fax';
  }
  if (lower.includes('main')) {
    return 'Main';
  }
  if (lower.includes('secondary') || lower.includes('alternate') || lower.includes('other')) {
    return 'Other';
  }
  return undefined;
}

export function getAutofillSuggestions(fields: FormField[]): AutofillMatch[] {
  const suggestions: AutofillMatch[] = [];
  
  for (const field of fields) {
    if (field.readonly || field.ignore || field.value) {
      continue;
    }
    
    const preferredPerson = detectPersonFromFieldName(field.name);
    const match = findMatchingMemoryEntry(field.name, field.type, { preferredPerson });
    
    if (match) {
      const confidence = match.person === preferredPerson ? 0.95 : (match.person ? 0.7 : 0.85);
      
      suggestions.push({
        fieldId: field.id,
        fieldName: field.name,
        currentValue: field.value,
        suggestedValue: match.value,
        memoryEntry: match,
        confidence,
      });
    }
  }
  
  return suggestions;
}

export interface AutofillSuggestion extends AutofillMatch {
  suggestedValue: string;
  memoryEntry: PersonalMemoryEntry;
}

export function applyAutofill(
  fields: FormField[],
  selectedFieldIds: string[],
  onSetField: (fieldId: string, value: string) => void
): number {
  let appliedCount = 0;
  
  for (const field of fields) {
    if (!selectedFieldIds.includes(field.id)) {
      continue;
    }
    
    const preferredPerson = detectPersonFromFieldName(field.name);
    const match = findMatchingMemoryEntry(field.name, field.type, { preferredPerson });
    
    if (match && !field.readonly && !field.ignore) {
      onSetField(field.id, match.value);
      appliedCount++;
    }
  }
  
  return appliedCount;
}

function migrateMemory(oldMemory: PersonalMemory): PersonalMemory {
  return {
    ...DEFAULT_MEMORY,
    entries: oldMemory.entries || [],
    lastUpdated: oldMemory.lastUpdated || Date.now(),
  };
}

export function getMemoryTypeLabel(type: PersonalMemoryFieldType): string {
  const labels: Record<PersonalMemoryFieldType, string> = {
    firstName: 'First Name',
    lastName: 'Last Name',
    fullName: 'Full Name',
    email: 'Email Address',
    phone: 'Phone Number',
    telephoneNumber: 'Telephone Number',
    address: 'Street Address',
    addressLine1: 'Address Line 1',
    addressLine2: 'Address Line 2',
    city: 'City',
    province: 'Province/State',
    provinceOrTerritory: 'Province or Territory',
    postalCode: 'Postal Code',
    country: 'Country',
    companyName: 'Company Name',
    jobTitle: 'Job Title',
    dateOfBirth: 'Date of Birth',
    signature: 'Signature',
    sin: 'Social Insurance Number (SIN)',
    spouseFirstName: "Spouse's First Name",
    spouseLastName: "Spouse's Last Name",
    spousePhone: "Spouse's Phone",
    spousePostalCode: "Spouse's Postal Code",
    custom: 'Custom Field',
  };
  return labels[type];
}

export function getMemoryTypeIcon(type: PersonalMemoryFieldType): string {
  const icons: Record<PersonalMemoryFieldType, string> = {
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
    province: 'Map',
    provinceOrTerritory: 'Map',
    postalCode: 'Hash',
    country: 'Globe',
    companyName: 'Building2',
    jobTitle: 'Briefcase',
    dateOfBirth: 'Calendar',
    signature: 'Pen',
    sin: 'CreditCard',
    spouseFirstName: 'User',
    spouseLastName: 'User',
    spousePhone: 'Phone',
    spousePostalCode: 'Hash',
    custom: 'Settings',
  };
  return icons[type];
}

/**
 * Automatically save a field value to personal memory if it matches a known type
 * This is called when users fill fields manually or via voice
 */
export interface AutoSaveResult {
  entry: PersonalMemoryEntry | null;
  validationWarning?: string;
}

export function autoSaveToMemory(fieldName: string, value: string): AutoSaveResult {
  if (!value || value.trim().length === 0) {
    return { entry: null };
  }
  
  const preferredPerson = detectPersonFromFieldName(fieldName);
  const variantLabel = detectVariantLabelFromFieldName(fieldName);
  const match = findMatchingMemoryEntry(fieldName, undefined, { 
    preferredPerson,
    variantLabel 
  });
  
  let validationWarning: string | undefined;
  
  for (const [type, matcher] of Object.entries(FIELD_TYPE_MATCHERS)) {
    if (matcher(fieldName)) {
      const validator = getValidator(type);
      if (validator) {
        const result = validator(value);
        if (!result.isValid) {
          validationWarning = result.message;
        }
      }
      break;
    }
  }
  
  if (match) {
    if (match.value !== value) {
      updateMemoryEntry(match.id, { 
        value,
        usageCount: (match.usageCount || 0) + 1,
        lastUsedAt: Date.now(),
      });
      console.log(`[PersonalMemory] Auto-updated "${match.label}" to "${value}"`);
      return { entry: match, validationWarning };
    }
    updateMemoryEntry(match.id, {
      usageCount: (match.usageCount || 0) + 1,
      lastUsedAt: Date.now(),
    });
    return { entry: null, validationWarning };
  }
  
  for (const [type, matcher] of Object.entries(FIELD_TYPE_MATCHERS)) {
    if (matcher(fieldName)) {
      const memoryType = type as PersonalMemoryFieldType;
      const entry = addMemoryEntry({
        type: memoryType,
        label: variantLabel ? `${getMemoryTypeLabel(memoryType)} (${variantLabel})` : getMemoryTypeLabel(memoryType),
        value,
        person: preferredPerson,
        variantLabel,
        usageCount: 1,
        lastUsedAt: Date.now(),
      });
      console.log(`[PersonalMemory] Auto-saved new entry: "${entry.label}" = "${value}" (person: ${preferredPerson})`);
      return { entry, validationWarning };
    }
  }
  
  return { entry: null, validationWarning };
}