import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;
export const MAX_BCRYPT_PASSWORD_BYTES = 72;

/**
 * Public, non-secret work factor fixture used only to equalize credential
 * checks when no usable account hash exists. It hashes the dummy input below
 * with bcrypt cost 12 and must never be generated per request.
 */
export const CREDENTIALS_DUMMY_PASSWORD =
  "auth-dummy-password-never-used";
export const CREDENTIALS_DUMMY_PASSWORD_HASH =
  "$2a$12$Q9Zsra7V4cjtM7i016djiun6rgpsj9KfQ9Q8vumNSUpLfCoEB/wtm";

type BcryptCompare = (password: string, hash: string) => Promise<boolean>;

// Credentials login accepts only the same cost used by the public dummy hash.
// Accepting another cost would recreate an account-existence timing signal and
// could let a corrupted high-cost row amplify CPU use. The aggregate DB audit
// reports every non-12 legacy value before this code can be rolled out.
const SUPPORTED_BCRYPT_HASH_PATTERN =
  /^\$2[ab]\$12\$[./A-Za-z0-9]{53}$/;

/** Bcrypt ignores input after 72 bytes, so longer values must be rejected. */
export function isBcryptSafePassword(value: unknown): value is string {
  return (
    typeof value === "string" &&
    new TextEncoder().encode(value).byteLength <= MAX_BCRYPT_PASSWORD_BYTES
  );
}

export function isSupportedBcryptPasswordHash(
  value: unknown,
): value is string {
  return (
    typeof value === "string" && SUPPORTED_BCRYPT_HASH_PATTERN.test(value)
  );
}

/**
 * Performs exactly one bcrypt comparison for every caller invocation.
 *
 * Invalid/missing/overlong password input and absent/malformed hashes use a
 * fixed cost-12 dummy pair. A dummy comparison can never authenticate because
 * success is returned only when both original inputs were eligible.
 */
export async function verifyPasswordConstantWork(
  password: unknown,
  hash: unknown,
  compare: BcryptCompare = bcrypt.compare,
): Promise<boolean> {
  const usablePassword =
    isBcryptSafePassword(password) && password.length > 0;
  const usableHash = isSupportedBcryptPasswordHash(hash);
  const useStoredCredential = usablePassword && usableHash;

  const compared = await compare(
    useStoredCredential ? password : CREDENTIALS_DUMMY_PASSWORD,
    useStoredCredential ? hash : CREDENTIALS_DUMMY_PASSWORD_HASH,
  );

  return useStoredCredential && compared;
}

/**
 * Hash a password using bcrypt with 12 rounds
 */
export async function hashPassword(password: string): Promise<string> {
  if (!isBcryptSafePassword(password)) {
    throw new Error("Password exceeds bcrypt byte limit");
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (!isBcryptSafePassword(password)) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Validate password requirements
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!isBcryptSafePassword(password)) {
    errors.push("Lozinka ne sme biti duža od 72 bajta");
  }

  if (password.length < 8) {
    errors.push("Lozinka mora imati minimum 8 karaktera");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Lozinka mora sadržati bar jedno veliko slovo");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Lozinka mora sadržati bar jedan broj");
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Lozinka mora sadržati bar jedan specijalni karakter");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
