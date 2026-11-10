// Google can omit the name; the email's local part is the friendliest fallback.
export function displayName(user: { name: string | null; email: string }): string {
  return user.name?.trim() || user.email.split("@")[0];
}
