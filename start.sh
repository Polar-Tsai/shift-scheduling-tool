#!/bin/bash

echo "啟動排班工具..."
echo

# 檢查 Node.js 安裝
if ! command -v node &> /dev/null; then
    echo "錯誤: 未安裝 Node.js，請先安裝 Node.js 16.0 或以上版本"
    echo "下載地址: https://nodejs.org/"
    exit 1
fi

echo "Node.js 版本: $(node --version)"

# 檢查 npm 套件
if [ ! -d "node_modules" ]; then
    echo "安裝依賴套件..."
    npm install
    if [ $? -ne 0 ]; then
        echo "錯誤: 套件安裝失敗"
        exit 1
    fi
fi

echo
echo "建置前端資源..."
npm run build
if [ $? -ne 0 ]; then
    echo "錯誤: 前端建置失敗"
    exit 1
fi

echo
echo "啟動伺服器..."
echo "排班工具將在以下網址啟動:"
echo "前端介面: http://localhost:3000"
echo
echo "預設管理員帳號: admin / admin123"
echo
echo "按 Ctrl+C 可停止伺服器"
echo

npm start
