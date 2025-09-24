// 修復管理員帳號腳本
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

console.log('🔧 修復管理員帳號...');

const db = new sqlite3.Database('./scheduling.db', (err) => {
    if (err) {
        console.error('資料庫連接錯誤:', err.message);
        process.exit(1);
    } else {
        console.log('✅ 已連接到 SQLite 資料庫');
    }
});

// 檢查並建立管理員帳號
function fixAdminAccount() {
    // 先檢查管理員是否存在
    db.get("SELECT * FROM users WHERE username = 'admin'", (err, user) => {
        if (err) {
            console.error('檢查管理員帳號錯誤:', err.message);
            return;
        }
        
        if (user) {
            console.log('✅ 管理員帳號已存在');
            console.log('   帳號: admin');
            console.log('   密碼: admin123');
            console.log('   角色: admin');
        } else {
            console.log('⚠️ 管理員帳號不存在，正在建立...');
            
            // 建立管理員帳號
            const hashedPassword = bcrypt.hashSync('admin123', 10);
            db.run(`INSERT INTO users (username, password, role, store_id) 
                    VALUES ('admin', ?, 'admin', 1)`, [hashedPassword], function(err) {
                if (err) {
                    console.error('❌ 建立管理員帳號失敗:', err.message);
                } else {
                    console.log('✅ 管理員帳號建立成功');
                    console.log('   帳號: admin');
                    console.log('   密碼: admin123');
                    console.log('   角色: admin');
                    console.log('   ID:', this.lastID);
                }
            });
        }
    });
}

// 檢查所有使用者
function checkAllUsers() {
    console.log('\n📋 所有使用者列表:');
    db.all("SELECT id, username, role, store_id FROM users", (err, rows) => {
        if (err) {
            console.error('取得使用者列表錯誤:', err.message);
            return;
        }
        
        if (rows.length === 0) {
            console.log('   尚無使用者');
        } else {
            rows.forEach(user => {
                console.log(`   ID: ${user.id}, 帳號: ${user.username}, 角色: ${user.role}, 店鋪: ${user.store_id}`);
            });
        }
    });
}

// 測試登入
function testLogin() {
    console.log('\n🔐 測試登入...');
    db.get("SELECT * FROM users WHERE username = 'admin'", (err, user) => {
        if (err) {
            console.error('測試登入錯誤:', err.message);
            return;
        }
        
        if (!user) {
            console.log('❌ 管理員帳號不存在');
            return;
        }
        
        const isValid = bcrypt.compareSync('admin123', user.password);
        if (isValid) {
            console.log('✅ 登入測試成功');
            console.log('   帳號: admin');
            console.log('   密碼: admin123');
            console.log('   角色: admin');
        } else {
            console.log('❌ 密碼驗證失敗');
        }
    });
}

// 執行修復
setTimeout(() => {
    fixAdminAccount();
    
    setTimeout(() => {
        checkAllUsers();
        
        setTimeout(() => {
            testLogin();
            
            setTimeout(() => {
                console.log('\n🎯 修復完成！');
                console.log('現在可以使用以下帳號登入:');
                console.log('   帳號: admin');
                console.log('   密碼: admin123');
                
                db.close((err) => {
                    if (err) {
                        console.error('關閉資料庫錯誤:', err.message);
                    } else {
                        console.log('✅ 資料庫已關閉');
                    }
                });
            }, 1000);
        }, 1000);
    }, 1000);
}, 1000);
