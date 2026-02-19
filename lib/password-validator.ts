// ============================================
// Galeria - Password Validation
// ============================================
// Password strength validation and security checks
// Includes common password detection, entropy calculation, and requirements

import { randomInt, timingSafeEqual } from 'crypto';

// ============================================
// CONFIGURATION
// ============================================

/**
 * Password validation requirements
 */
export interface IPasswordRequirements {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  allowedSpecialChars?: string;
}

/**
 * Default password requirements (Moderate security level)
 */
export const DEFAULT_PASSWORD_REQUIREMENTS: IPasswordRequirements = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: false,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
  allowedSpecialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?`~',
};

/**
 * Strong password requirements
 */
export const STRONG_PASSWORD_REQUIREMENTS: IPasswordRequirements = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  allowedSpecialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?`~',
};

/**
 * Password validation result
 */
export interface IPasswordValidationResult {
  valid: boolean;
  strength: 'weak' | 'moderate' | 'strong' | 'very-strong';
  errors: string[];
  warnings: string[];
  score: number; // 0-100
}

// ============================================
// COMMON PASSWORDS (Top 1000 most common passwords)
// ============================================

/**
 * A sample of commonly used passwords that should be rejected
 * In production, use a comprehensive list like the top 10,000 or 100,000
 */
const COMMON_PASSWORDS = new Set([
  'password', '123456', '12345678', '1234', '12345', '123456789',
  'password1', 'password123', '1234567', 'qwerty', 'abc123', '111111',
  'admin', 'letmein', 'trustno1', 'dragon', 'baseball', 'shadow',
  'master', '666666', 'photoshop', '123123', 'mustang', 'password2',
  'password3', 'welcome', 'football', 'monkey', 'joshua', 'access',
  'qwerty123', '1q2w3e4r', '123qwe', 'qazwsx', 'passw0rd', 'iloveyou',
  'starwars', 'pokemon', 'lol123', 'whatever', 'fuckyou', 'superman',
  'batman', 'trustno1', 'asdfgh', 'hunter', 'killer', 'solo', 'azerty',
  'qwertyuiop', '555555', 'lovely', '7777777', '888888', '123abc',
  'princess', 'adobe123', 'admin123', 'password12', 'password1234',
  'daniel', 'asdasd', 'jessica', 'sunshine', 'michael', 'andrew',
  'jordan', 'matthew', 'asshole', 'nicholas', 'cheese', 'amanda',
  'summer', 'love', 'ashley', 'nicole', 'chelsea', 'biteme',
  'matthew', 'access', 'yankees', '987654321', 'dallas', 'austin',
  'thunder', 'taylor', 'matrix', 'mobilemail', 'mom', 'monitor',
  'monitoring', 'montana', 'moon', 'moscow', 'nascar', 'nathan',
  'ncc1701', 'nebraska', 'newyork', 'night', 'nirvana', 'no',
  'nokia', 'nothing', 'office', 'oliver', 'open', 'orange',
  'packers', 'panther', 'pandora', 'patrick', 'paul', 'peanut',
  'pepper', 'philippines', 'phoenix', 'player', 'please', 'pookie',
  'president', 'prince', 'princess', 'pokemon', 'poland', 'purple',
  'raiders', 'rainbow', 'ranger', 'rasputin', 'raven', 'redsox',
  'redskins', 'richard', 'robert', 'rosebud', 'sailor', 'sally',
  'samson', 'samsung', 'saturn', 'scooter', 'scorpion', 'scott',
  'seattle', 'shelby', 'sherlock', 'siemens', 'simpson', 'skinner',
  'slayer', 'smeagol', 'sniper', 'soccer', 'sony', 'spider',
  'squid', 'stanford', 'star', 'stargate', 'starwars', 'steelers',
  'sticky', 'super', 'swan', 'switzerland', 'sysadmin', 'taco',
  'tadpole', 'taiwan', 'tank', 'taylor', 'tennessee', 'teresa',
  'terrorist', 'theman', 'thx1138', 'tiger', 'tiffany', 'tinkerbell',
  'tomcat', 'topgun', 'toyota', 'tracker', 'trouble', 'trust',
  'tsunami', 'tucker', 'turtle', 'twitter', 'underdog', 'united',
  'user', 'vampire', 'veteran', 'virgin', 'vodka', 'volcano',
  'walter', 'warrior', 'welcome', 'winston', 'wizard', 'wolf',
  'wolverine', 'wonka', 'xanadu', 'xxx', 'xxxxxxxx', 'yankee',
  'yellow', 'zxcvbnm', 'zxcvbn', '1qaz2wsx', 'qwertyuiop',
  '1234qwer', 'zaq12wsx', 'qwerty1234', 'password1!', 'password123!',
  'adminadmin', 'rootroot', 'testtest', 'guestguest', 'passpass',
]);

