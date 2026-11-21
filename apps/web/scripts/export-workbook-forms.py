import json, re, sys
import openpyxl

# usage: python scripts/export-workbook-forms.py <workbook.xlsx> <out.json>
wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
forms = {
    'Photos': 'photo', 'Works Ongoing': 'works_ongoing', 'Works Completed': 'works_completed',
    'Project Delay Report': 'delay_report', 'Issue': 'issue', 'HSE': 'hse', 'Materials Delivery': 'delivery',
    'Technical Instructions': 'technical_instruction', 'Change Order': 'change_order', 'NCR': 'ncr',
    'Lessons Learned': 'lessons_learned', 'Agreements Made': 'agreement', 'HSE Incident Registration': 'hse_incident',
}
out = {}
for sheet, key in forms.items():
    ws = wb[sheet]
    rows = []
    for i, r in enumerate(ws.iter_rows(values_only=True), 1):
        if r and r[0] is not None and str(r[0]).strip().isdigit() and r[1]:
            rows.append({
                'excel_row': i, 'order': int(str(r[0]).strip()), 'label': str(r[1]).strip(), 'control': str(r[2] or '').strip(),
                'required': str(r[3] or '').strip(), 'values': str(r[4] or ''), 'visibility': str(r[6] or '').strip(),
            })
    out[key] = rows
json.dump(out, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print({k: len(v) for k, v in out.items()}, sum(len(v) for v in out.values()))
