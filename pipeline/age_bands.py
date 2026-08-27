"""The nine age bands the persona pipeline samples in.

MUST match BANDS in scripts/build-causes.ts and scripts/build-mortality.ts, and AGE_BANDS in
app/globe/persona.ts. Sources whose raw files carry an exact age (Brazilian and Mexican
microdata) fold onto these directly; sources published in coarser groups (StatCan) declare
their own bands instead, which is why AgeSexRow carries a per-source `bands` array.
"""

from __future__ import annotations

BANDS: tuple[tuple[int, int], ...] = (
    (0, 0),
    (1, 4),
    (5, 14),
    (15, 29),
    (30, 49),
    (50, 64),
    (65, 74),
    (75, 84),
    (85, 200),
)


def band_of(age_years: int) -> int | None:
    """Band index for an exact age in years, or None if the age is out of range."""
    if age_years < 0:
        return None
    for i, (lo, hi) in enumerate(BANDS):
        if lo <= age_years <= hi:
            return i
    return None


# ICD-10 chapter for a 3-character code, so cause-bearing sources can emit a bounded cause
# dimension (21 chapters) rather than ~1,500 individual codes.
_CHAPTERS: tuple[tuple[str, str, str], ...] = (
    ("A00", "B99", "I"), ("C00", "D48", "II"), ("D50", "D89", "III"), ("E00", "E90", "IV"),
    ("F00", "F99", "V"), ("G00", "G99", "VI"), ("H00", "H59", "VII"), ("H60", "H95", "VIII"),
    ("I00", "I99", "IX"), ("J00", "J99", "X"), ("K00", "K93", "XI"), ("L00", "L99", "XII"),
    ("M00", "M99", "XIII"), ("N00", "N99", "XIV"), ("O00", "O99", "XV"), ("P00", "P96", "XVI"),
    ("Q00", "Q99", "XVII"), ("R00", "R99", "XVIII"), ("S00", "T98", "XIX"), ("V01", "Y98", "XX"),
    ("Z00", "Z99", "XXI"),
)


def icd_chapter(code: str | None) -> str | None:
    """ICD-10 chapter numeral for a code like "I120", or None if it does not resolve."""
    if not code:
        return None
    c = code.strip().upper()[:3]
    if len(c) < 3 or not c[0].isalpha() or not c[1:].isdigit():
        return None
    for lo, hi, chapter in _CHAPTERS:
        if lo <= c <= hi:
            return chapter
    return None


# A pair of causes.json labels specific enough to give real seasonal signal beyond their ICD-10
# chapter, which otherwise bundles them with unrelated external causes (falls, suicide, violence,
# road injuries) that do not share the same summer shift. Ranges are the standard ICD-10
# external-cause-of-injury sub-blocks (W65-W74 accidental drowning, X30-X39 exposure to forces of
# nature, of which X30 is excessive natural heat) -- not project-specific, so hardcoding them
# carries no more risk than the chapter ranges above. Used only by 04-07's cause x month tensor.
_LEAF_GROUPS: tuple[tuple[str, str, str], ...] = (
    ("W65", "W74", "drowning"),
    ("X30", "X39", "exposure to forces of nature"),
)


def leaf_cause_group(code: str | None) -> str | None:
    """causes.json leaf label for a code inside one of the ranges above, else None.

    Not mutually exclusive with icd_chapter(): a drowning death is chapter XX *and*
    leaf group "drowning" -- both are measured so a consumer can prefer the more specific
    one where it exists and fall back to the chapter otherwise.
    """
    if not code:
        return None
    c = code.strip().upper()[:3]
    if len(c) < 3:
        return None
    for lo, hi, label in _LEAF_GROUPS:
        if lo <= c <= hi:
            return label
    return None
