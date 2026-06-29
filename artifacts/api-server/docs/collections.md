# Saved Lead Collections API

All routes are mounted under `/api/collections` and require an authenticated
Clerk session (`getAuth(req).userId`). Every query is scoped to the caller's
`clerkUserId`, so a member can only see and mutate their own collections.
Membership is de-duplicated by a `unique(collection_id, lead_id)` constraint.

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/collections` | — | List the member's collections with `leadCount`. Query: `q` (name search), `archived=1` (include archived). |
| POST | `/api/collections` | `{ name, color? }` | Create a collection. Returns `{ collection }` (201). |
| PATCH | `/api/collections/:id` | `{ name?, color?, archived? }` | Rename / recolor / archive. Returns `{ collection }`. |
| POST | `/api/collections/:id/duplicate` | — | Duplicate a collection and its membership. Returns `{ collection }` (201). |
| DELETE | `/api/collections/:id` | — | Delete a collection and its membership rows (leads are not deleted). |
| GET | `/api/collections/:id/leads` | — | Leads in a collection (excludes soft-deleted). Query: `page`, `limit` (≤200). Returns `{ leads, total, page, pages }`. |
| POST | `/api/collections/:id/leads` | `{ leadIds: number[] }` | Bulk add leads (deduped). Returns `{ added, requested }`. |
| DELETE | `/api/collections/:id/leads` | `{ leadIds: number[] }` | Bulk remove leads. Returns `{ removed }`. |
| PATCH | `/api/collections/reorder` | `{ order: number[] }` | Persist collection ordering (ids in display order → `sort_order`). |

**Validation:** names are trimmed and clamped to 80 chars (empty rejected);
`leadIds`/`order` are coerced to unique positive integers, max 1000 per request.

**Errors:** `401` when unauthenticated, `400` on invalid input, `404` when the
collection does not exist or is not owned by the caller.

**Schema:** see `lib/db/src/schema/collections.ts` and migration
`lib/db/migrations/0001_collections.sql`. Apply in dev with
`pnpm --filter @workspace/db run push`.
