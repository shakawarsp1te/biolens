/**
 * Mirrors api/app/services/password_policy.py's rules exactly, for an
 * instant client-side strength meter — same relationship as
 * discoverFilters.ts to discover.py. The backend re-checks every one of
 * these itself on signup; this file is UX only, never the source of truth.
 */

export const MIN_LENGTH = 10;
const SPECIAL_CHARS = "!@#$%^&*()_+-=[]{}|;:,.<>?/~`";

const COMMON_PASSWORDS = new Set([
  "password123",
  "password1234",
  "qwertyuiop12",
  "1234567890ab",
  "letmein12345",
  "iloveyou1234",
]);

export interface PasswordRuleResult {
  label: string;
  passed: boolean;
}

/** One entry per rule, in the same order the backend reports them, so a
 * live checklist can render check/x per rule as the user types. */
export function checkPasswordRules(password: string, email?: string): PasswordRuleResult[] {
  const rules: PasswordRuleResult[] = [
    { label: `At least ${MIN_LENGTH} characters`, passed: password.length >= MIN_LENGTH },
    { label: "A lowercase letter", passed: /[a-z]/.test(password) },
    { label: "An uppercase letter", passed: /[A-Z]/.test(password) },
    { label: "A number", passed: /\d/.test(password) },
    {
      label: "A special character (! @ # $ % & *)",
      passed: [...password].some((char) => SPECIAL_CHARS.includes(char)),
    },
  ];

  if (password.length > 0 && COMMON_PASSWORDS.has(password.toLowerCase())) {
    rules.push({ label: "Not a commonly used password", passed: false });
  }

  if (email) {
    const localPart = email.split("@")[0]?.toLowerCase();
    if (localPart) {
      rules.push({
        label: "Doesn't contain your email address",
        passed: !password.toLowerCase().includes(localPart),
      });
    }
  }

  return rules;
}

export function isPasswordValid(password: string, email?: string): boolean {
  return checkPasswordRules(password, email).every((rule) => rule.passed);
}
