import { qrEmailBody, qrRecipient, type QrAnswers, type QrEmailStatus } from './qr.ts'
import { bytesToBase64, stringToBase64Url } from './jwt.ts'

export interface QrDelivery { status: QrEmailStatus; error: string | null; messageId?: string }
export async function deliverQrNotification(answers: QrAnswers, id: string, getToken: (email: string) => Promise<string>, fetcher: typeof fetch = fetch): Promise<QrDelivery> {
  let token: string
  try { token = await getToken(qrRecipient) }
  catch (error) {
    return {
      status: 'not_configured',
      error: error instanceof Error && error.message === 'Gmail delegation is not configured.'
        ? 'Gmail service-account secrets are missing in Supabase. Configure GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL and GOOGLE_WORKSPACE_PRIVATE_KEY, then retry.'
        : 'Gmail authorization unavailable. Check Workspace delegation, service-account secrets, and Google connectivity, then retry.',
    }
  }
  const raw = [
    `From: CMAC QR Inquiries <${qrRecipient}>`, `To: ${qrRecipient}`, `Reply-To: ${answers.email}`,
    `Subject: CMAC QR inquiry - ${answers.location} - ${id.slice(0, 8)}`,
    `Message-ID: <qr-${id}@cmaccontainers.com>`, 'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
    // Encode the body, not customer-supplied MIME headers.
    bytesToBase64(new TextEncoder().encode(qrEmailBody(answers,id))).match(/.{1,76}/g)?.join('\r\n') ?? '', '',
  ].join('\r\n')
  try {
    const response = await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: stringToBase64Url(raw) }), signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return response.status < 500
      ? { status: 'failed', error: `Gmail rejected the notification (HTTP ${response.status}). Check email configuration before retrying.` }
      : { status: 'unknown', error: 'Gmail returned a server error. Check Charley’s Sent mail before taking further action; automatic retry is blocked.' }
    const result = await response.json() as { id?: string }
    if (!result.id) return { status: 'unknown', error: 'Gmail did not return a message ID. Verify Sent mail; automatic retry is blocked.' }
    return { status: 'sent', error: null, messageId: result.id }
  } catch { return { status: 'unknown', error: 'Email outcome is unconfirmed. Verify Charley’s Sent mail; automatic retry is blocked to avoid duplicates.' } }
}
