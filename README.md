# 排班工具

## 專案簡介

這是一個專為餐飲業設計的排班管理系統，實現「一處完成蒐集→編排→審核→發布→匯出」的完整流程。

### 主要功能

- 📅 **智慧排班**: 自動排班演算法，支援拖拉調整
- 👥 **員工管理**: 完整的員工資料與技能管理
- ✅ **審核流程**: 多層級審核機制，SLA 自動核可
- 📊 **規則引擎**: 工時限制、連續上班、崗位檢核
- 📱 **響應式設計**: 手機優先的現代化介面
- 📄 **多格式匯出**: PDF 紙本版型、CSV 打卡匯入
- 🔔 **通知系統**: LINE、Email 自動通知

### 技術架構

- **後端**: Node.js + Express + SQLite
- **前端**: 原生 JavaScript + Webpack
- **資料庫**: SQLite（可擴展至 PostgreSQL/MySQL）
- **部署**: 支援 Docker 容器化

## 快速開始

### 環境需求

- Node.js 16.0 或以上版本
- npm 或 yarn 套件管理器

### 安裝步驟

1. **下載專案**
   ```bash
   git clone <repository-url>
   cd shift-scheduling-tool
   ```

2. **安裝依賴套件**
   ```bash
   npm install
   ```

3. **啟動開發伺服器**
   ```bash
   # 啟動後端 API 伺服器
   npm run dev
   
   # 另開終端機啟動前端開發伺服器
   npm run dev:client
   ```

4. **存取應用程式**
   - 前端介面: http://localhost:8080
   - API 伺服器: http://localhost:3000

### 預設帳號

- **管理員**: admin / admin123
- **角色權限**: admin, editor, approver1, approver2, viewer

## 功能說明

### 1. 看板 (Dashboard)
- 顯示關鍵統計數據
- 本週班表概覽
- 警示事項提醒
- 待審核項目

### 2. 排班管理 (Schedule)
- 建立新排班表
- 自動排班演算法
- 拖拉式班表調整
- 違規即時提示

### 3. 員工管理 (Employees)
- 員工基本資料
- 技能與角色設定
- 工時類型管理
- 休假申請處理

### 4. 審核流程 (Approval)
- 外場主管審核 (24h SLA)
- 區經理審核 (24h SLA)
- 逾時自動核可
- 審核意見記錄

### 5. 匯出功能 (Export)
- PDF 紙本版型
- CSV 打卡系統匯入
- 自訂格式設定

## 排班規則

### 工時限制
- **正職員工**: 每日最大 12 小時，連續上班最多 5 天
- **PT 員工**: 每日最大 10 小時，連續上班最多 6 天
- **標準休息**: 每日 120 分鐘，不足部分計入加班

### 餐期設定
- **早餐期**: 10:00-14:00
- **晚餐期**: 18:00-22:00
- **跨餐期**: 自動切分為兩筆指派

### 崗位需求
- 每餐期每崗位至少 1 人
- 支援多崗位技能員工
- 自動檢核最低人數

## API 文件

### 認證相關
```javascript
POST /api/login
{
  "username": "admin",
  "password": "admin123"
}
```

### 排班相關
```javascript
// 建立排班表
POST /api/schedules
{
  "store_id": 1,
  "week_start": "2025-01-13"
}

// 自動排班
POST /api/schedules/:id/autoplan

// 提交審核
POST /api/schedules/:id/submit?stage=supervisor
```

### 員工管理
```javascript
// 取得員工列表
GET /api/employees?store_id=1

// 建立員工
POST /api/employees
{
  "name": "張三",
  "type": "fulltime",
  "role_primary": "cashier",
  "emp_no": "EMP001"
}
```

## 資料庫結構

### 主要表格
- `stores`: 店鋪資料
- `employees`: 員工資料
- `schedules`: 排班表
- `assignments`: 排班指派
- `reviews`: 審核記錄
- `exports`: 匯出記錄

### 關聯設計
- 員工 → 店鋪 (多對一)
- 排班表 → 店鋪 (多對一)
- 指派 → 排班表 (多對一)
- 指派 → 員工 (多對一)

## 部署指南

### 生產環境部署

1. **建置前端**
   ```bash
   npm run build
   ```

2. **設定環境變數**
   ```bash
   export JWT_SECRET=your-production-secret
   export PORT=3000
   ```

3. **啟動服務**
   ```bash
   npm start
   ```

### Docker 部署

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 開發指南

### 專案結構
```
├── src/                 # 前端原始碼
│   ├── index.html      # 主頁面
│   ├── index.js        # 主應用程式
│   ├── rules-engine.js # 規則引擎
│   └── export-service.js # 匯出服務
├── server.js           # 後端 API 伺服器
├── package.json        # 專案設定
├── webpack.config.js   # Webpack 設定
└── README.md          # 說明文件
```

### 開發規範
- 使用 ESLint 進行程式碼檢查
- 遵循 RESTful API 設計原則
- 前端使用模組化設計
- 資料庫操作使用參數化查詢

### 測試
```bash
# 執行測試
npm test

# 程式碼覆蓋率
npm run test:coverage
```

## 常見問題

### Q: 如何修改排班規則？
A: 編輯 `src/rules-engine.js` 中的 `rules` 物件，或透過管理介面設定。

### Q: 如何整合現有打卡系統？
A: 使用 CSV 匯出功能，或實作 API 介面進行資料同步。

### Q: 如何備份資料？
A: SQLite 資料庫檔案位於 `scheduling.db`，定期備份此檔案即可。

### Q: 如何擴展多店鋪支援？
A: 系統已支援多店鋪架構，透過 `store_id` 進行資料隔離。

## 版本歷史

### v1.0.0 (2025-01-13)
- 初始版本發布
- 基本排班功能
- 審核流程
- PDF/CSV 匯出

## 授權條款

MIT License - 詳見 LICENSE 檔案


---

**注意**: 本系統為內部使用工具，請勿外洩敏感資料。
