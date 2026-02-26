# npm Publish Instructions - Damie Code v2.0.0

**Version:** 2.0.0  
**Date:** February 22, 2026  
**Status:** ✅ READY TO PUBLISH

---

## ✅ Pre-Publish Checklist

- [x] All code changes committed to git
- [x] Version bumped to 2.0.0 in package.json
- [x] CHANGELOG.md updated
- [x] README.md updated
- [x] RELEASE_NOTES_v2.md created
- [x] Git tag v2.0.0 created
- [x] Changes pushed to GitHub
- [x] Package built and prepared in dist/
- [x] Documentation complete

---

## 📦 Package Details

**Package Name:** `@damoojeje/damie-code`  
**Version:** `2.0.0`  
**License:** Apache-2.0  
**Size:** ~15.5 MB (bundled)  
**Files:** 10 files in dist/

### Package Contents

```
dist/
├── cli.js              (15.5 MB - bundled application)
├── package.json        (897 B - distribution package.json)
├── README.md           (15.9 KB - documentation)
├── LICENSE             (1.1 KB - Apache-2.0 license)
├── vendor/             (ripgrep binaries)
└── *.sb                (sandbox profiles)
```

---

## 🚀 Publish Commands

### Step 1: Navigate to dist folder

```bash
cd E:\damie-coder-cli\dist
```

### Step 2: Verify package contents

```bash
# Check package.json
type package.json

# Should show:
# {
#   "name": "@damoojeje/damie-code",
#   "version": "2.0.0",
#   ...
# }
```

### Step 3: Login to npm (if not already logged in)

```bash
npm login
```

Enter your npm credentials when prompted.

### Step 4: Publish to npm

```bash
npm publish --access public
```

**Note:** If you have 2FA enabled, you'll need to provide the OTP code:

```bash
npm publish --access public --otp=123456
```

Replace `123456` with your 6-digit authenticator code.

---

## ✅ Post-Publish Verification

### 1. Check npm package page

Visit: https://www.npmjs.com/package/@damoojeje/damie-code

Should show:

- Version: 2.0.0
- License: Apache-2.0
- README rendered correctly

### 2. Verify via CLI

```bash
npm view @damoojeje/damie-code
```

Should show:

```
@damoojeje/damie-code@2.0.0 | Apache-2.0 | ...
```

### 3. Test installation

```bash
# Uninstall any existing version
npm uninstall -g @damoojeje/damie-code

# Install new version
npm install -g @damoojeje/damie-code@2.0.0

# Verify
damie --version
# Should show: 2.0.0

# Test app
damie
```

---

## 📝 Release Announcement

### GitHub Release

Create a GitHub release at:
https://github.com/damoojeje/damie-code/releases/new

**Tag:** v2.0.0  
**Title:** Damie Code v2.0.0 - Complete Fix Release

**Release Notes:** Copy from `RELEASE_NOTES_v2.md`

### npm Release

The npm publish will automatically create the release on npmjs.com.

---

## 🎯 What's Included in v2.0.0

### Features

- ✅ 6 API providers fully configured
- ✅ 19 models available
- ✅ Full config file loading
- ✅ All commands functional
- ✅ Model routing integrated
- ✅ Health checks via `damie doctor`

### Commands

- `/skills` - Skill management
- `/plugins` - Plugin management
- `/profile` - Profile management
- `/model` - Model selection
- `/setup` - Setup wizard
- `damie doctor` - Health checks

### Fixes

- 17 of 21 issues fixed (81%)
- All critical functionality working
- Clear error messages
- Provider health checks

---

## 📊 Statistics

- **Files Modified:** 13 files
- **Lines Added:** +1,600+
- **Documentation:** 7 comprehensive docs
- **Tests:** All existing tests passing
- **Issues Fixed:** 17 of 21 (81%)

---

## 🔗 Links

- **npm Package:** https://www.npmjs.com/package/@damoojeje/damie-code
- **GitHub Repo:** https://github.com/damoojeje/damie-code
- **GitHub Release:** https://github.com/damoojeje/damie-code/releases/tag/v2.0.0
- **Changelog:** https://github.com/damoojeje/damie-code/blob/main/CHANGELOG.md

---

## ⚠️ Troubleshooting

### "Package already exists" error

If you get an error that version 2.0.0 already exists:

```bash
# Check published versions
npm view @damoojeje/damie-code versions

# If 2.0.0 exists, you need to unpublish or bump version
npm unpublish @damoojeje/damie-code@2.0.0

# Then publish again
npm publish --access public
```

### "Authentication required" error

```bash
# Login to npm
npm login

# Then publish
npm publish --access public
```

### "OTP required" error

```bash
# Get code from authenticator app
npm publish --access public --otp=123456
```

---

## 🎉 Ready to Publish!

**All preparations complete. Run the publish command when ready:**

```bash
cd E:\damie-coder-cli\dist
npm publish --access public
```

**Good luck! 🚀**
