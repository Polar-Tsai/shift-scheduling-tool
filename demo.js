// 排班工具演示腳本
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

console.log('🎭 排班工具系統演示');
console.log('==================');

const db = new sqlite3.Database('./scheduling.db');

// 演示資料
const demoData = {
    stores: [
        { name: '鉅鋼機械總店', business_hours: '10:00-22:00', area_manager_id: 1 },
        { name: '鉅鋼機械分店', business_hours: '10:00-22:00', area_manager_id: 1 }
    ],
    
    employees: [
        { name: '張三', type: 'fulltime', role_primary: 'cashier', emp_no: 'EMP001', email: 'zhang@example.com', phone: '0912345678', store_id: 1 },
        { name: '李四', type: 'fulltime', role_primary: 'server', emp_no: 'EMP002', email: 'li@example.com', phone: '0912345679', store_id: 1 },
        { name: '王五', type: 'pt', role_primary: 'kitchen', emp_no: 'EMP003', email: 'wang@example.com', phone: '0912345680', store_id: 1 },
        { name: '趙六', type: 'pt', role_primary: 'support', emp_no: 'EMP004', email: 'zhao@example.com', phone: '0912345681', store_id: 1 },
        { name: '錢七', type: 'fulltime', role_primary: 'cashier', emp_no: 'EMP005', email: 'qian@example.com', phone: '0912345682', store_id: 2 }
    ],
    
    users: [
        { username: 'editor1', password: 'editor123', role: 'editor', employee_id: 1, store_id: 1 },
        { username: 'approver1', password: 'approver123', role: 'approver1', employee_id: 2, store_id: 1 },
        { username: 'approver2', password: 'approver123', role: 'approver2', employee_id: null, store_id: 1 },
        { username: 'viewer1', password: 'viewer123', role: 'viewer', employee_id: 3, store_id: 1 }
    ]
};

