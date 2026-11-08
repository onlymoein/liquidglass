/**
 * Returns `href` if it is safe to navigate to, and `undefined` if it isn't.
 * Relative links and http, https, mailto, tel and sms links are safe; anything
 * else, such as `javascript:` or `data:`, would run script from a string that
 * may have come from untrusted data.
 */
export function safeHref(href: string | undefined): string | undefined {
  if (href === undefined) return undefined;
  // Browsers ignore tabs, newlines and leading control characters or spaces inside a scheme.
  // eslint-disable-next-line no-control-regex
  const flat = href.replace(/[\u0000- ]/g, "");
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(flat);
  if (!scheme) return href;
  return /^(https?|mailto|tel|sms)$/i.test(scheme[1]!) ? href : undefined;
}
