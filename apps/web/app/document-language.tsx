/**
 * The root layout is shared with the English marketing site, so it declares lang="en".
 * Supervisie defaults to Dutch and remembers the language picked in its switcher; this sets
 * the document language before the first paint, so a screen reader does not read Dutch with
 * an English voice until React has hydrated. LanguageProvider keeps it in sync afterwards.
 */
export function DocumentLanguage({ fixed }: { fixed?: "en" | "nl" }) {
  const script = fixed
    ? `document.documentElement.lang=${JSON.stringify(fixed)};`
    : "try{var l=localStorage.getItem('codeco-language-choice');document.documentElement.lang=l==='en'?'en':'nl';}catch(e){document.documentElement.lang='nl';}";
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
