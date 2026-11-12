/** Base URL of the FastAPI backend (set VITE_API_URL in frontend/.env). */
export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");

/** Encode each segment of a course-relative path for use in a URL. */
export function encodeCoursePath(path: string): string {
  return path
    .split(/[/\\]/)
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

/** URL of a file inside the configured course folder. */
export function courseFileUrl(path: string): string {
  return `${API_URL}/api/course-files/${encodeCoursePath(path)}`;
}

/** URL of the folder containing a course file (with trailing slash). */
export function courseFolderUrl(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean);
  parts.pop();
  const folder = parts.map(encodeURIComponent).join("/");
  return `${API_URL}/api/course-files/${folder}${folder ? "/" : ""}`;
}

/** URL that renders a course notebook (.ipynb) as HTML. */
export function notebookPreviewUrl(path: string): string {
  return `${API_URL}/api/notebook-preview/${encodeCoursePath(path)}`;
}

/**
 * Previews are shown from in-memory copies (so highlights can be injected),
 * which breaks relative links such as `images/plot.png`. A <base> tag makes
 * those links load from the course folder through the backend instead.
 */
export function withBaseHref(html: string, baseUrl: string): string {
  if (/<base\s/i.test(html)) return html;
  const tag = `<base href="${baseUrl.replace(/"/g, "&quot;")}">`;
  const head = html.match(/<head(\s[^>]*)?>/i);
  if (head && head.index !== undefined) {
    const end = head.index + head[0].length;
    return html.slice(0, end) + tag + html.slice(end);
  }
  return tag + html;
}

/** Read the `detail` message from a FastAPI error response, if any. */
export async function errorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // not JSON
  }
  return `${response.status} ${response.statusText}`.trim();
}
