#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Benign functional fixture for Payload Obfuscator."""

from __future__ import annotations

import asyncio
import json
import sys
from dataclasses import dataclass


@dataclass
class Report:
    name: str
    total: int
    status: str = "OK"


def build_report(name: str, count: int = 7) -> tuple[Report, list[int]]:
    even_squares = [number**2 for number in range(1, count + 1) if number % 2 == 0]
    total = sum(even_squares)

    match total:
        case value if value >= 50:
            status = "LARGE"
        case 0:
            status = "EMPTY"
        case _:
            status = "SMALL"

    return Report(name=name, total=total, status=status), even_squares


async def async_label(name: str, count: int) -> str:
    await asyncio.sleep(0)
    return f"{name.upper()}:{count}"


def main() -> None:
    name = sys.argv[1] if len(sys.argv) > 1 else "Ilias"

    try:
        count = int(sys.argv[2]) if len(sys.argv) > 2 else 7
    except ValueError:
        count = 7

    report, squares = build_report(name=name, count=count)
    compact_json = json.dumps(
        {"name": report.name, "total": report.total, "status": report.status},
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )

    print(f"Name={report.name}")
    print(f"Squares={','.join(str(value) for value in squares)}")
    print(compact_json)
    print(f"Average={report.total / count:.2f}")
    print(f"Async={asyncio.run(async_label(name, count))}")
    print("Unicode=Γειά σου 👋")


if __name__ == "__main__":
    main()
