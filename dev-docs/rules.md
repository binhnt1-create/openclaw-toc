```
export LAST_VERSION="v2026.5.5"
export FROM_VERSION="v2026.4.20"

git checkout -b rebase-vs-$LAST_VERSION rebase-vs-$FROM_VERSION

git rebase --onto $LAST_VERSION $FROM_VERSION
```
1. Khi rebase, những thay đổi không liên quan tới thay đổi đã custom -> Keep HEAD (của upstream)
2. Khi conflict trong chính function đã custom, tìm cách kết hợp cả 2
3. Khi phát triển tính năng
- Tên file, dùng prefix: toc
- Tên biến, function, class, ... dùng prefix: toc

## Flow:
- POC version: Đây là điểm bắt đầu của rốn vũ trụ, bản custom đầu tiên nằm ở đây
- Rebase Step:
    - Tạo branch rebase mới: `git checkout -b rebase-vs-$LAST_VERSION rebase-vs-$FROM_VERSION` + Squash commit 
    - Kiểm tra thay đổi của phiên bản, summary lại tag description, phân tích các commit thay đổi và đánh giá rủi ro (ảnh hưởng tới tính năng custom của mình như thế nào) -> Document lại
    - Tiến hành rebase
        - [AUTO] Những commit thay đổi không liên quan tới tính năng custom -> Keep HEAD (của upstream)
        - [MANUAL] Những commit thay đổi liên quan tới tính năng custom, resolve và document lại những thay đổi ở level code
    - Rebase Done:
        - Verify các function đã custom
        - Verify UI/UX
        - Build new image
        

## CLI:

```git fetch upstream --tags```

```gh release view v2026.5.5 --repo openclaw/openclaw 2>&1```

Check new vesion: bash dev-docs/scripts/check-upstream.sh
