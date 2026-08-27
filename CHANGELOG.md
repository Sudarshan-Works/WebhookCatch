# Changelog

All notable changes to this project will be documented in this file.

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
