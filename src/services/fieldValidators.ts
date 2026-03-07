/**
 * Field validation utilities for personal memory and form fields
 */

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  suggestions?: string[];
}

/**
 * Validate Canadian SIN (Social Insurance Number)
 * Format: 9 digits, optionally with spaces or dashes
 * Uses Luhn algorithm for validation
 */
export function validateSIN(value: string): ValidationResult {
  const cleaned = value.replace(/[\s-]/g, '');
  
  if (!/^\d{9}$/.test(cleaned)) {
    return {
      isValid: false,
      message: 'SIN must be 9 digits',
      suggestions: ['Format: 123-456-789 or 123 456 789'],
    };
  }
  
  // Luhn algorithm
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(cleaned[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }
  
  if (sum % 10 !== 0) {
    return {
      isValid: false,
      message: 'Invalid SIN checksum',
    };
  }
  
  // Check for known invalid SINs (starting with 8)
  if (cleaned[0] === '8') {
    return {
      isValid: false,
      message: 'SINs starting with 8 are not valid',
    };
  }
  
  // Check for test SINs (starting with 9)
  if (cleaned[0] === '9') {
    return {
      isValid: true,
      message: 'This appears to be a test SIN',
    };
  }
  
  return {
    isValid: true,
  };
}

/**
 * Validate Canadian postal code
 * Format: A1A 1A1 (letter-number-letter space number-letter-number)
 */
export function validatePostalCode(value: string): ValidationResult {
  const cleaned = value.toUpperCase().replace(/\s/g, '');
  
  if (!/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(cleaned)) {
    return {
      isValid: false,
      message: 'Invalid Canadian postal code format',
      suggestions: ['Format: A1A 1A1'],
    };
  }
  
  // Check for invalid first letters (D, F, I, O, Q, U)
  const invalidFirstLetters = ['D', 'F', 'I', 'O', 'Q', 'U'];
  if (invalidFirstLetters.includes(cleaned[0])) {
    return {
      isValid: false,
      message: `Postal codes cannot start with ${cleaned[0]}`,
    };
  }
  
  // Check for invalid third letters (W, Z)
  const invalidThirdLetters = ['W', 'Z'];
  if (invalidThirdLetters.includes(cleaned[2])) {
    return {
      isValid: false,
      message: `Postal codes cannot have ${cleaned[2]} as the third character`,
    };
  }
  
  return {
    isValid: true,
  };
}

/**
 * Validate US ZIP code
 * Format: 12345 or 12345-6789
 */
export function validateZIPCode(value: string): ValidationResult {
  const cleaned = value.trim();
  
  if (!/^\d{5}(-\d{4})?$/.test(cleaned)) {
    return {
      isValid: false,
      message: 'Invalid ZIP code format',
      suggestions: ['Format: 12345 or 12345-6789'],
    };
  }
  
  return {
    isValid: true,
  };
}

/**
 * Validate phone number (North American)
 * Accepts various formats: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890, +1 123 456 7890
 */
export function validatePhoneNumber(value: string): ValidationResult {
  const cleaned = value.replace(/[\s().-]/g, '');
  
  // Remove country code if present
  const withoutCountryCode = cleaned.startsWith('1') && cleaned.length === 11 
    ? cleaned.slice(1) 
    : cleaned;
  
  if (!/^\d{10}$/.test(withoutCountryCode)) {
    return {
      isValid: false,
      message: 'Invalid phone number',
      suggestions: ['Format: (123) 456-7890 or 123-456-7890'],
    };
  }
  
  // Check for invalid area codes (cannot start with 0 or 1)
  if (withoutCountryCode[0] === '0' || withoutCountryCode[0] === '1') {
    return {
      isValid: false,
      message: 'Area code cannot start with 0 or 1',
    };
  }
  
  // Check for invalid exchange codes (cannot start with 0 or 1)
  if (withoutCountryCode[3] === '0' || withoutCountryCode[3] === '1') {
    return {
      isValid: false,
      message: 'Exchange code cannot start with 0 or 1',
    };
  }
  
  return {
    isValid: true,
  };
}

/**
 * Validate email address
 */
export function validateEmail(value: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(value)) {
    return {
      isValid: false,
      message: 'Invalid email address format',
    };
  }
  
  // Check for common typos
  const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'];
  const parts = value.split('@');
  if (parts.length === 2) {
    const domain = parts[1].toLowerCase();
    const typoDomain = commonDomains.find(d => {
      const distance = levenshteinDistance(domain, d);
      return distance === 1 && domain.length === d.length;
    });
    
    if (typoDomain) {
      return {
        isValid: true,
        message: `Did you mean ${typoDomain}?`,
      };
    }
  }
  
  return {
    isValid: true,
  };
}

/**
 * Validate date of birth
 * Ensures the date is in the past and reasonable (not too old)
 */
export function validateDateOfBirth(value: string): ValidationResult {
  const date = new Date(value);
  
  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      message: 'Invalid date format',
      suggestions: ['Format: YYYY-MM-DD'],
    };
  }
  
  const now = new Date();
  const age = now.getFullYear() - date.getFullYear();
  
  if (date > now) {
    return {
      isValid: false,
      message: 'Date of birth cannot be in the future',
    };
  }
  
  if (age < 0 || age > 120) {
    return {
      isValid: false,
      message: 'Please enter a valid date of birth',
    };
  }
  
  return {
    isValid: true,
  };
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

/**
 * Get validator for a specific field type
 */
export function getValidator(fieldType: string): ((value: string) => ValidationResult) | null {
  const validators: Record<string, (value: string) => ValidationResult> = {
    sin: validateSIN,
    postalcode: validatePostalCode,
    postalCode: validatePostalCode,
    phone: validatePhoneNumber,
    telephoneNumber: validatePhoneNumber,
    email: validateEmail,
    dateofbirth: validateDateOfBirth,
    dateOfBirth: validateDateOfBirth,
  };
  
  return validators[fieldType] || validators[fieldType.toLowerCase()] || null;
}
