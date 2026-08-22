const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://cmaccontainers.com', 'https://www.cmaccontainers.com']

export function corsHeaders(request: Request) {
  const configured = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((item) => item.trim()).filter(Boolean)
  const allowed = new Set([...defaultOrigins, ...configured])
  const origin = request.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': allowed.has(origin) ? origin : defaultOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-docusign-signature-1',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

export function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
}

export function options(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) })
}

export async function parseJson<T>(request: Request, maxBytes = 32_768): Promise<T> {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > maxBytes) throw new Error('Request body is too large.')
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('Request body is too large.')
  return JSON.parse(text) as T
}
