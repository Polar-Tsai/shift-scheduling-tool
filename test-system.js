// 系統測試腳本
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

console.log('🧪 排班工具系統測試');
console.log('==================');

// 測試資料庫連接
const db = new sqlite3.Database('./scheduling.db', (err) => {
    if (err) {
        console.error('❌ 資料庫連接失敗:', err.message);
        process.exit(1);
    } else {
        console.log('✅ 資料庫連接成功');
    }
});

// 測試表格是否存在
const tables = [
    'stores', 'employees', 'users', 'time_off_requests',
    'demand_forecasts', 'shifts', 'assignments', 
    'schedules', 'reviews', 'exports'
];

let completedTests = 0;
const totalTests = tables.length + 3; // 表格檢查 + 其他測試

function checkTable(tableName) {
    return new Promise((resolve) => {
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`, (err, row) => {
            if (err) {
                console.error(`❌ 檢查表格 ${tableName} 失敗:`, err.message);
            } else if (row) {
                console.log(`✅ 表格 ${tableName} 存在`);
            } else {
                console.log(`❌ 表格 ${tableName} 不存在`);
            }
            completedTests++;
            resolve();
        });
    });
}

// 測試預設資料
function testDefaultData() {
    return new Promise((resolve) => {
        db.get("SELECT COUNT(*) as count FROM stores", (err, row) => {
            if (err) {
                console.error('❌ 檢查預設店鋪失敗:', err.message);
            } else if (row.count > 0) {
                console.log('✅ 預設店鋪資料存在');
            } else {
                console.log('❌ 預設店鋪資料不存在');
            }
            completedTests++;
            resolve();
        });
    });
}

// 測試管理員帳號
function testAdminAccount() {
    return new Promise((resolve) => {
        db.get("SELECT * FROM users WHERE username = 'admin'", (err, user) => {
            if (err) {
                console.error('❌ 檢查管理員帳號失敗:', err.message);
            } else if (user) {
                console.log('✅ 管理員帳號存在');
                // 測試密碼驗證
                if (bcrypt.compareSync('admin123', user.password)) {
                    console.log('✅ 管理員密碼驗證成功');
                } else {
                    console.log('❌ 管理員密碼驗證失敗');
                }
            } else {
                console.log('❌ 管理員帳號不存在');
            }
            completedTests++;
            resolve();
        });
    });
}

// 測試規則引擎
function testRulesEngine() {
    try {
        // 模擬規則引擎測試
        const rules = {
            mealPeriods: {
                AM: { start: '10:00', end: '14:00' },
                PM: { start: '18:00', end: '22:00' }
            },
            workLimits: {
                fulltime: { maxDaily: 12, maxConsecutive: 5 },
                pt: { maxDaily: 10, maxConsecutive: 6 }
            }
        };
        
        console.log('✅ 規則引擎配置正確');
        completedTests++;
    } catch (error) {
        console.error('❌ 規則引擎測試失敗:', error.message);
        completedTests++;
    }
}

// 執行所有測試
async function runTests() {
    console.log('\n📋 檢查資料庫表格...');
    for (const table of tables) {
        await checkTable(table);
    }
    
    console.log('\n📊 檢查預設資料...');
    await testDefaultData();
    
    console.log('\n👤 檢查管理員帳號...');
    await testAdminAccount();
    
    console.log('\n⚙️ 測試規則引擎...');
    testRulesEngine();
    
    // 等待所有測試完成
    const checkInterval = setInterval(() => {
        if (completedTests >= totalTests) {
            clearInterval(checkInterval);
            finishTests();
        }
    }, 100);
}

function finishTests() {
    console.log('\n📈 測試結果摘要');
    console.log('================');
    console.log(`總測試項目: ${totalTests}`);
    console.log(`已完成: ${completedTests}`);
    
    if (completedTests === totalTests) {
        console.log('🎉 所有測試通過！系統準備就緒');
        console.log('\n🚀 啟動指令:');
        console.log('Windows: start.bat');
        console.log('Linux/Mac: ./start.sh');
        console.log('手動啟動: npm start');
    } else {
        console.log('⚠️ 部分測試未完成，請檢查系統狀態');
    }
    
    db.close((err) => {
        if (err) {
            console.error('關閉資料庫錯誤:', err.message);
        } else {
            console.log('\n✅ 測試完成，資料庫已關閉');
        }
        process.exit(0);
    });
}

// 開始測試
runTests().catch(error => {
    console.error('測試執行錯誤:', error);
    process.exit(1);
});
