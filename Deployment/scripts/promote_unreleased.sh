#!/usr/bin/env bash
# Promote Keep-a-Changelog Unreleased notes into a dated release section.

set -euo pipefail

usage() {
    echo "Usage: promote_unreleased.sh --changelog CHANGELOG.md --version VERSION [--date YYYY-MM-DD]" >&2
}

CHANGELOG=""
VERSION=""
RELEASE_DATE="$(date +%F)"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --changelog)
            CHANGELOG="${2:-}"
            shift 2
            ;;
        --version)
            VERSION="${2:-}"
            shift 2
            ;;
        --date)
            RELEASE_DATE="${2:-}"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            usage
            exit 2
            ;;
    esac
done

if [[ -z "$CHANGELOG" || -z "$VERSION" || -z "$RELEASE_DATE" ]]; then
    usage
    exit 2
fi

if [[ ! -f "$CHANGELOG" ]]; then
    echo "error: CHANGELOG.md not found: $CHANGELOG" >&2
    exit 1
fi

mapfile -t LINES < "$CHANGELOG"

UNRELEASED_INDEX=-1
TARGET_INDEX=-1
SECTION_INDEXES=()

for index in "${!LINES[@]}"; do
    line="${LINES[$index]}"
    if [[ "$line" =~ ^##\ \[([^]]+)\] ]]; then
        SECTION_INDEXES+=("$index")
        section="${BASH_REMATCH[1]}"
        if [[ "$section" == "Unreleased" ]]; then
            UNRELEASED_INDEX="$index"
        elif [[ "$section" == "$VERSION" ]]; then
            TARGET_INDEX="$index"
        fi
    fi
done

if [[ "$UNRELEASED_INDEX" -lt 0 ]]; then
    echo "error: CHANGELOG.md does not contain an [Unreleased] section" >&2
    exit 1
fi

next_section_after() {
    local start_index="$1"
    local fallback="${#LINES[@]}"
    local section_index
    for section_index in "${SECTION_INDEXES[@]}"; do
        if [[ "$section_index" -gt "$start_index" ]]; then
            echo "$section_index"
            return
        fi
    done
    echo "$fallback"
}

trimmed_range() {
    local start="$1"
    local end="$2"

    while [[ "$start" -lt "$end" && "${LINES[$start]}" =~ ^[[:space:]]*$ ]]; do
        start=$((start + 1))
    done
    while [[ "$end" -gt "$start" && "${LINES[$((end - 1))]}" =~ ^[[:space:]]*$ ]]; do
        end=$((end - 1))
    done

    local index
    for ((index = start; index < end; index++)); do
        printf '%s\n' "${LINES[$index]}"
    done
}

contains_bullet() {
    local body="$1"
    grep -Eq '^[[:space:]]*[-*][[:space:]]+[^[:space:]]' <<< "$body"
}

UNRELEASED_NEXT="$(next_section_after "$UNRELEASED_INDEX")"
UNRELEASED_BODY="$(trimmed_range "$((UNRELEASED_INDEX + 1))" "$UNRELEASED_NEXT")"

if [[ -z "$UNRELEASED_BODY" ]]; then
    if [[ "$TARGET_INDEX" -ge 0 ]]; then
        echo "CHANGELOG.md already has release section for $VERSION"
        exit 0
    fi
    echo "error: CHANGELOG.md [Unreleased] section is empty" >&2
    exit 1
fi

if ! contains_bullet "$UNRELEASED_BODY"; then
    echo "error: CHANGELOG.md [Unreleased] section has no release-note bullets" >&2
    exit 1
fi

if [[ "$TARGET_INDEX" -ge 0 ]]; then
    TARGET_NEXT="$(next_section_after "$TARGET_INDEX")"
    TARGET_BODY="$(trimmed_range "$((TARGET_INDEX + 1))" "$TARGET_NEXT")"
    if [[ "$TARGET_BODY" != "$UNRELEASED_BODY" ]]; then
        echo "error: CHANGELOG.md already contains a release section for $VERSION" >&2
        exit 1
    fi
fi

TMP_FILE="$(mktemp "${CHANGELOG}.tmp.XXXXXX")"
cleanup() {
    rm -f "$TMP_FILE"
}
trap cleanup EXIT

{
    for ((index = 0; index <= UNRELEASED_INDEX; index++)); do
        printf '%s\n' "${LINES[$index]}"
    done
    printf '\n'

    if [[ "$TARGET_INDEX" -lt 0 ]]; then
        printf '## [%s] - %s\n\n' "$VERSION" "$RELEASE_DATE"
        printf '%s\n\n' "$UNRELEASED_BODY"
    fi

    for ((index = UNRELEASED_NEXT; index < ${#LINES[@]}; index++)); do
        printf '%s\n' "${LINES[$index]}"
    done
} > "$TMP_FILE"

mv "$TMP_FILE" "$CHANGELOG"
trap - EXIT

echo "Promoted CHANGELOG.md [Unreleased] notes to $VERSION"
