@echo off
echo 啟動排班工具...
echo.

echo 檢查 Node.js 安裝...
node --version >nul 2>&1
if errorlevel 1 (
    echo 錯誤: 未安裝 Node.js，請先安裝 Node.js 16.0 或以上版本
    echo 下載地址: https://nodejs.org/
    pause
    exit /b 1
)

echo 檢查 npm 套件...
if not exist node_modules (
    echo 安裝依賴套件...
    npm install
    if errorlevel 1 (
        echo 錯誤: 套件安裝失敗
        pause
        exit /b 1
    )
)

echo.
echo 建置前端資源...
npm run build
if errorlevel 1 (
    echo 錯誤: 前端建置失敗
    pause
    exit /b 1
)

echo.
echo 啟動伺服器...
echo 排班工具將在以下網址啟動:
echo 前端介面: http://localhost:3000
echo.
echo 預設管理員帳號: admin / admin123
echo.
echo 按 Ctrl+C 可停止伺服器
echo.

npm start
