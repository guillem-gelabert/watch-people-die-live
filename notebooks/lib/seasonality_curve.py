"""Re-export shim: the canonical curve math moved to `pipeline/curve.py` so the
retrieval pipeline and this notebook fold curves identically -- no drift. Kept here so
`seasonality.ipynb`'s existing `sys.path.insert(notebooks/lib); from seasonality_curve
import ...` keeps working unchanged.
"""

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from pipeline.curve import (  # noqa: E402,F401
    COVID_YEARS,
    HARMONIC_ORDER,
    MONTH_PHASES,
    country_curve,
    country_curve_records,
    cov_pct,
    harmonic_design,
    rate_curve,
    rate_curve_records,
    winter_amp,
)
