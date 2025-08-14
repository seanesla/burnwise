#!/bin/bash

# BURNWISE Safe Credential Redaction Script
# Carefully removes exposed credentials from documentation

echo "🔐 SAFE CREDENTIAL REDACTION"
echo "============================="
echo ""

# Files to clean
FILES=(
    "SECURITY_AUDIT_REPORT.md"
    "SECURITY_IMPLEMENTATION.md"
    "SECURITY_FINAL_REPORT.md"
    "PRODUCTION_DEPLOYMENT_GUIDE.md"
    "POST_SECURITY_STATUS.md"
)

# Backup files
echo "📦 Creating backups..."
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        cp "$file" "${file}.backup2"
        echo "  ✅ Backed up $file"
    fi
done
echo ""

# Redact credentials using precise replacements
echo "🔧 Redacting credentials..."
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  Processing $file..."
        
        # Replace specific credentials only
        sed -i '' \
            -e 's/[REDACTED-TIDB-PASSWORD]/[REDACTED-TIDB-PASSWORD]/g' \
            -e 's/[REDACTED-OPENWEATHER-API]/[REDACTED-OPENWEATHER-API]/g' \
            -e 's/[REDACTED-OPENAI-KEY][A-Za-z0-9_-]*/[REDACTED-OPENAI-KEY]/g' \
            -e 's/[REDACTED-TWILIO-SID]/[REDACTED-TWILIO-SID]/g' \
            -e 's/3A3xGUKqThYCCvD\.root/[REDACTED-TIDB-USER]/g' \
            -e 's/gateway01\.us-east-1\.prod\.aws\.tidbcloud\.com/[REDACTED-TIDB-HOST]/g' \
            "$file"
        
        echo "  ✅ Redacted $file"
    fi
done
echo ""

# Verify redaction
echo "🔍 Verifying redaction..."
FOUND_EXPOSED=0

CREDENTIALS=(
    "[REDACTED-TIDB-PASSWORD]"
    "[REDACTED-OPENWEATHER-API]"
    "[REDACTED-TWILIO-SID]"
    "[REDACTED-TIDB-USER]"
    "[REDACTED-TIDB-HOST]"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        for credential in "${CREDENTIALS[@]}"; do
            if grep -q "$credential" "$file" 2>/dev/null; then
                echo "  ⚠️  WARNING: $credential still found in $file"
                FOUND_EXPOSED=1
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

# Clean up old backups
rm -f *.md.backup
echo "✅ Cleaned up old backup files"
echo ""

echo "📊 REDACTION COMPLETE"
echo "===================="
echo ""
echo "Next steps:"
echo "1. Review the files to ensure they look correct"
echo "2. Delete backup files: rm *.md.backup2"
echo "3. Commit: git add *.md && git commit -m 'security: Redact exposed credentials from documentation'"
echo ""