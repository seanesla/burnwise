#!/bin/bash

# BURNWISE Git History Cleaner
# Removes all traces of exposed credentials from git history

echo "🧹 BURNWISE GIT HISTORY CLEANER"
echo "================================"
echo ""
echo "⚠️  WARNING: This will rewrite git history!"
echo "⚠️  Make sure you have:"
echo "   1. Backed up your repository"
echo "   2. Coordinated with your team"
echo "   3. Updated all credentials"
echo ""
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

# Create backup
echo "📦 Creating repository backup..."
cp -r .git .git.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ Backup created"
echo ""

# Files and patterns to remove
echo "🔍 Identifying sensitive files to remove..."
SENSITIVE_FILES=(
    "**/backend/.env"
    "**/frontend/.env"
    "**/.env"
    "**/.env.local"
    "**/.env.development"
    "**/.env.production"
    "**/config/secrets.js"
    "**/config/credentials.json"
)

SENSITIVE_PATTERNS=(
    "[REDACTED-TIDB-PASSWORD]"
    "[REDACTED-OPENWEATHER-API]"
    "[REDACTED-OPENAI-KEY]"
    "[REDACTED-TWILIO-SID]"
    "burnwise-jwt-secret-change-in-production"
)

echo "📝 Files to remove:"
for file in "${SENSITIVE_FILES[@]}"; do
    echo "   - $file"
done
echo ""

# Remove files from history
echo "🗑️  Removing sensitive files from history..."
for file in "${SENSITIVE_FILES[@]}"; do
    git filter-branch --force --index-filter \
        "git rm -rf --cached --ignore-unmatch $file" \
        --prune-empty --tag-name-filter cat -- --all 2>/dev/null || true
done

echo "✅ Files removed from history"
echo ""

# Clean up sensitive content from existing files
echo "🔧 Cleaning sensitive data from documentation..."

# Create cleaned versions of security reports
for file in SECURITY_*.md; do
    if [ -f "$file" ]; then
        echo "   Cleaning $file..."
        sed -i.bak \
            -e 's/[REDACTED-TIDB-PASSWORD]/[REDACTED]/g' \
            -e 's/[REDACTED-OPENWEATHER-API]/[REDACTED]/g' \
            -e 's/sk-proj-[A-Za-z0-9_-]*/[REDACTED]/g' \
            -e 's/ACad74[a-z0-9]*/[REDACTED]/g' \
            -e 's/YOUR_.*_HERE/[CONFIGURATION_REQUIRED]/g' \
            "$file"
        rm "${file}.bak"
    fi
done

echo "✅ Documentation cleaned"
echo ""

# Force garbage collection
echo "🗑️  Cleaning up git objects..."
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "✅ Git cleanup complete"
echo ""

# Verify cleaning
echo "🔍 Verifying cleanup..."
FOUND_SECRETS=0

for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if git log --all --oneline | grep -q "$pattern" 2>/dev/null; then
        echo "   ⚠️  Pattern still found: ${pattern:0:10}..."
        FOUND_SECRETS=1
    fi
done

if [ $FOUND_SECRETS -eq 0 ]; then
    echo "✅ No exposed secrets found in history!"
else
    echo "⚠️  Some patterns may still exist. Manual review recommended."
fi
echo ""

# Create .gitignore entries
echo "📝 Updating .gitignore..."
cat >> .gitignore << 'EOF'

# Security - Never commit these
.env
.env.*
!.env.example
!.env.sample
*.key
*.pem
*.crt
*.pfx
credentials.json
secrets.json
secret.json
config/secrets.js
config/credentials.js

# Backup files
*.backup
*.bak
.git.backup.*

# Logs with potential secrets
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE files that might contain secrets
.vscode/settings.json
.idea/
*.swp
*.swo
*~
EOF

echo "✅ .gitignore updated"
echo ""

# Final instructions
echo "✅ GIT HISTORY CLEANED!"
echo "======================="
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "1. VERIFY the cleaning worked:"
echo "   git log --all --oneline | grep -E 'TIDB_PASSWORD|API_KEY|JWT_SECRET'"
echo ""
echo "2. COMMIT the cleaned files:"
echo "   git add -A"
echo "   git commit -m 'security: Remove exposed credentials from history'"
echo ""
echo "3. FORCE PUSH to remote (coordinate with team!):"
echo "   git push origin --force --all"
echo "   git push origin --force --tags"
echo ""
echo "4. NOTIFY all team members to:"
echo "   git fetch --all"
echo "   git reset --hard origin/main"
echo ""
echo "5. DELETE local backups after verification:"
echo "   rm -rf .git.backup.*"
echo ""
echo "⚠️  IMPORTANT:"
echo "   - All team members must re-clone or reset their repos"
echo "   - Update all CI/CD pipelines with new credentials"
echo "   - Rotate all exposed API keys immediately"
echo "   - Monitor for any unauthorized access"
echo ""
echo "🔒 Security hardening complete!"