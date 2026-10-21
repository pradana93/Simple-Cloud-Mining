# Restore runbook

## Current production posture

- The production project currently reports `pitr_enabled: false` and no stored backups.
- A logical backup is the only copy until native backups or PITR are enabled.
- Take a backup before applying a money or auth migration, and store the file off the server.
- `BACKUP_ENCRYPTION_KEY` must live in a secret manager, never in the same place as the backup.

Check the current posture:

```powershell
npm run backup:check
```

## Encrypted logical backup

Add these to `.env.local`:

```
BACKUP_ENCRYPTION_KEY=<at least 32 random characters>
# optional
BACKUP_DIR=D:\backups\scm
```

Then run:

```powershell
npm run backup
```

The output is `backups/scm-<timestamp>.json.enc`, AES-256-GCM encrypted. The script refuses to write unencrypted data. It exports the application tables only. Supabase Auth users and password hashes are not exportable this way.

Recommended cadence: daily after the low-traffic cron window, plus immediately before any migration.

## Decrypt for a drill

```powershell
npm run backup:decrypt -- --in backups/scm-....json.enc
```

This prints table counts only. To write plaintext for an actual restore:

```powershell
npm run backup:decrypt -- --in backups/scm-....json.enc --out C:\secure\restore.json
```

Delete the plaintext file immediately after the drill.

## Restore drill

1. Create a separate Supabase staging project. Do not restore into production.
2. Apply migrations `001` through the current migration with `supabase db push --db-url <staging-db-url>`.
3. Recreate the Auth users in staging. The app tables reference `auth.users`; a logical app-data restore cannot recreate passwords.
4. Decrypt the backup to a secure local file.
5. Set the target credentials and run the replay:

```powershell
$env:RESTORE_TARGET_URL="https://<staging-ref>.supabase.co"
$env:RESTORE_TARGET_SERVICE_KEY="<staging-service-role-key>"
$env:RESTORE_CONFIRM="YES"
npm run backup:restore -- --in C:\secure\restore.json
```

The replay refuses a target that looks like the source project unless `ALLOW_SAME_PROJECT=YES` is also set.

6. Reset serial sequences in the staging SQL editor:

```sql
select setval(pg_get_serial_sequence('public.transactions_history','id'), coalesce(max(id),1), max(id) is not null) from public.transactions_history;
select setval(pg_get_serial_sequence('public.user_deposits','id'), coalesce(max(id),1), max(id) is not null) from public.user_deposits;
select setval(pg_get_serial_sequence('public.user_withdrawal','id'), coalesce(max(id),1), max(id) is not null) from public.user_withdrawal;
select setval(pg_get_serial_sequence('public.affiliate_history','id'), coalesce(max(id),1), max(id) is not null) from public.affiliate_history;
select setval(pg_get_serial_sequence('public.balance_ledger','id'), coalesce(max(id),1), max(id) is not null) from public.balance_ledger;
select setval(pg_get_serial_sequence('public.game_bets','id'), coalesce(max(id),1), max(id) is not null) from public.game_bets;
select setval(pg_get_serial_sequence('public.game_rounds','id'), coalesce(max(id),1), max(id) is not null) from public.game_rounds;
select setval(pg_get_serial_sequence('public.crash_rounds','id'), coalesce(max(id),1), max(id) is not null) from public.crash_rounds;
```

7. Verify counts and reconciliation:

```sql
select count(*) from public.profiles;
select count(*) from public.balance_ledger;
select count(*) from public.game_bets;
select * from public.balance_reconciliation limit 20;
select * from public.ledger_summary();
```

8. Smoke test sign-in, a read-only dashboard, one instant-game bet, and one withdrawal request in staging. Do not send real payouts.
9. Record the restore duration, row counts, and any mismatches in this file.

## Native Supabase restore

When native backups or PITR are enabled, prefer the Supabase dashboard restore flow for full-project recovery, because it includes Auth and storage metadata. A logical replay remains useful for selective app-data recovery and drills.

## Known limitation

A full restore drill is blocked until there is a staging project or `SUPABASE_DB_URL`. The backup, decrypt, and replay scripts can be rehearsed locally, but do not mark the drill complete until a staging restore has actually run.
