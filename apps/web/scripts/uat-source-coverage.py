"""Generate a UAT source register, or check a completed copy for coverage gaps."""

import argparse
import csv
import hashlib
import re
from collections import Counter
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile

AUDIT = Path(__file__).resolve().parents[3] / "docs/operations/client-spec-audit"
REGISTER = AUDIT / "UAT-SOURCE-REGISTER.csv"
DESKTOP = Path.home() / "Desktop"
EXCEL = "Construction_Project_App_Developer_Specification_FINAL_v2.xlsx"
WORD = "CODECO_Supervision_App_Developer_Requirements_Menu_and_Contractor_Portal.docx"
FIELDS = ("id", "source", "reference", "source_text", "status", "observed", "evidence")
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def entry(identifier, source, reference, description):
    return dict(zip(FIELDS, (identifier, source, reference, description, "", "", "")))


def compact(value):
    return re.sub(r"\s+", " ", str(value)).strip()


def workbook_rows(path):
    from openpyxl import load_workbook
    from openpyxl.utils import get_column_letter

    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        for index, sheet in enumerate(workbook, 1):
            for number, values in enumerate(sheet.values, 1):
                cells = [f"{get_column_letter(column)}: {compact(value)}" for column, value in enumerate(values, 1)
                         if value is not None and compact(value)]
                if cells:
                    yield entry(f"XL-{index:02}-{number:03}", "Excel", f"{sheet.title}!{number}", " | ".join(cells))
    finally:
        workbook.close()


def word_rows(path):
    with ZipFile(path) as archive:
        body = ET.fromstring(archive.read("word/document.xml")).find("w:body", NS)

    def content(element):
        paragraphs = [element] if element.tag.endswith("}p") else element.findall(".//w:p", NS)
        return " / ".join(text for paragraph in paragraphs if
                          (text := compact("".join(node.text or "" for node in paragraph.findall(".//w:t", NS)))))

    section = "Front matter"
    for index, block in enumerate(body, 1):
        if block.tag.endswith("}p"):
            text = content(block)
            if re.match(r"^(?:\d{1,2}\. |\d{1,2}\.\d+ |Appendix [AB]\b)", text):
                section = text
            if text:
                yield entry(f"WD-{index:03}", "Word", f"{section} · paragraph block {index}", text)
        elif block.tag.endswith("}tbl"):
            for line, row in enumerate(block.findall("w:tr", NS), 1):
                text = " | ".join(content(cell) for cell in row.findall("w:tc", NS))
                if text.strip(" |"):
                    yield entry(f"WD-{index:03}-{line:02}", "Word", f"{section} · table block {index}, row {line}", text)


def mind_map_rows():
    areas = re.findall(r"^\| (\d+)\. ([^|]+) \| ([^|]+) \|", (AUDIT / "APPLICATION.md").read_text(encoding="utf-8"), re.M)
    if [int(number) for number, _, _ in areas] != list(range(1, 11)):
        raise ValueError("Expected the ten transcribed areas of the original mind map.")
    for number, area, children in areas:
        group = int(number)
        yield entry(f"MAP-{group:02}-00", "Mind map", f"Area {group}", area)
        for index, name in enumerate(children.split(", "), 1):
            yield entry(f"MAP-{group:02}-{index:02}", "Mind map", f"Area {group} · {area}", name)
    roles = {
        "Supervisor": "Create, assign, review, verify and report on supervision records.",
        "Contractor": "View assigned items, respond, complete actions and upload evidence.",
        "Client": "View published reports, shared documents, progress and photos, and act on assigned reviews.",
        "Admin": "Manage users, rights, projects, workflows, document settings and configuration.",
    }
    for index, (role, text) in enumerate(roles.items(), 1):
        yield entry(f"MAP-ROLE-{index:02}", "Mind map", f"Roles and access · {role}", text)
    for index, text in enumerate(("Supervisor creates the record", "Assign to contractor or publish to client as applicable",
                                  "Contractor responds, submits corrective action and uploads evidence",
                                  "Supervisor reviews and verifies, approves or returns for correction",
                                  "Report and archive records, photos and history"), 1):
        yield entry(f"MAP-FLOW-{index:02}", "Mind map", f"Main workflow · step {index}", text)


def read_register(path):
    with path.open(encoding="utf-8-sig", newline="") as stream:
        rows = list(csv.DictReader(stream))
    if any(None in row or set(row) != set(FIELDS) for row in rows) or len({row["id"] for row in rows}) != len(rows):
        raise ValueError(f"Invalid columns or duplicate IDs in {path}")
    return {row["id"]: row for row in rows}


def reference_only(row):
    text = row["source_text"]
    location = row["reference"]
    if row["source"] == "Excel":
        return location.endswith("!1") or text.startswith(("A: Order | B: Field label", "A: FORM-SPECIFIC IMPLEMENTATION NOTE"))
    if row["source"] == "Word":
        section = location.split(" · ", 1)[0]
        return (text == section or text == "END OF FUNCTIONAL REQUIREMENTS" or section.startswith("Appendix A")
                or ("table block" in location and location.endswith(", row 1"))
                or row["id"] in {"WD-001", "WD-002", "WD-003", "WD-004", "WD-005-02", "WD-005-03", "WD-005-04", "WD-005-05"})
    return False


def check_results(results):
    baseline = read_register(REGISTER)
    actual = read_register(results)
    errors = [f"Missing {key}" for key in sorted(baseline.keys() - actual.keys())]
    errors.extend(f"Unexpected {key}" for key in sorted(actual.keys() - baseline.keys()))
    counts = Counter()
    for key in sorted(baseline.keys() & actual.keys()):
        row = actual[key]
        status = row["status"].strip()
        counts[row["source"], status or "blank"] += 1
        if any(row[field] != baseline[key][field] for field in FIELDS[:4]):
            errors.append(f"{key}: source fields changed")
        if status not in {"Pass", "Fail", "Blocked", "Not run", "Reference"} or not row["observed"].strip():
            errors.append(f"{key}: add an allowed status and an observation or reason")
        elif status in {"Pass", "Fail"} and not row["evidence"].strip():
            errors.append(f"{key}: missing verification evidence")
        elif status == "Reference" and (not reference_only(baseline[key]) or not row["evidence"].strip()):
            errors.append(f"{key}: Reference needs a source heading, glossary entry or cover item and an explanation")
    for (source, status), count in sorted(counts.items()):
        print(f"{source} · {status}: {count}")
    for issue in errors[:25]:
        print(issue)
    unverified = sum(count for (_, status), count in counts.items() if status in {"Fail", "Blocked", "Not run"})
    print(f"{len(errors)} coverage errors. {unverified} rows report Fail, Blocked or Not run.")
    return bool(errors or unverified)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--xlsx", type=Path, default=DESKTOP / EXCEL)
    parser.add_argument("--docx", type=Path, default=DESKTOP / WORD)
    parser.add_argument("--output", type=Path, default=REGISTER)
    parser.add_argument("--check-results", type=Path)
    args = parser.parse_args()
    if args.check_results:
        return check_results(args.check_results)

    rows = [*mind_map_rows(), *workbook_rows(args.xlsx), *word_rows(args.docx)]
    with args.output.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=FIELDS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(dict(Counter(row["source"] for row in rows)))
    for path in (args.xlsx, args.docx):
        print(f"{path.name}: SHA-256 {hashlib.sha256(path.read_bytes()).hexdigest()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
