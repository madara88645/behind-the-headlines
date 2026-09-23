#!/usr/bin/env python3
"""
extract_survey.py - turn the Maynooth survey export into AGGREGATE statistics for the games.

Privacy by design:
  * Only counts per answer option (and cross-tab counts) are written. No row-level data.
  * Timestamp, e-mail, name, phone and free-text columns are dropped entirely.
  * Cross-tab cells with fewer than MIN_CELL respondents are suppressed (written as null).

Usage (stdlib only, no pip install needed):
  python3 tools/extract_survey.py ["path/to/Social Acceptance of Sustainable Data Centres in Ireland (Responses).xlsx"]

Writes:
  data/survey_stats.js    ->  window.SURVEY_STATS = {...}   (loaded by the games via <script>)
  data/survey_stats.json  ->  same content, for inspection
"""
import json
import re
import statistics
import sys
import zipfile
from collections import Counter
from datetime import date
from pathlib import Path
from xml.etree import ElementTree as ET

MIN_CELL = 3             # suppress cross-tab cells below this count
MAX_SINGLE_OPTIONS = 15  # more distinct answers than this -> multi-select or free text
MAX_MULTI_TOKENS = 30
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

DEFAULT_PATH = Path.home() / "Downloads" / "Social Acceptance of Sustainable Data Centres in Ireland (Responses).xlsx"
OUT_DIR = Path(__file__).resolve().parent.parent / "data"

PII_HEADER = re.compile(r"timestamp|e-?mail|\bname\b|phone|contact|address|eircode|signature|ip address", re.I)

# Questions used as the "by" side of cross-tabs (matched on question text).
CROSSTAB_BY = re.compile(
    r"age group|gender|county|local area|employment status|within 10 km|how aware were you|"
    r"aware that data centres exist|how much do you feel you know|enough information to form|"
    r"gut-level|current attitude|view on data centres changed|single factor|within 5 km|"
    r"AI tools|Social media platforms|already had a strong opinion|formed your view", re.I)

THEMES = {
    "electricity": r"electric|energy|power|grid|blackout|megawatt|\bmw\b|consum",
    "water": r"water|cooling",
    "environment": r"environment|carbon|emission|climate|green|sustainab|renewable|pollut",
    "economy": r"job|employ|econom|invest|tax|revenue|business|cost|price|bill|financ",
    "community": r"communit|local|neighbou?r|town|near|resident",
    "ai": r"\bai\b|artificial intelligence|chatgpt|machine learning",
    "information": r"source|inform|news|media|social media|newspaper|trust",
    "knowledge": r"know|aware|understand|familiar|enough|heard of",
    "support": r"support|oppose|accept|favou?r|should|allow|welcome|ban|restrict",
    "bias": r"heuristic|anchoring|social proof|herd|affect|fluency",
    "demographic": r"\bage group|gender|county|educat|employment status|local area",
}

# Known answer scales, lowest -> highest (used when labels carry no "(n)" suffix).
SCALES = [
    ["strongly disagree", "disagree", "neither", "agree", "strongly agree"],
    ["i had never heard of them", "i had heard the term but didn't know what they do",
     "i had a general idea of what they are", "i had a good understanding of how they operate",
     "i had detailed technical knowledge"],
    ["i was not aware", "i am still not sure", "i had some awareness", "yes, i was very aware"],
    ["nothing at all", "very little", "a moderate amount", "quite a lot", "a great deal"],
    ["very negative", "somewhat negative", "neutral / no strong feeling", "somewhat positive", "very positive"],
    ["completely unacceptable", "somewhat unacceptable", "neither acceptable nor unacceptable",
     "somewhat acceptable", "completely acceptable"],
    ["strongly opposed", "somewhat opposed", "neutral", "somewhat supportive", "strongly supportive"],
    ["become much more negative", "become somewhat more negative", "stayed the same",
     "become somewhat more positive", "become much more positive"],
    ["under 18", "18–24", "25–34", "35–44", "45–54", "55–64", "65 or over"],
    ["no", "i don't know", "yes"],
]
SUFFIX = re.compile(r"^(.*?)\s*\((\d+)\)\s*$")
TRUE_FALSE = {"1": "True", "0": "False"}


# ---------------------------------------------------------------- xlsx reading
def _colidx(ref):
    n = 0
    for ch in re.match(r"[A-Z]+", ref).group(0):
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_xlsx(path):
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.findall("m:si", NS):
            shared.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))
    sheet_name = sorted(n for n in z.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n))[0]
    sheet = ET.fromstring(z.read(sheet_name))
    rows = []
    for r in sheet.find("m:sheetData", NS).findall("m:row", NS):
        row = {}
        for c in r.findall("m:c", NS):
            t = c.get("t")
            v = c.find("m:v", NS)
            if t == "inlineStr":
                val = "".join(x.text or "" for x in c.iter("{%s}t" % NS["m"]))
            elif v is None:
                continue
            elif t == "s":
                val = shared[int(v.text)]
            else:
                val = v.text
            row[_colidx(c.get("r"))] = re.sub(r"\s+", " ", val).strip() if isinstance(val, str) else val
        rows.append(row)
    ncol = max((max(r.keys()) for r in rows if r), default=-1) + 1
    return [[r.get(i) for i in range(ncol)] for r in rows]


