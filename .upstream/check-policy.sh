#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 BASE_REF HEAD_REF" >&2
  exit 2
fi

base_ref="$1"
head_ref="$2"
policy_file="${UPSTREAM_POLICY_FILE:-.upstream/policy.yml}"
changed_files="$(git diff --no-renames --name-only "${base_ref}...${head_ref}")"
file_count="$(printf '%s\n' "$changed_files" | sed '/^$/d' | wc -l | tr -d ' ')"
max_changed_files="$(ruby -ryaml -e 'puts YAML.load_file(ARGV.fetch(0))["sync"]["max_changed_files"]' "$policy_file")"

if [ "$file_count" -gt "$max_changed_files" ]; then
  echo "Change touches ${file_count} files (limit ${max_changed_files})." >&2
  exit 1
fi

if ! printf '%s\n' "$changed_files" | ruby -ryaml -e '
  policy = YAML.load_file(ARGV.fetch(0))
  protected_paths = policy.fetch("protected_paths")
  changed_paths = STDIN.each_line.map(&:chomp).reject(&:empty?)
  protected_changes = changed_paths.select do |path|
    protected_paths.any? do |pattern|
      File.fnmatch?(pattern, path, File::FNM_PATHNAME | File::FNM_DOTMATCH)
    end
  end
  unless protected_changes.empty?
    warn "Change touches protected paths: #{protected_changes.join(", ")}"
    exit 1
  end
' "$policy_file"; then
  exit 1
fi