// 建立演示資料
async function createDemoData() {
    console.log('\n📊 建立演示資料...');
    
    try {
        // 建立店鋪
        for (const store of demoData.stores) {
            await new Promise((resolve, reject) => {
                db.run(`INSERT OR IGNORE INTO stores (name, business_hours, area_manager_id) 
                        VALUES (?, ?, ?)`, 
                    [store.name, store.business_hours, store.area_manager_id],
                    function(err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            console.log(`✅ 建立店鋪: ${store.name}`);
        }
        
        // 建立員工
        for (const employee of demoData.employees) {
            await new Promise((resolve, reject) => {
                db.run(`INSERT OR IGNORE INTO employees 
                        (name, type, role_primary, emp_no, email, phone, store_id) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [employee.name, employee.type, employee.role_primary, 
                     employee.emp_no, employee.email, employee.phone, employee.store_id],
                    function(err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            console.log(`✅ 建立員工: ${employee.name} (${employee.emp_no})`);
        }
        
        // 建立使用者
        for (const user of demoData.users) {
            const hashedPassword = bcrypt.hashSync(user.password, 10);
            await new Promise((resolve, reject) => {
                db.run(`INSERT OR IGNORE INTO users 
                        (username, password, role, employee_id, store_id) 
                        VALUES (?, ?, ?, ?, ?)`,
                    [user.username, hashedPassword, user.role, user.employee_id, user.store_id],
                    function(err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            console.log(`✅ 建立使用者: ${user.username} (${user.role})`);
        }
        
        console.log('\n🎉 演示資料建立完成！');
        
    } catch (error) {
        console.error('❌ 建立演示資料失敗:', error.message);
    }
}

// 建立演示排班
async function createDemoSchedule() {
    console.log('\n📅 建立演示排班...');
    
    try {
        const weekStart = '2025-01-13'; // 下週一
        
        // 建立排班表
        const scheduleId = await new Promise((resolve, reject) => {
            db.run(`INSERT INTO schedules (store_id, week_start, created_by) 
                    VALUES (?, ?, ?)`,
                [1, weekStart, 1], // 店鋪ID=1, 建立者ID=1
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
        
        console.log(`✅ 建立排班表 ID: ${scheduleId}`);
        
        // 建立班次
        const shifts = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            
            // AM 班次
            const amShiftId = await new Promise((resolve, reject) => {
                db.run(`INSERT INTO shifts (store_id, date, slot) VALUES (?, ?, ?)`,
                    [1, dateStr, 'AM'],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    }
                );
            });
            
            // PM 班次
            const pmShiftId = await new Promise((resolve, reject) => {
                db.run(`INSERT INTO shifts (store_id, date, slot) VALUES (?, ?, ?)`,
                    [1, dateStr, 'PM'],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    }
                );
            });
            
            shifts.push({ date: dateStr, am: amShiftId, pm: pmShiftId });
        }
        
        console.log(`✅ 建立 ${shifts.length * 2} 個班次`);
        
        // 建立排班指派
        const assignments = [
            // 週一
            { shift_id: shifts[0].am, employee_id: 1, role: 'cashier', start_time: '10:00', end_time: '14:00' },
            { shift_id: shifts[0].am, employee_id: 2, role: 'server', start_time: '10:00', end_time: '14:00' },
            { shift_id: shifts[0].pm, employee_id: 1, role: 'cashier', start_time: '18:00', end_time: '22:00' },
            { shift_id: shifts[0].pm, employee_id: 3, role: 'kitchen', start_time: '18:00', end_time: '22:00' },
            
            // 週二
            { shift_id: shifts[1].am, employee_id: 2, role: 'server', start_time: '10:00', end_time: '14:00' },
            { shift_id: shifts[1].am, employee_id: 4, role: 'support', start_time: '10:00', end_time: '14:00' },
            { shift_id: shifts[1].pm, employee_id: 1, role: 'cashier', start_time: '18:00', end_time: '22:00' },
            { shift_id: shifts[1].pm, employee_id: 2, role: 'server', start_time: '18:00', end_time: '22:00' },
            
            // 週三
            { shift_id: shifts[2].am, employee_id: 3, role: 'kitchen', start_time: '10:00', end_time: '14:00' },
            { shift_id: shifts[2].am, employee_id: 4, role: 'support', start_time: '10:00', end_time: '14:00' },
            { shift_id: shifts[2].pm, employee_id: 2, role: 'server', start_time: '18:00', end_time: '22:00' },
            { shift_id: shifts[2].pm, employee_id: 3, role: 'kitchen', start_time: '18:00', end_time: '22:00' }
        ];
        
        for (const assignment of assignments) {
            await new Promise((resolve, reject) => {
                db.run(`INSERT INTO assignments 
                        (shift_id, employee_id, role, start_time, end_time, break_minutes) 
                        VALUES (?, ?, ?, ?, ?, ?)`,
                    [assignment.shift_id, assignment.employee_id, assignment.role,
                     assignment.start_time, assignment.end_time, 120],
                    function(err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }
        
        console.log(`✅ 建立 ${assignments.length} 個排班指派`);
        
        // 提交審核
        const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await new Promise((resolve, reject) => {
            db.run(`UPDATE schedules SET status = 'review1', sla_deadline_at = ? WHERE id = ?`,
                [slaDeadline.toISOString(), scheduleId],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        // 建立審核記錄
        await new Promise((resolve, reject) => {
            db.run(`INSERT INTO reviews (schedule_id, stage, status) VALUES (?, ?, ?)`,
                [scheduleId, 'supervisor', 'pending'],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
        
        console.log(`✅ 排班表已提交審核 (SLA: ${slaDeadline.toLocaleString('zh-TW')})`);
        
    } catch (error) {
        console.error('❌ 建立演示排班失敗:', error.message);
    }
}

// 顯示系統狀態
async function showSystemStatus() {
    console.log('\n📊 系統狀態');
    console.log('==========');
    
    try {
        // 統計店鋪
        const storeCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM stores', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        console.log(`🏪 店鋪數量: ${storeCount}`);
        
        // 統計員工
        const employeeCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM employees', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        console.log(`👥 員工數量: ${employeeCount}`);
        
        // 統計使用者
        const userCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        console.log(`👤 使用者數量: ${userCount}`);
        
        // 統計排班表
        const scheduleCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM schedules', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        console.log(`📅 排班表數量: ${scheduleCount}`);
        
        // 統計指派
        const assignmentCount = await new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM assignments', (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        console.log(`📋 排班指派數量: ${assignmentCount}`);
        
        // 顯示待審核項目
        const pendingReviews = await new Promise((resolve, reject) => {
            db.all(`SELECT s.id, s.week_start, st.name as store_name, s.status, s.sla_deadline_at
                    FROM schedules s
                    LEFT JOIN stores st ON s.store_id = st.id
                    WHERE s.status IN ('review1', 'review2')`,
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        
        if (pendingReviews.length > 0) {
            console.log('\n⏰ 待審核項目:');
            pendingReviews.forEach(review => {
                const deadline = new Date(review.sla_deadline_at);
                const remaining = deadline - new Date();
                const hours = Math.ceil(remaining / (1000 * 60 * 60));
                console.log(`  - ${review.store_name} 第${getWeekNumber(review.week_start)}週 (${review.status}) - 剩餘 ${hours} 小時`);
            });
        }
        
    } catch (error) {
        console.error('❌ 取得系統狀態失敗:', error.message);
    }
}

// 顯示登入資訊
function showLoginInfo() {
    console.log('\n🔐 登入資訊');
    console.log('==========');
    console.log('管理員帳號:');
    console.log('  admin / admin123 (系統管理員)');
    console.log('\n演示帳號:');
    console.log('  editor1 / editor123 (排班編輯者)');
    console.log('  approver1 / approver123 (外場主管)');
    console.log('  approver2 / approver123 (區經理)');
    console.log('  viewer1 / viewer123 (一般員工)');
}

// 顯示功能說明
function showFeatures() {
    console.log('\n🚀 系統功能');
    console.log('==========');
    console.log('✅ 智慧排班 - 自動排班演算法');
    console.log('✅ 員工管理 - 完整員工資料管理');
    console.log('✅ 審核流程 - 多層級審核機制');
    console.log('✅ 規則引擎 - 工時限制與檢核');
    console.log('✅ 匯出功能 - PDF/CSV 多格式匯出');
    console.log('✅ 通知系統 - LINE/Email 自動通知');
    console.log('✅ 響應式設計 - 手機優先介面');
    console.log('✅ SLA 管理 - 審核逾時自動核可');
}

// 取得週數
function getWeekNumber(dateString) {
    const date = new Date(dateString);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
    return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

// 主程式
async function main() {
    try {
        await createDemoData();
        await createDemoSchedule();
        await showSystemStatus();
        showLoginInfo();
        showFeatures();
        
        console.log('\n🎯 下一步操作');
        console.log('============');
        console.log('1. 啟動系統: npm start 或執行 start.bat');
        console.log('2. 開啟瀏覽器: http://localhost:3000');
        console.log('3. 使用 admin/admin123 登入');
        console.log('4. 開始體驗排班功能！');
        
    } catch (error) {
        console.error('演示腳本執行失敗:', error);
    } finally {
        db.close((err) => {
            if (err) {
                console.error('關閉資料庫錯誤:', err.message);
            } else {
                console.log('\n✅ 演示完成，資料庫已關閉');
            }
        });
    }
}

// 執行演示
main();