/**
 * Common password patterns to detect
 */
const PASSWORD_PATTERNS = [
  /\d{4,}/, // 4+ consecutive numbers (years, sequences)
  /(.)\1{2,}/, // 3+ consecutive same characters
  /123|234|345|456|567|678|789|987|876|765|654|543|432|321/, // Number sequences
  /qwe|wer|ert|rty|tyu|yui|uio|iop|asdf|sdfg|dfg|fgh|ghj|hjk|jkl|zxc|xcv|cvb|vbn|bnm/i, // Keyboard rows
  /abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i, // Letter sequences
];

// ============================================
// PASSWORD VALIDATION
// ============================================

/**
 * Validate a password against requirements
 *
 * @param password - The password to validate
 * @param requirements - Password requirements to check against
 * @returns Validation result with errors, warnings, and strength score
 */
export function validatePassword(
  password: string,
  requirements: IPasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS
): IPasswordValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for empty password
  if (!password) {
    return {
      valid: false,
      strength: 'weak',
      errors: ['Password is required'],
      warnings: [],
      score: 0,
    };
  }

  // Check length requirements
  if (password.length < requirements.minLength) {
    errors.push(`Password must be at least ${requirements.minLength} characters long`);
  }

  if (password.length > requirements.maxLength) {
    errors.push(`Password must not exceed ${requirements.maxLength} characters`);
  }

  // Check for uppercase letters
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase letters
  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for numbers
  if (requirements.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for special characters
  if (requirements.requireSpecialChars) {
    const specialChars = requirements.allowedSpecialChars || DEFAULT_PASSWORD_REQUIREMENTS.allowedSpecialChars!;
    const hasSpecialChar = new RegExp(`[${specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`).test(password);
    if (!hasSpecialChar) {
      errors.push(`Password must contain at least one special character (${specialChars})`);
    }
  }

  // Check for common passwords
  const lowerPassword = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lowerPassword)) {
    errors.push('This password is too common. Please choose a more unique password.');
  }

  // Check for common patterns
  for (const pattern of PASSWORD_PATTERNS) {
    if (pattern.test(password)) {
      warnings.push('Password contains common patterns and may be easier to guess');
      break;
    }
  }

  // Calculate strength score and determine strength level
  const score = calculatePasswordStrength(password);
  const strength = getStrengthLevel(score);

  // Add warnings based on strength
  if (strength === 'weak' && errors.length === 0) {
    warnings.push('This password is weak. Consider adding more variety to your password.');
  }

  const valid = errors.length === 0;

  return {
    valid,
    strength,
    errors,
    warnings,
    score,
  };
}

// ============================================
// PASSWORD STRENGTH CALCULATION
// ============================================

/**
 * Calculate password strength score (0-100)
 * Based on entropy, character variety, and length
 */
