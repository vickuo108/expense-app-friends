# Friends Import Tool

把 Vic 給女友的週統計表轉成 `expense-app-friends` 可吃的記帳資料。

## 使用方式

先讓 AI 從截圖或文字整理出 `friends-import.example.json` 這種格式：

```json
{
  "date": "2026-06-16",
  "source": "Vic 週統計 2026-06-09~2026-06-15",
  "defaultMethod": "LINE Pay",
  "records": [
    { "main": "主食", "sub": "晚餐", "amount": 3271 }
  ]
}
```

產生可匯入的 JSON：

```bash
node tools/friends-import.js --input tools/friends-import.example.json --out /tmp/friends_import.json
```

直接寫入女友雲端帳本：

```bash
FRIENDS_EMAIL="..." FRIENDS_PASSWORD="..." node tools/friends-import.js --input tools/friends-import.example.json --cloud
```

## 規則

- `amount` 請填正數，工具會自動轉成女友帳本的支出負數。
- 預設付款方式是薰設定頁中的 `LINE Pay`。
- 直接寫入雲端時，主類別、子類別與付款方式都會先對照薰設定頁中的名稱；名稱不存在就停止匯入。
- 會用日期、類別、金額、備註做簡單去重，避免同一批重複匯入。
- 截圖只有統計總額時，會以「每個子類別一筆」的方式匯入；若提供逐筆明細，就能逐筆匯入。

## 薰目前設定名稱

參考 `tools/xun-settings.json`。截圖解析時必須使用這些名稱，不使用 Vic 帳本的分類名稱。
