"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { specFacts, type SpecValues } from "@/lib/forms/spec-forms";
import { specLabel } from "@/lib/forms/spec-labels-nl";
import { useLanguage } from "@/lib/i18n";
import { loadSharedLessons } from "@/lib/supabase/operations";

/**
 * Lessons Learned sheet: a lesson "Approved for Sharing" is available across projects. This is
 * the organisation's list of them, read-only, newest first; this project's own lessons are in
 * the list above.
 */
export function SharedLessons({ client, organizationId, projectId }: { client: SupabaseClient; organizationId: string; projectId: string }) {
  const { language, text } = useLanguage();
  const query = useQuery({
    queryKey: ["shared-lessons", organizationId],
    queryFn: () => loadSharedLessons(client, organizationId),
    enabled: Boolean(organizationId),
    staleTime: 5 * 60_000,
  });
  const lessons = (query.data ?? []).filter((lesson) => lesson.project_id !== projectId);
  return (
    <section className="record-section shared-lessons" aria-labelledby="shared-lessons-title">
      <h3 id="shared-lessons-title">{text("Lessons shared by other projects", "Lessen gedeeld door andere projecten")}</h3>
      {query.isLoading ? <p className="form-helper">{text("Loading…", "Laden…")}</p> : null}
      {!query.isLoading && !lessons.length ? <p className="form-helper">{text("No lessons from other projects are approved for sharing yet.", "Nog geen lessen van andere projecten goedgekeurd voor delen.")}</p> : null}
      {lessons.length ? (
        <ul className="shared-lesson-list">
          {lessons.map((lesson) => {
            const details = lesson.details ?? {};
            const facts = specFacts("lessons_learned", (details.spec ?? {}) as SpecValues, language, { translate: (value) => specLabel(value, language) })
              .filter(([label]) => !/reviewed by|beoordeeld door/i.test(label));
            const answer = (key: string) => (typeof details[key] === "string" ? String(details[key]) : "");
            return (
              <li key={lesson.entry_id}>
                <span className="record-number">{lesson.project_code} · {lesson.entry_number}</span>
                <strong>{lesson.title}</strong>
                <small>{lesson.project_name} · {lesson.occurred_at.slice(0, 10)}</small>
                {answer("issue") || answer("solution_improvement") ? <p>{[answer("issue"), answer("cause"), answer("solution_improvement"), answer("expected_results")].filter(Boolean).join(" → ")}</p> : null}
                {facts.length ? <dl className="record-spec-facts">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