# ---------------------------------------------------------------- helpers
def to_number(s):
    try:
        return float(str(s).replace("%", "").replace(",", "").strip())
    except ValueError:
        return None


def themes_for(text):
    return [k for k, pat in THEMES.items() if re.search(pat, text or "", re.I)]


def split_group(text):
    """'Natural Capital [Data centres ...]' -> ('Natural Capital', 'Data centres ...')"""
    m = re.match(r"^(.*?)\s*\[(.+)\]\s*$", text)
    return (m.group(1).strip(), m.group(2).strip()) if m else (None, None)


def order_labels(labels):
    """Return (ordered_labels, values) if the labels form an ordinal scale, else None."""
    m = [SUFFIX.match(l) for l in labels]
    if all(m):
        pairs = sorted(zip(labels, (int(x.group(2)) for x in m)), key=lambda p: p[1])
        return [p[0] for p in pairs], [p[1] for p in pairs]
    low = [l.lower().strip() for l in labels]
    for scale in SCALES:
        if sum(1 for l in low if l in scale) >= max(2, len(low) - 1):
            order = {v: i + 1 for i, v in enumerate(scale)}  # 1-based, like the "(n)" scales
            ordered = sorted(labels, key=lambda l: order.get(l.lower().strip(), 99))
            return ordered, [order.get(l.lower().strip(), None) for l in ordered]
    return None


def split_multi(value):
    """Split a Google-Forms checkbox answer on ', ' - but not inside brackets, and only when the
    next option starts with a capital letter or digit (options such as 'Friends, family or colleagues'
    and 'Subject to independent, publicly reported ...' stay whole)."""
    parts, buf, depth, i = [], "", 0, 0
    while i < len(value):
        ch = value[i]
        depth += ch == "("
        depth -= ch == ")"
        if value.startswith(", ", i) and depth == 0 and i + 2 < len(value) and (
                value[i + 2].isupper() or value[i + 2].isdigit()):
            parts.append(buf.strip())
            buf, i = "", i + 2
            continue
        buf += ch
        i += 1
    if buf.strip():
        parts.append(buf.strip())
    return parts


def classify(values):
    distinct = Counter(values)
    nums = [to_number(v) for v in values]
    if all(n is not None for n in nums):
        uniq = set(nums)
        if len(uniq) <= 11 and all(float(n).is_integer() for n in uniq):
            return "scale_numeric"
        return "numeric"
    if set(distinct) <= {"1", "0", "Don't Know", "Don't know", "Not sure"}:
        return "truefalse"
    if len(distinct) <= MAX_SINGLE_OPTIONS:
        return "single"
    if any(", " in v for v in values):
        tokens = Counter(t for v in values for t in split_multi(v))
        recurring = [t for t, c in tokens.items() if c >= 2]
        if len(recurring) <= MAX_MULTI_TOKENS and sum(tokens[t] for t in recurring) >= 0.8 * sum(tokens.values()):
            return "multi"
    return "free_text"


def pct(c, n):
    return round(100.0 * c / n, 1) if n else 0.0


