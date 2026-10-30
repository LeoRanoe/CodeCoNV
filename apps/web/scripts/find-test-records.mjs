/**
 * Lists the test records the QA sweep left on a project (L12). It only reads, never writes: you
 * withdraw each record yourself in the app, with a reason, so the history stays.
 *
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_PUBLISHABLE_KEY=... \
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... \
 *   node scripts/find-test-records.mjs
 *
 * It signs in as you, so it sees exactly what you see, and sends GET requests only.
 */
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!url || !key || !email || !password) {
  console.error("Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ADMIN_EMAIL and ADMIN_PASSWORD.");
  process.exit(1);
}

const pattern = new RegExp(process.env.PATTERN ?? "TEST 360|DELETE ME|Test phase 3|Sweep tile|QA[- ]sweep|release gate", "i");
const sources = [
  { table: "findings", select: "id,finding_number,title,status", fields: ["title"], label: (row) => `${row.finding_number} · ${row.title} · ${row.status}` },
  { table: "project_register_entries", select: "id,entry_number,register_type,title,status", fields: ["title"], label: (row) => `${row.entry_number} (${row.register_type}) · ${row.title} · ${row.status}` },
  { table: "inspections", select: "id,inspection_number,title,status", fields: ["title"], label: (row) => `${row.inspection_number} · ${row.title} · ${row.status}` },
  { table: "actions", select: "id,action_number,title,status", fields: ["title"], label: (row) => `${row.action_number} · ${row.title} · ${row.status}` },
  { table: "visual_captures", select: "id,title,status", fields: ["title"], label: (row) => `${row.title} · ${row.status}` },
  { table: "files", select: "id,original_name,category,status", fields: ["original_name"], label: (row) => `${row.original_name} (${row.category}) · ${row.status}` },
  { table: "media_folders", select: "id,name,status", fields: ["name"], label: (row) => `folder ${row.name} · ${row.status}` },
];

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: key, "content-type": "application/json" },
  body: JSON.stringify({ email, password }),
});
if (!login.ok) {
  console.error(`Sign-in failed (${login.status}).`);
  process.exit(1);
}
const { access_token: token } = await login.json();

let found = 0;
for (const source of sources) {
  for (let from = 0; ; from += 1000) {
    const response = await fetch(`${url}/rest/v1/${source.table}?select=${source.select}&order=id`, {
      headers: { apikey: key, authorization: `Bearer ${token}`, range: `${from}-${from + 999}` },
    });
    if (!response.ok) {
      console.error(`${source.table}: ${response.status}`);
      break;
    }
    const rows = await response.json();
    for (const row of rows) {
      if (source.fields.some((field) => pattern.test(String(row[field] ?? "")))) {
        console.log(`${source.table.padEnd(26)} ${row.id}  ${source.label(row)}`);
        found += 1;
      }
    }
    if (rows.length < 1000) break;
  }
}
console.log(found ? `\n${found} record(s) found. Withdraw each one in the app, with a reason.` : "No test records found.");
