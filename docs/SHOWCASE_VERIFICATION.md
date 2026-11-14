# Showcase verification

Checked on **November 14, 2026** against application commit [`93c132d1ff5df2e222f4b971b3a113766a16b0f2`](https://github.com/cojovi/cmac-cinematic/commit/93c132d1ff5df2e222f4b971b3a113766a16b0f2).

The showcase revision changes documentation and presentation assets. Application code and behavior are unchanged.

## Executed checks

Environment: macOS, Node.js **26.3.0**, npm **11.16.0**. Dependencies installed from the lockfile with `npm ci --ignore-scripts --no-audit --no-fund`.

| Check | Result |
| :--- | :--- |
| `npm test` | **Passed: 6 files, 59 tests.** Vitest unit tests and API tests use controlled/mocked dependencies. |
| `npm run lint` | **Passed**, exit code 0. |
| `npm run build` | **Passed**, TypeScript and Vite production bundle. |
| Public showroom | Opened the existing deployed site and captured its interface. No inquiry was submitted. |
| Employee preview | Opened the development-only fixture workspace and sales builder with empty Supabase browser configuration. Captured sample UI; did not save records or invoke providers. |
| README presentation | Checked desktop and narrow layouts, image loading, and native text/link structure. |

## Scope

These checks do not establish production OAuth, deployed RLS behavior, real inventory freshness, or Gmail delivery. The Playwright and database suites were not executed during this documentation refresh. See [development and operations](DEVELOPMENT.md) for those checks and the required local environment.

The screenshots are dated snapshots. The sales builder screenshot is a local fixture preview, not evidence of real inventory, customer activity, or completed transactions.

## Asset notes

The README artwork is original SVG illustration. Public showroom and local sales-preview images were captured from the application without compositing fictional interface states. Embedded Space Grotesk and JetBrains Mono subsets carry their [font license notices](../readme-assets/FONT-LICENSES.txt).
