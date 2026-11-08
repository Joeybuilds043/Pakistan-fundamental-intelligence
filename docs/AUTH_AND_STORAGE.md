# Authentication and Private Document Storage

## Implemented

- Supabase email/password sign-up, sign-in, persistent browser session and sign-out.
- Private Storage bucket: `pfi-source-documents`.
- Uploads are placed under `<auth-user-id>/<random-id>-<sanitized-filename>`.
- Bucket limit: 25 MiB per file.
- Allowed formats: PDF, XLSX, XLS and CSV.
- Bucket is private. No public object URLs are generated.
- Storage object policies restrict upload, read, update and delete to the authenticated user's own folder/object ownership.
- `public.source_documents` stores filename, storage key, MIME type, size, SHA-256, document type, fiscal year and statement scope. Existing row-level security restricts rows to the uploader.
- Browser uses only the Supabase publishable key. No service-role or secret key is included in the frontend.

## One-time Supabase dashboard setting

The project owner must allow the production Pages origin for email confirmation links:

1. Open the [Supabase project](https://supabase.com/dashboard/project/asoodudbjxjyiyloapfi).
2. Go to **Authentication → URL Configuration**.
3. Set **Site URL** to `https://pakistan-fundamental-intelligence.pages.dev`.
4. Add `https://pakistan-fundamental-intelligence.pages.dev` under **Redirect URLs**.
5. Save changes.

Keep email confirmation enabled. The app sends the production origin as the email redirect target. Test with an account you control.

Supabase's default email sender is suitable for initial testing only and has strict sending limits on the Free plan. Configure a trusted SMTP provider before inviting multiple users.

## Free-plan guardrails

- Organization plan: Free.
- File storage quota: 1 GB.
- Egress quota: 5 GB cached + 5 GB uncached.
- Per-file upload cap: 25 MiB.
- Do not upgrade the organization or enable R2 without explicit approval.
- Monitor Storage and Egress usage in Supabase. The Free plan does not include paid overage for file storage.

## Important limitations

Uploads are stored as original files and registered in Postgres. The platform does not yet extract statement tables, validate figures, reconcile financial statements or create financial observations automatically. A stored document is not an analyzed document.

The app currently supports standard uploads up to 25 MiB. Large-file resumable uploads are not implemented.
