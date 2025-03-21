# #!/bin/bash

# # Ensure the docs/source directory exists
# mkdir -p docs/MEDS-DEV

# # Find all README.md files and copy them with renamed filenames
# find MEDS-DEV -type f -name "README.md" | while read file; do
#     parent_dir=$(basename "$(dirname "$file")")  # Get parent directory name
#     cp "$file" "docs/MEDS-DEV/${parent_dir}.md"
# done

#!/bin/bash

# Ensure the target directories exist
mkdir -p docs/MEDS-DEV/Datasets
mkdir -p docs/MEDS-DEV/Models
mkdir -p docs/MEDS-DEV/Tasks

# Define allowed directories
ALLOWED_DIRS=("datasets" "models" "tasks")

# Iterate over allowed directories and copy README files
for dir in "${ALLOWED_DIRS[@]}"; do
    SOURCE_DIR="MEDS-DEV/src/MEDS_DEV/${dir}"
    TARGET_DIR="docs/MEDS-DEV/$(echo "$dir" | awk '{print toupper(substr($0,1,1)) substr($0,2)}')"  # Capitalize

    if [[ -d "$SOURCE_DIR" ]]; then
        find "$SOURCE_DIR" -mindepth 2 -type f -name "README.md" | while read file; do
            parent_dir=$(basename "$(dirname "$file")")  # Get parent directory name
            cp "$file" "${TARGET_DIR}/${parent_dir}.md"
        done
    fi
done