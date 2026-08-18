"""Agent contract + base class.

Every ETL stage is an "agent": a small, single-purpose unit with an explicit
contract (what it consumes, what it guarantees) and a uniform execution
wrapper that times the stage, captures failures and records the artifact it
produced. The orchestrator (cli.py) only ever talks to this interface, which
is what makes the stages independently testable and reorderable.

    ExtractAgent -> StandardizeAgent -> LoadAgent -> FeedAgent
        raw            CDIRecord[]        master.csv     alerts
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class StageResult:
    """Uniform report returned by every agent."""

    stage: str
    ok: bool
    records: int = 0
    errors: list[str] = field(default_factory=list)
    duration_s: float = 0.0
    artifact: str | None = None  # path or identifier of what was produced

    def raise_if_failed(self) -> None:
        if not self.ok:
            raise RuntimeError(f"[{self.stage}] failed: {'; '.join(self.errors)}")


@dataclass
class PipelineContext:
    """Mutable hand-off object threaded through the agents.

    ``artifacts`` lets a downstream agent consume exactly what an upstream
    agent produced, without agents importing each other.
    """

    run_id: str
    artifacts: dict[str, Any] = field(default_factory=dict)
    log: list[str] = field(default_factory=list)

    def say(self, message: str) -> None:
        self.log.append(f"[{self.run_id}] {message}")


class BaseAgent(ABC):
    """Template-method base class.

    Subclasses implement :meth:`run`. They should NOT override :meth:`execute`
    — that is the shared wrapper that enforces timing, error capture and a
    consistent StageResult, and it is the seam the tests assert against.
    """

    #: short machine name, e.g. "extract"
    name: str = "agent"

    #: what this agent consumes (from PipelineContext.artifacts)
    consumes: tuple[str, ...] = ()

    #: the artifact key this agent publishes
    produces: str = ""

    def execute(self, ctx: PipelineContext) -> StageResult:
        start = time.perf_counter()
        try:
            self._check_inputs(ctx)
            result = self.run(ctx)
            result.duration_s = round(time.perf_counter() - start, 3)
            if self.produces and result.artifact:
                ctx.artifacts[self.produces] = result.artifact
            ctx.say(f"{self.name}: {'ok' if result.ok else 'FAILED'} "
                    f"({result.records} records, {result.duration_s}s)")
            return result
        except Exception as exc:  # noqa: BLE001 — intentional boundary catch
            return StageResult(
                stage=self.name,
                ok=False,
                errors=[str(exc)],
                duration_s=round(time.perf_counter() - start, 3),
            )

    def _check_inputs(self, ctx: PipelineContext) -> None:
        missing = [key for key in self.consumes if key not in ctx.artifacts]
        if missing:
            raise KeyError(
                f"{self.name} requires upstream artifacts {missing}; "
                f"got {sorted(ctx.artifacts)}"
            )

    @abstractmethod
    def run(self, ctx: PipelineContext) -> StageResult:
        """Stage-specific work. Must return a StageResult, never raise for
        expected data problems — raise only for unexpected failures."""
