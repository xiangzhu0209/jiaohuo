# 叫貨單系統（Firebase + GitHub Pages 版）

這份說明是給**不寫程式**的人看的，照順序做完一次就好。
之後新增廠商、叫貨、列印，都在網站上操作，不需要再碰這些設定。

---

## 一、先認識這個資料夾

| 檔案／資料夾 | 用途 |
| --- | --- |
| `src/` | 程式碼（要改功能才需要動） |
| `public/seed-data.json` | **搬家前的完整備份**（16 家廠商、502 筆價格、33 張叫貨單、145 筆明細） |
| `firestore.rules` | 資料庫安全規則，要在 Firebase 貼上一次 |
| `.github/workflows/deploy.yml` | 自動上線設定（已寫好，不用改） |
| `使用說明.md` | 就是這份文件 |

資料庫改用 Firebase（Google），登入帳號也改用 Firebase，網站放在 GitHub Pages。
**金鑰已經填好**，你不需要申請任何東西。

---

## 二、把網站放上 GitHub

### 1. 安裝 GitHub Desktop（最簡單）

到 <https://desktop.github.com> 下載安裝，用你的 GitHub 帳號登入。

> 為什麼用它？因為 `.github` 是隱藏資料夾，用網頁拖曳常常會漏掉。
> GitHub Desktop 會完整處理。

### 2. 新增專案

1. 打開 GitHub Desktop → 功能表 **File → Add local repository…**
2. 選擇這個資料夾（解壓縮後的那一層，裡面要看到 `package.json`）
3. 如果它說「這不是 Git 專案」，按 **create a repository** → 一路按 **Create repository**
4. 右上方按 **Publish repository**
   - Name 填 `jiaohuo`（或任何你喜歡的名字）
   - **Important：把「Keep this code private」的勾去掉**（免費帳號的 GitHub Pages 只支援公開專案）
   - 按 **Publish repository**

### 3. 打開 GitHub Pages

1. 到 <https://github.com> 打開你的專案
2. 點上方 **Settings** → 左側選 **Pages**
3. 在 **Build and deployment** 的 **Source** 選 **GitHub Actions**
4. 回到專案首頁 → 點 **Actions** 頁籤，會看到一個正在跑的黃點
5. 等它變成綠色勾勾（大約 1～3 分鐘）

你的網站網址就是：

```
https://你的帳號.github.io/jiaohuo/
```

> 帳號若是 `tianxiangzhu`、專案叫 `jiaohuo`，網址就是
> `https://tianxiangzhu.github.io/jiaohuo/`
> **把這串網址記下來，下一步要用。**

---

## 三、Firebase 設定（只做一次，約 10 分鐘）

打開 <https://console.firebase.google.com>，選專案 **order-management-7fcd8**。

### 1. 開啟 Email/密碼登入

左側 **Build → Authentication** → **Get started** →
**Sign-in method** → 點 **Email/Password** → 把第一個開關打開 → **Save**。

> （第二個「Email link (passwordless sign-in)」不用開）

### 2. 建立資料庫

左側 **Build → Firestore Database** → **Create database**
→ 選 **Start in production mode** → 位置選 **asia-east1 (Taiwan)** → **Create**。

### 3. 貼上安全規則（很重要，沒做會讀不到資料）

1. 在 **Firestore Database** 頁籤選 **Rules**
2. 把 `firestore.rules` 這個檔案**整個內容**複製貼上，蓋掉原本的
3. 按 **Publish**

### 4. 加入你的網站網址（授權網域）

左側 **Build → Authentication** → 上方 **Settings** → **Authorized domains**
→ **Add domain** → 貼上剛剛記下的網域（**只到 `.github.io` 為止**）：

```
你的帳號.github.io
```

> 例如 `tianxiangzhu.github.io`。
> 目前裡面已經有一筆 `xiangzhu0209.github.io`，如果你用的帳號不是這個，
> 記得補上正確的那一個，否則會出現「這個網址還沒加入 Firebase 的授權網域」。

---

## 四、開始使用

> **注意：帳號系統換了，所以每個人都要重新註冊一次。**
> 請用**原本的信箱**註冊（舊密碼不能沿用），註冊時填的姓名會印在叫貨單的「出單人」。

1. 打開你的網站網址
2. 按 **沒有帳號？註冊** → 填姓名、信箱、密碼 → 註冊（會自動登入）
3. 登入後，左側選單最下面有一項 **舊資料匯入**
4. 先按 **讀取備份檔** → 確認筆數是 廠商 16、價格表 502、叫貨單 33、明細 145
5. 按 **匯入舊資料** → 等它跑完（約 5～10 秒）→ 完成

匯入完就可以正常叫貨、列印、對帳了。這一頁之後用不到，可以不管它。

### 給其他人使用

對方用自己的信箱**註冊**一個帳號即可。
登入後看到的是**同一份資料**（廠商、價格、叫貨單都共用），這是原本就有的設計。

### 忘記密碼

登入頁按 **忘記密碼？** → 填信箱 → 收信 → 點信裡的連結 → 設定新密碼。

---

## 五、備份與還原

- `public/seed-data.json` 就是**搬家當天（2026/09/29）的完整資料**。
  請把這個檔案另外存一份（雲端硬碟、隨身碟都好），這是最重要的保險。
- 平常的資料都在 Firebase 雲端，不需要自己備份。
  如果想手動備份，登入 Firebase 主控台 → Firestore Database → 可以匯出。

### 想換成別的 Firebase 專案

只要改一個檔案：`src/lib/firebase.ts` 裡的設定值，然後重新上傳到 GitHub 即可。

---

## 六、離線模式（備用）

如果連不上雲端（例如網路或服務出問題），登入頁下方有 **離線下單**：
輸入姓名就能先下單、列印，資料存在**這台電腦的瀏覽器**裡。

- 一定要固定用**同一個瀏覽器**與**同一個網址**，否則看不到剛才打的資料
- 圖片／資料不會自動上傳，恢復連線後請按「匯出資料」保存 JSON 檔

---

## 七、以後要改畫面或功能

把需求告訴 Enter（原本的那個對話）即可，改完再重新上傳到 GitHub。
或是把這個資料夾丟回 Enter 繼續修改。
