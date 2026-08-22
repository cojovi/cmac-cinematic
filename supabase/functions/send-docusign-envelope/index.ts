import { canAccessOwnedRecord, requireEmployee } from '../_shared/auth.ts'
import { docusignAccessToken, docusignConfig } from '../_shared/docusign.ts'
import { json, options, parseJson } from '../_shared/http.ts'

interface Input { deal_id?: string; template_id?: string }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return options(request)
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405)
  const auth = await requireEmployee(request)
  if (!('employee' in auth)) return json(request, { error: auth.error }, auth.status)
  try {
    const input = await parseJson<Input>(request)
    if (!input.deal_id || !input.template_id) return json(request, { error: 'Deal and template IDs are required.' }, 422)
    const client = auth.client
    const { data: deal, error: dealError } = await client.from('deals').select('*,contacts(id,display_name,email),deal_units(*)').eq('id', input.deal_id).maybeSingle()
    if (dealError || !deal || !canAccessOwnedRecord(auth.employee, deal.sales_rep_id)) return json(request, { error: 'The deal is outside your assigned CRM scope.' }, 403)
    const units = (deal.deal_units ?? []) as Array<{ source: string; external_unit_id: string; external_product_type: string; confirmed_at: string | null }>
    if (units.length === 0 || units.some((unit) => unit.source === 'mock' || !unit.confirmed_at)) return json(request, { error: 'Every contract unit must have a confirmed non-mock operational identity.' }, 409)
    const { data: template, error: templateError } = await client.from('document_templates').select('*').eq('id', input.template_id).eq('is_active', true).maybeSingle()
    if (templateError || !template || template.provider !== 'docusign' || !template.provider_template_id) return json(request, { error: 'The legal template is inactive or not mapped to DocuSign.' }, 409)
    const contact = deal.contacts as { id: string; display_name: string; email: string } | null
    if (!contact?.email || !contact.display_name) return json(request, { error: 'The deal contact is missing a legal name or email.' }, 422)

    let config
    let accessToken
    try { config = docusignConfig(); accessToken = await docusignAccessToken(config) }
    catch (error) { return json(request, { error: error instanceof Error ? error.message : 'DocuSign is not configured.' }, 503) }

    const { data: contract, error: contractError } = await client.from('contracts').insert({ deal_id: deal.id, contact_id: contact.id, employee_id: auth.employee.id, template_id: template.id, status: 'draft' }).select('id').single()
    if (contractError) throw contractError
    const unitIds = units.map((unit) => unit.external_unit_id).join(', ')
    const productTypes = units.map((unit) => unit.external_product_type).join(', ')
    const envelope = {
      templateId: template.provider_template_id,
      templateRoles: [{
        email: contact.email,
        name: contact.display_name,
        roleName: Deno.env.get('DOCUSIGN_SIGNER_ROLE_NAME')?.trim() || 'Customer',
        tabs: { textTabs: [
          { tabLabel: 'CustomerName', value: contact.display_name },
          { tabLabel: 'CustomerEmail', value: contact.email },
          { tabLabel: 'DealNumber', value: deal.deal_number },
          { tabLabel: 'ProjectAddress', value: deal.project_address ?? '' },
          { tabLabel: 'UnitIDs', value: unitIds },
          { tabLabel: 'ProductTypes', value: productTypes },
          { tabLabel: 'BaseAmount', value: String(deal.base_amount) },
          { tabLabel: 'DeliveryAmount', value: String(deal.delivery_amount) },
        ] },
      }],
      customFields: { textCustomFields: [
        { name: 'cmac_employee_id', value: auth.employee.id, show: 'false' },
        { name: 'cmac_rep_code', value: auth.employee.rep_code, show: 'false' },
        { name: 'cmac_deal_id', value: deal.id, show: 'false' },
        { name: 'cmac_unit_ids', value: unitIds, show: 'false' },
      ] },
      emailSubject: `CMAC Container Homes agreement — ${deal.deal_number}`,
      status: 'sent',
    }
    const response = await fetch(`${config.baseUrl}/v2.1/accounts/${config.accountId}/envelopes`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(envelope) })
    const result = await response.json() as { envelopeId?: string; status?: string; message?: string }
    if (!response.ok || !result.envelopeId) {
      await client.from('contracts').update({ status: 'error', error_message: result.message ?? `DocuSign returned HTTP ${response.status}` }).eq('id', contract.id)
      return json(request, { error: result.message ?? 'DocuSign rejected the envelope.' }, 502)
    }
    await client.from('contracts').update({ provider_envelope_id: result.envelopeId, status: 'sent', sent_at: new Date().toISOString(), error_message: null }).eq('id', contract.id)
    await client.from('activities').insert({ contact_id: contact.id, deal_id: deal.id, employee_id: auth.employee.id, activity_type: 'contract_sent', title: `Contract sent through DocuSign for ${deal.deal_number}`, metadata: { contract_id: contract.id, envelope_id: result.envelopeId } })
    return json(request, { message: 'DocuSign confirmed the envelope was sent.', contract_id: contract.id })
  } catch (error) {
    console.error('send-docusign-envelope failed', error instanceof Error ? error.message : 'unknown error')
    return json(request, { error: error instanceof Error ? error.message : 'The contract could not be prepared.' }, 500)
  }
})
