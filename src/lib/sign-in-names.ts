/**
 * Which account a sign-in name reaches. The login page finds an account by
 * username. The forward-auth portal accepts the username too, and also the
 * account's email address and its portal name, the email address
 * `<name>@localhost` (how the primary admin and older accounts sign in there).
 * Ingressi keeps every name pointing at one account: a username is never
 * another account's username, email address or portal name, and an email
 * address is never another account's username (nor, for a @localhost address,
 * is the part before it). Better Auth lowercases what is typed on the login
 * page, so names are compared case-insensitively.
 *
 * Server only: the page-safe username rules are in login-username.ts.
 */
import { and, ne, or } from "drizzle-orm";
import { users } from "./db/schema";
import { isUsableSignInUsername, isValidLoginUsername } from "./login-username";
import { first, lowerEquals } from "@/src/lib/db/ops";
import type { AppTx } from "@/src/lib/db/types";

/** The database or a transaction on it. */
export type SignInNameReader = Pick<AppTx, "select">;

/** The forward-auth portal also finds the account whose email is the typed name plus this. */
export const PORTAL_EMAIL_DOMAIN = "@localhost";

export const SIGN_IN_NAME_TAKEN_MESSAGE = "Another account already signs in with this name or has it as its email address";

/** Condition matching every account but `userId` (null: every account). */
function otherThan(userId: number | null) {
  return userId === null ? undefined : ne(users.id, userId);
}

/**
 * Whether an account other than `userId` (null: any account) has `name`
 * (lowercase) as its username or email address, or has the email address the
 * portal looks up for `name`.
 */
export async function isSignInNameTaken(reader: SignInNameReader, userId: number | null, name: string): Promise<boolean> {
  return !!await first(reader
    .select({ id: users.id })
    .from(users)
    .where(and(
      or(
        lowerEquals(users.username, name),
        lowerEquals(users.email, name),
        lowerEquals(users.email, name + PORTAL_EMAIL_DOMAIN)
      ),
      otherThan(userId)
    ))
    .limit(1));
}

/**
 * The account the forward-auth portal signs `typed` in to, or null when it
 * reaches none or, in data that predates the rules above, more than one.
 * `typed` is matched, ignoring case, against the usernames, the email
 * addresses and the portal names (`<name>@localhost` addresses). Where one
 * account has it as its username, that account wins, as on the login page;
 * otherwise exactly one account may match by email address or portal name.
 */
export async function findPortalAccount(reader: SignInNameReader, typed: string) {
  // The name is lowercased here but SQL lower() folds ASCII only: a character
  // that lowercases into ASCII (the Kelvin sign) would reach another account.
  if (lowercasesIntoAscii(typed)) return null;
  const name = typed.trim().toLowerCase();
  if (!name) return null;

  const candidates = await reader
    .select()
    .from(users)
    .where(or(
      lowerEquals(users.username, name),
      lowerEquals(users.email, name),
      lowerEquals(users.email, name + PORTAL_EMAIL_DOMAIN)
    ));

  const byUsername = candidates.filter((user) => user.username?.toLowerCase() === name);
  if (byUsername.length > 0) return byUsername.length === 1 ? byUsername[0] : null;
  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * Why account `userId` (null for one not created yet) cannot have the email
 * address `email`, or null when it can: another account has the address, in
 * any case, or signs in with it (or, for a @localhost address, with the part
 * before it) as its username.
 */
export async function signInEmailConflict(reader: SignInNameReader, userId: number | null, email: string): Promise<string | null> {
  const address = email.trim().toLowerCase();
  const sameAddress = await first(reader
    .select({ id: users.id })
    .from(users)
    .where(and(lowerEquals(users.email, address), otherThan(userId)))
    .limit(1));
  if (sameAddress) return "A user with this email already exists";

  const signsInWithAddress = await first(reader
    .select({ id: users.id })
    .from(users)
    .where(and(lowerEquals(users.username, address), otherThan(userId)))
    .limit(1));
  if (signsInWithAddress) return "Another account signs in with this email address as its username";

  if (address.endsWith(PORTAL_EMAIL_DOMAIN)) {
    const portalName = address.slice(0, -PORTAL_EMAIL_DOMAIN.length);
    const signsInWithPortalName = await first(reader
      .select({ id: users.id })
      .from(users)
      .where(and(lowerEquals(users.username, portalName), otherThan(userId)))
      .limit(1));
    if (signsInWithPortalName) return `Another account signs in with the name before ${PORTAL_EMAIL_DOMAIN} as its username`;
  }
  return null;
}

/**
 * Whether lowercasing `value` turns a character outside ASCII into ASCII, as
 * it turns the Kelvin sign into 'k'. The lowercased address is then another
 * one, which can belong to somebody else.
 */
export function lowercasesIntoAscii(value: string): boolean {
  return [...value].some((char) =>
    char.codePointAt(0)! > 0x7f && [...char.toLowerCase()].some((lowered) => lowered.codePointAt(0)! <= 0x7f)
  );
}

/**
 * The only username Ingressi gives an account by itself: the account's own email
 * address, lowercased and otherwise unchanged, when the login page can find
 * that and isSignInNameTaken is false for it. Null otherwise; the account then
 * has no sign-in username until an administrator sets one. `userId` is the
 * account (null for one not created yet).
 */
export async function ownEmailUsername(reader: SignInNameReader, userId: number | null, email: string): Promise<string | null> {
  // Checked before lowercasing, so that only A-Z change (see lowercasesIntoAscii).
  if (!isValidLoginUsername(email)) return null;
  const username = email.toLowerCase();
  return isUsableSignInUsername(username) && !await isSignInNameTaken(reader, userId, username) ? username : null;
}
