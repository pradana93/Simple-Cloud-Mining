/**
 * Build a stable keyset page URL for a Supabase table. Returning rows in id
 * order and continuing from the last id avoids offset drift when rows are
 * inserted while the backup runs.
 *
 * @param {string} baseUrl
 * @param {string} table
 * @param {string | null} afterId
 * @param {number} pageSize
 * @returns {string}
 */
export function backupPageUrl(baseUrl, table, afterId, pageSize) {
  const root = baseUrl.replace(/\/+$/, "");
  const params = new URLSearchParams({
    select: "*",
    order: "id.asc",
    limit: String(pageSize),
  });
  if (afterId) params.set("id", `gt.${afterId}`);
  return `${root}/rest/v1/${table}?${params.toString()}`;
}
