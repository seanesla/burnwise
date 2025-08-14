#!/bin/bash

# BURNWISE Credential Redaction Script
# Removes exposed credentials from documentation files

echo "🔐 REDACTING EXPOSED CREDENTIALS FROM DOCUMENTATION"
echo "===================================================="
echo ""

# Files to clean
FILES=(
    "SECURITY_AUDIT_REPORT.md"
    "SECURITY_IMPLEMENTATION.md"
    "SECURITY_FINAL_REPORT.md"
    "PRODUCTION_DEPLOYMENT_GUIDE.md"
    "POST_SECURITY_STATUS.md"
)

# Credentials to redact
declare -A CREDENTIALS=(
    ["[REDACTED-TIDB-PASSWORD]"]="[REDACTED-TIDB-PASSWORD]"
    ["[REDACTED-OPENWEATHER-API]"]="[REDACTED-OPENWEATHER-API]"
    ["[REDACTED-OPENAI-KEY][A-Za-z0-9_-]*"]="[REDACTED-OPENAI-KEY]"
    ["[REDACTED-TWILIO-SID]"]="[REDACTED-TWILIO-SID]"
    ["[REDACTED-TIDB-USER]"]="[REDACTED-TIDB-USER]"
    ["[REDACTED-TIDB-HOST]"]="[REDACTED-TIDB-HOST]"
)

# Backup files first
echo "📦 Creating backups..."
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "${file}.backup"
        echo "  ✅ Backed up $file"
    fi
done
echo ""

# Redact credentials
echo "🔧 Redacting credentials..."
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  Processing $file..."
        
        # Create temp file
        temp_file="${file}.tmp"
        cp "$file" "$temp_file"
        
        # Replace each credential
        for credential in "${!CREDENTIALS[@]}"; do
            replacement="${CREDENTIALS[$credential]}"
            # Use sed with extended regex for pattern matching
            if [[ "$credential" == *"["* ]]; then
                # Contains regex pattern
                sed -i.bak -E "s/${credential}/${replacement}/g" "$temp_file"
            else
                # Literal string
                sed -i.bak "s/${credential}/${replacement}/g" "$temp_file"
            fi
        done
        
        # Remove backup files created by sed
        rm -f "${temp_file}.bak"
        
        # Replace original file
        mv "$temp_file" "$file"
        echo "  ✅ Redacted $file"
    fi
done
echo ""

# Verify redaction
echo "🔍 Verifying redaction..."
FOUND_EXPOSED=0

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        for credential in "${!CREDENTIALS[@]}"; do
            # Skip regex patterns for verification
            if [[ "$credential" != *"["* ]]; then
                if grep -q "$credential" "$file" 2>/dev/null; then
                    echo "  ⚠️  WARNING: $credential still found in $file"
                    FOUND_EXPOSED=1
                fi
            fi
        done
    fi
done

if [ $FOUND_EXPOSED -eq 0 ]; then
    echo "  ✅ All credentials successfully redacted!"
else
    echo "  ❌ Some credentials may still be exposed. Manual review required."
fi
echo ""

# Summary
echo "📊 REDACTION SUMMARY"
echo "===================="
echo ""
echo "Files processed: ${#FILES[@]}"
echo "Credentials redacted: ${#CREDENTIALS[@]}"
echo ""
echo "Backup files created with .backup extension"
echo ""
echo "⚠️  NEXT STEPS:"
echo "1. Review the redacted files to ensure they look correct"
echo "2. Commit the redacted files: git add *.md && git commit -m 'security: Redact exposed credentials from documentation'"
echo "3. Run git history cleaner if needed: ./clean-git-history.sh"
echo "4. Delete backup files when satisfied: rm *.md.backup"
echo ""
echo "✅ Redaction complete!"