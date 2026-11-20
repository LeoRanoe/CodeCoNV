/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image has no HTML alt prop. */
import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { SignoffHistoryEntry } from "@/lib/forms/signoff";

const styles = StyleSheet.create({
  wrap: { marginTop: 6 },
  title: { fontSize: 8, fontWeight: 700, marginBottom: 3 },
  entry: { borderLeftColor: "#c9cfd4", borderLeftWidth: 1, marginBottom: 3, paddingLeft: 5 },
  line: { fontSize: 7.5 },
  comments: { color: "#5a646c", fontSize: 7.5 },
  ink: { height: 20, marginTop: 1, objectFit: "contain", width: 90 },
});

/**
 * The chronological sign-off history of a record (Sign-off Workflow sheet: "Allow authorized
 * users to export the history with the form record"), for every PDF that prints the record.
 */
export function SignoffHistoryPdf({ history, title = "Sign-off history" }: { history: SignoffHistoryEntry[]; title?: string }) {
  if (!history.length) return null;
  return (
    <View style={styles.wrap} wrap={false}>
      <Text style={styles.title}>{title}</Text>
      {history.map((entry, index) => (
        <View style={styles.entry} key={`${entry.line}:${index}`}>
          <Text style={styles.line}>{entry.line}</Text>
          {entry.comments ? <Text style={styles.comments}>{entry.comments}</Text> : null}
          {entry.signature ? <Image src={entry.signature} style={styles.ink} /> : null}
        </View>
      ))}
    </View>
  );
}