function calculatePasswordStrength(password: string): number {
  let score = 0;

  // Length score (up to 40 points)
  const lengthScore = Math.min(40, password.length * 2);
  score += lengthScore;

  // Character variety score (up to 40 points)
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  const varietyCount = [hasLowercase, hasUppercase, hasNumbers, hasSpecial].filter(Boolean).length;
  const varietyScore = varietyCount * 10;
  score += varietyScore;

  // Entropy bonus (up to 20 points)
  const uniqueChars = new Set(password).size;
  const entropyBonus = Math.min(20, (uniqueChars / password.length) * 20);
  score += entropyBonus;

  // Penalty for common patterns
  for (const pattern of PASSWORD_PATTERNS) {
    if (pattern.test(password)) {
      score = Math.max(0, score - 15);
      break;
    }
  }

  // Penalty for common passwords
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    score = 0;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Get strength level from score
 */
function getStrengthLevel(score: number): 'weak' | 'moderate' | 'strong' | 'very-strong' {
  if (score < 30) return 'weak';
  if (score < 50) return 'moderate';
  if (score < 75) return 'strong';
  return 'very-strong';
}

// ============================================
// PASSWORD GENERATION
// ============================================

/**
 * Generate a random password with specified requirements
 *
 * @param length - Desired password length
 * @param requirements - Password requirements to follow
 * @returns Generated password
 */
export function generatePassword(
  length: number = 16,
  requirements: IPasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS
): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = requirements.allowedSpecialChars || '!@#$%^&*()_+-=[]{}|;:,.<>?`~';

  let charset = lowercase;
  let password = '';

  // Ensure required character types are included
  if (requirements.requireLowercase) {
    password += lowercase[randomIndex(lowercase.length)];
  }

  if (requirements.requireUppercase) {
    password += uppercase[randomIndex(uppercase.length)];
    charset += uppercase;
  }

  if (requirements.requireNumbers) {
    password += numbers[randomIndex(numbers.length)];
    charset += numbers;
  }

  if (requirements.requireSpecialChars) {
    password += special[randomIndex(special.length)];
    charset += special;
  }

  // Fill the rest with random characters from all allowed sets
  if (!requirements.requireUppercase) charset += uppercase;
  if (!requirements.requireNumbers) charset += numbers;
  if (!requirements.requireSpecialChars) charset += special;

  while (password.length < length) {
    password += charset[randomIndex(charset.length)];
  }

  // Shuffle the password
  const shuffled = password.split('');
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.join('');
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if two passwords match using constant-time comparison
 * This prevents timing attacks that could reveal password information
 */
export function passwordsMatch(password: string, confirmPassword: string): boolean {
  // Length check must be done first (timing-safe)
  if (password.length !== confirmPassword.length) {
    return false;
  }

  // Use timingSafeEqual for constant-time comparison
  const a = Buffer.from(password);
  const b = Buffer.from(confirmPassword);

  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function randomIndex(maxExclusive: number): number {
  return randomInt(0, maxExclusive);
}

/**
 * Get user-friendly strength label
 */
export function getStrengthLabel(strength: IPasswordValidationResult['strength']): string {
  const labels = {
    'weak': 'Weak',
    'moderate': 'Moderate',
    'strong': 'Strong',
    'very-strong': 'Very Strong',
  };
  return labels[strength];
}

/**
 * Get strength color (for UI display)
 */
export function getStrengthColor(strength: IPasswordValidationResult['strength']): string {
  const colors = {
    'weak': '#ef4444', // red-500
    'moderate': '#f59e0b', // amber-500
    'strong': '#22c55e', // green-500
    'very-strong': '#16a34a', // green-600
  };
  return colors[strength];
}

/**
 * Get strength percentage for progress bar
 */
export function getStrengthPercentage(strength: IPasswordValidationResult['strength']): number {
  const percentages = {
    'weak': 25,
    'moderate': 50,
    'strong': 75,
    'very-strong': 100,
  };
  return percentages[strength];
}

/**
 * Sanitize error messages for display
 */
export function sanitizeErrorMessages(errors: string[]): string {
  if (errors.length === 0) return '';
  if (errors.length === 1) return errors[0];
  return errors.join('; ');
}
