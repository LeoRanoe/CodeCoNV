import { readFile } from "node:fs/promises";
import { createClient } from "../apps/web/node_modules/@supabase/supabase-js/dist/index.mjs";

const envText = await readFile(new URL("../apps/web/.env", import.meta.url), "utf8");
const env = Object.fromEntries(
  envText.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator), line.slice(separator + 1)];
  }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const project = await admin.from("projects").select("id,organization_id,name").eq("name", "Paramaribo Field Readiness Demo").order("created_at", { ascending: false }).limit(1).single();
if (project.error) throw project.error;
const [findings, files, captures, links] = await Promise.all([
  admin.from("findings").select("id,finding_number,title,status,created_at").eq("project_id", project.data.id).order("created_at", { ascending: false }),
  admin.from("files").select("id,original_name,status,category,created_at").eq("project_id", project.data.id).order("created_at", { ascending: false }),
  admin.from("visual_captures").select("id,file_id,title,capture_type,created_at").eq("project_id", project.data.id).order("created_at", { ascending: false }),
  admin.from("file_links").select("id,file_id,record_type,record_id,relationship,created_at").eq("project_id", project.data.id).order("created_at", { ascending: false }),
]);
for (const result of [findings, files, captures, links]) if (result.error) throw result.error;
process.stdout.write(JSON.stringify({
  project: project.data,
  findings: findings.data,
  files: files.data?.slice(0, 20),
  captures: captures.data,
  links: links.data?.slice(0, 20),
}, null, 2));
