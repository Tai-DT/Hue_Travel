---
description: Kiểm tra code quality trước khi commit
---

# Pre-commit Check

// turbo-all

## 1. Build Check
```bash
cd /Volumes/FastVault-Apps/Projects/Desktop/Hue_Travel/apps/api && go build ./...
```

## 2. Vet Check
```bash
cd /Volumes/FastVault-Apps/Projects/Desktop/Hue_Travel/apps/api && go vet ./...
```

## 3. Run Tests
```bash
cd /Volumes/FastVault-Apps/Projects/Desktop/Hue_Travel/apps/api && go test ./... -cover
```

## 4. Check for TODOs
```bash
grep -rn "TODO" /Volumes/FastVault-Apps/Projects/Desktop/Hue_Travel/apps/api/internal/ --include="*.go" || echo "No TODOs found ✅"
```

## 5. Check .env.example
Đảm bảo tất cả env vars mới đã được thêm vào `.env.example`.

## 6. Summary
Nếu tất cả pass → ready to commit!