# ---------------------------------------------------------------- main
def main():
    path = Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else DEFAULT_PATH
    rows = read_xlsx(path)
    header, data = rows[0], rows[1:]
    data = [r for r in data if any(v not in (None, "") for v in r)]
    n = len(data)

    questions, dropped, answers = [], [], {}
    for ci, raw_text in enumerate(header):
        text = (raw_text or f"Column {ci + 1}").strip()
        if PII_HEADER.search(text):
            dropped.append({"column": text, "reason": "identifying / timestamp"})
            continue
        cells = {ri: str(r[ci]).strip() for ri, r in enumerate(data) if r[ci] not in (None, "")}
        if not cells:
            dropped.append({"column": text, "reason": "empty"})
            continue
        kind = classify(list(cells.values()))
        if kind == "free_text":
            dropped.append({"column": text, "reason": "free text (not aggregated)"})
            continue

        group, item = split_group(text)
        q = {"id": f"q{len(questions) + 1}", "text": text, "group": group, "item": item,
             "kind": kind, "themes": themes_for(text), "n_answered": len(cells)}
        per_row = {}
        if kind == "truefalse":
            cells = {ri: TRUE_FALSE.get(v, "Don't know") for ri, v in cells.items()}
            counts = Counter(cells.values())
            labels = [l for l in ("True", "False", "Don't know") if l in counts]
            q["options"] = [{"label": l, "count": counts[l], "pct": pct(counts[l], len(cells))} for l in labels]
            q["ordered"] = False
            per_row = {ri: [v] for ri, v in cells.items()}
        elif kind in ("single", "scale_numeric"):
            counts = Counter(cells.values())
            labels = list(counts)
            ordered = None
            if kind == "scale_numeric":
                labels.sort(key=lambda s: to_number(s))
                ordered = (labels, [int(to_number(l)) for l in labels])
                q["note"] = "Numeric 1-N answers; the direction of the scale is not stated in the export."
            else:
                ordered = order_labels(labels)
            if ordered:
                labels, values = ordered
                q["ordered"] = True
            else:
                labels.sort(key=lambda s: -counts[s])
                values = [None] * len(labels)
                q["ordered"] = False
            q["options"] = []
            for l, v in zip(labels, values):
                m = SUFFIX.match(l)
                q["options"].append({"label": l, "short": m.group(1) if m else l, "value": v,
                                     "count": counts[l], "pct": pct(counts[l], len(cells))})
            if q["ordered"]:
                vals = [values[labels.index(v)] for v in cells.values() if values[labels.index(v)] is not None]
                if vals:
                    q["mean"] = round(statistics.fmean(vals), 2)
            per_row = {ri: [v] for ri, v in cells.items()}
        elif kind == "multi":
            tok = Counter()
            for ri, v in cells.items():
                parts = split_multi(v)
                per_row[ri] = parts
                tok.update(set(parts))
            keep = [t for t, c in tok.most_common() if c >= 2]
            other = sum(1 for ps in per_row.values() if any(p not in keep for p in ps))
            q["options"] = [{"label": t, "count": tok[t], "pct": pct(tok[t], len(cells))} for t in keep]
            if other:
                q["options"].append({"label": "Something else (written in)", "count": other,
                                     "pct": pct(other, len(cells))})
            q["ordered"] = False
            q["note"] = "Multiple answers allowed: percentages are of respondents and can sum to more than 100."
            per_row = {ri: [p for p in ps if p in keep] for ri, ps in per_row.items()}
        elif kind == "numeric":
            nums = sorted(to_number(v) for v in cells.values())
            qs = statistics.quantiles(nums, n=4) if len(nums) >= 4 else [nums[0], statistics.median(nums), nums[-1]]
            q["summary"] = {"mean": round(statistics.fmean(nums), 2), "median": statistics.median(nums),
                            "p25": qs[0], "p75": qs[-1], "min": nums[0], "max": nums[-1]}
            lo, hi = nums[0], nums[-1]
            width = (hi - lo) / 10 or 1
            bins = Counter(min(9, int((x - lo) / width)) for x in nums)
            q["histogram"] = [{"from": round(lo + i * width, 2), "to": round(lo + (i + 1) * width, 2),
                               "count": bins.get(i, 0)} for i in range(10)]
        questions.append(q)
        answers[q["id"]] = per_row

    # Cross-tabs: curated "by" questions x every other categorical question.
    crosstabs = []
    by_qs = [q for q in questions if "options" in q and CROSSTAB_BY.search(q["text"]) and len(q["options"]) <= 10]
    of_qs = [q for q in questions if "options" in q and len(q["options"]) <= 15]
    for a in by_qs:
        for b in of_qs:
            if a["id"] == b["id"]:
                continue
            a_labels = [o["label"] for o in a["options"]]
            b_labels = [o["label"] for o in b["options"]]
            group_n, table = [], []
            for al in a_labels:
                group = [ri for ri, v in answers[a["id"]].items() if al in v and ri in answers[b["id"]]]
                gn = len(group)
                ok = gn >= MIN_CELL
                group_n.append(gn if ok else None)
                row = []
                for bl in b_labels:
                    c = sum(1 for ri in group if bl in answers[b["id"]][ri])
                    row.append(c if ok and c >= MIN_CELL else (0 if ok and c == 0 else None))
                table.append(row)
            crosstabs.append({"by": a["id"], "of": b["id"], "group_n": group_n, "counts": table})

    out = {
        "meta": {
            "title": "Social Acceptance of Sustainable Data Centres in Ireland",
            "source": "Maynooth University survey of people in Ireland (supplied for the BU Induction Hack 2026)",
            "respondents": n,
            "generated": date.today().isoformat(),
            "demo": False,
            "min_cell": MIN_CELL,
            "crosstab_note": "counts[i][j] = respondents in by-option i who chose of-option j; null = suppressed "
                             "(fewer than min_cell people); labels follow each question's options order.",
            "dropped_columns": dropped,
        },
        "questions": questions,
        "crosstabs": crosstabs,
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "survey_stats.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    compact = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    (OUT_DIR / "survey_stats.js").write_text(
        "// Generated by tools/extract_survey.py - aggregate counts only, no individual responses.\n"
        "window.SURVEY_STATS = " + compact + ";\n", encoding="utf-8")

    print(f"Respondents: {n}")
    print(f"Questions kept: {len(questions)} | dropped: {len(dropped)} | cross-tabs: {len(crosstabs)}")
    for q in questions:
        opts = " | ".join(f"{o.get('short', o['label'])} {o['pct']}%" for o in q.get("options", []))
        print(f"  {q['id']:>4} [{q['kind']:<13}] {q['text'][:80]}\n        {opts[:220]}")
    for d in dropped:
        print(f"  dropped: {d['column'][:70]}  ({d['reason']})")
    print(f"Wrote {OUT_DIR / 'survey_stats.js'} ({(OUT_DIR / 'survey_stats.js').stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
