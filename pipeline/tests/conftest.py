"""Make the src/ layout importable without an editable install.

Running ``pytest`` from the ``pipeline/`` directory is enough — this hook puts
``src`` on sys.path so ``import bwdas`` resolves. Keeps the TDD loop to:

    cd pipeline && pytest
"""

import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))
