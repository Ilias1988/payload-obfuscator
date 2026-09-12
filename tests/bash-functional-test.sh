#!/usr/bin/env bash
set -euo pipefail

name=${1:-Ilias}
count=${2:-7}
even_squares=()
total=0

for ((number = 1; number <= count; number++)); do
    if ((number % 2 == 0)); then
        square=$((number * number))
        even_squares+=("$square")
        total=$((total + square))
    fi
done

case "$total" in
    0) status="EMPTY" ;;
    56) status="LARGE" ;;
    *) status="OTHER" ;;
esac

upper_name=$(printf '%s' "$name" | tr '[:lower:]' '[:upper:]')
joined=$(IFS=,; printf '%s' "${even_squares[*]}")

summary=$(cat <<EOF
Name=$name
Status=$status
EOF
)
summary=${summary//$'\n'/;}

printf 'Name=%s\n' "$name"
printf 'EvenSquares=%s\n' "$joined"
printf 'Total=%d\n' "$total"
printf 'Status=%s\n' "$status"
printf 'Upper=%s\n' "$upper_name"
printf 'Summary=%s\n' "$summary"
printf 'Unicode=Γειά σου 👋\n'
