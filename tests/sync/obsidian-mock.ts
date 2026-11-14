// Node mock of the parts of the obsidian API used by src/sync/*.
export const Platform = { isDesktopApp: true, isMobile: false };
export const calls: any[] = [];
export let handler: (req: any) => { status: number; body?: any } = () => ({ status: 500 });
export function setHandler(h: typeof handler) { handler = h; }
export async function requestUrl(req: any) {
  // Real token endpoints are rerouted to the mock handler; local test URLs go through fetch.
  calls.push(req);
  if (req.url.startsWith("http://127.0.0.1")) {
    const r = await fetch(req.url, { method: req.method, headers: { "Content-Type": req.contentType ?? "" }, body: req.body });
    const text = await r.text();
    return { status: r.status, text, get json() { return JSON.parse(text); } };
  }
  const r = handler(req);
  const text = r.body === undefined ? "" : JSON.stringify(r.body);
  return { status: r.status, text, get json() { return JSON.parse(text); } };
}
export class Events {}
