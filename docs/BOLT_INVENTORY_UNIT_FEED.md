# Bolt-Data contract request: available mini-home units

## Purpose

The CMAC Sales Portal currently reads only the aggregate `public.mini_homes_inventory` view through the server-only `/api/inventory` function. Model cards are intentionally provided by a mock `InventoryProvider` and cannot become legal or sold unit references.

To move individual unit selection to Bolt-Data, publish a stable, read-only `public.mini_homes_available_units` view in the separate Bolt-Data Supabase project. The CRM must not query raw Bolt tables, call ECI Bolt, or reproduce aggregate counting logic.

## Required columns

| Column | Type | Null | Contract |
| --- | --- | --- | --- |
| `external_unit_id` | `text` | No | Stable operational unit or job ID. Never recycled. |
| `external_product_type` | `text` | No | Authoritative Bolt product type used for attribution. |
| `display_label` | `text` | No | Human-readable model or unit label. |
| `operational_status` | `text` | No | Normalized value: `available`, `allocated`, `production`, or `sold`. |
| `is_available` | `boolean` | No | Authoritative selectable state. |
| `is_allocated_boss` | `boolean` | No | Aggregate context without customer identity. |
| `location_label` | `text` | Yes | Optional approved, non-PII facility/region label only. |
| `source_updated_at` | `timestamptz` | No | Timestamp of the source record used for this row. |
| `last_synced_at` | `timestamptz` | No | Timestamp of the Bolt-Data synchronization that published the row. |
| `authoritative_price` | `numeric(12,2)` | Yes | Include only if Bolt owns the sale price. Otherwise return `null`. |

## Explicit exclusions

The view must exclude customer names, emails, phone numbers, street addresses, raw work-order fields, internal notes, and any aggregate counting SQL. It must not expose service-role credentials or an ECI Bolt access path.

## Example response

```json
[
  {
    "external_unit_id": "MH-2026-0142",
    "external_product_type": "Mini Home",
    "display_label": "CMAC Living 40",
    "operational_status": "available",
    "is_available": true,
    "is_allocated_boss": false,
    "location_label": "Texas facility",
    "source_updated_at": "2026-08-21T15:42:11Z",
    "last_synced_at": "2026-08-21T15:45:00Z",
    "authoritative_price": null
  }
]
```

## Freshness and failure behavior

- Bolt-Data owns synchronization and status semantics.
- The CRM treats data older than one hour as stale and visibly warns the employee.
- A stale or failed feed never falls back to invented unit availability.
- Units absent from the view cannot be newly selected as Bolt-confirmed units.
- Existing deal references retain their recorded external ID and source timestamp for auditability.

## Provider migration

1. Publish and permission-test the view in Bolt-Data.
2. Add a server-only Vercel function that reads exactly this view with the existing Bolt service-role secret.
3. Implement `BoltInventoryProvider` against that function and contract-test nullability/status mapping.
4. Switch model selection to the Bolt provider behind an environment flag in preview.
5. Verify RLS/authentication, stale handling, zero inventory, direct refresh, and responsive UI.
6. Promote after operations confirms IDs, status semantics, and optional pricing authority.
