/**
 * Safe decodeURIComponent, won't throw any error.
 * If `decodeURIComponent` error happen, just return the original value.
 *
 * Note: This function is used only for route/path parameters, not query parameters.
 * In URL path segments, `+` is a literal character (not a space), so we don't
 * replace `+` with spaces. For query parameters, use a different decoder that
 * handles `application/x-www-form-urlencoded` format.
 *
 * @param text - Text to decode
 * @returns URL decoded string
 * @private
 */
export function safeDecodeURIComponent(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
