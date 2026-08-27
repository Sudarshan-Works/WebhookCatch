# Changelog

## v0.1.5 - 2026-08-27
### Added
- **Request Inspector Upgrade**: Complete overhaul of the inspector UI.
- Support for capturing sub-paths in webhook URLs (e.g. `/w/[id]/my-custom-path`).
- New request metadata header showing Path, Status, Content Type, Size, and Timestamp.
- "Raw" tab to view the original HTTP request string.
- Client-side JSON pretty-formatting and syntax highlighting via Highlight.js.
- "Copy JSON" button for one-click payload copying.
- "Copy as cURL" button to easily replay captured requests.

All notable changes to this project will be documented in this file.

## [v0.1.4] - 2026-08-27
### Changed
- Real-Time Updates: Replaced aggressive client-side polling with a Server-Sent Events (SSE) stream endpoint.
- Webhook requests now appear in the dashboard instantly without any manual reload or polling interval delays.
- The EventSource implementation automatically handles network disconnects gracefully.

## [v0.1.3] - 2026-08-27
### Changed
- Complete UI Overhaul: Implemented a modern 2026 developer-tool interface inspired by Vercel's Geist design language.
- Redesigned Homepage: Added multi-stop mesh gradients, stacked pill badges, refined typography, and smooth hover animations.
- Redesigned Dashboard: Implemented a split-pane app shell with a polished top navigation bar, refined request inbox sidebar, and a code-editor mockup for body payload inspection.
- Improved Empty States: Added animated pulse indicators and sleek placeholder cards for the dashboard.
- Button Feedback: Added loading spinner and disabled state to the "Create Webhook" button.

## [0.1.2] - 2026-08-27
### Fixed
- Fixed an issue in local development where Vite's file watcher was tracking the `.wrangler` state directory, causing infinite page reloads.

## [0.1.1] - 2026-08-27
### Fixed
- Fixed an issue in local development where Vite's file watcher was tracking the `.wrangler` state directory, causing infinite page reloads.

## [0.1.0] - 2026-08-27
### Added
- Initial project setup with Astro and Tailwind CSS v4.
- `DESIGN.md` integration for Geist design tokens.
- Cloudflare D1 database integration with local schema.
- `/api/sessions` endpoint to generate secure session URLs.
- `/w/[id]` webhook receiver endpoint to catch incoming payloads.
- `/api/sessions/[id]/requests` endpoint to fetch requests for a session.
- Landing page with CTA.
- Dashboard view to inspect webhook payloads in real-time.
- Local development configuration fixed for Astro v6+ breaking changes.
