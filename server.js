const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 中介軟體設定
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 100 // 限制每個 IP 每 15 分鐘最多 100 個請求
});
app.use('/api/', limiter);

// 靜態檔案服務
app.use(express.static(path.join(__dirname, 'dist')));

// 資料庫初始化
const db = new sqlite3.Database('./scheduling.db', (err) => {
  if (err) {
    console.error('資料庫連接錯誤:', err.message);
  } else {
    console.log('已連接到 SQLite 資料庫');
    initializeDatabase();
  }
});

// 初始化資料庫表格
function initializeDatabase() {
  const tables = [
    // 店鋪表
    `CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      business_hours TEXT,
      area_manager_id INTEGER,
      min_cashier INTEGER DEFAULT 1,
      min_server INTEGER DEFAULT 1,
      min_kitchen INTEGER DEFAULT 1,
      min_support INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // 員工表
    `CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('fulltime', 'pt')) NOT NULL,
      role_primary TEXT CHECK(role_primary IN ('cashier', 'reception', 'runner', 'tea_service', 'control', 'plating', 'clearing', 'beverage')) NOT NULL,
      skills TEXT, -- JSON 陣列
      store_id INTEGER,
      emp_no TEXT UNIQUE,
      email TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores (id)
    )`,
    
    // 使用者表
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'editor', 'approver1', 'approver2', 'viewer')) NOT NULL,
      employee_id INTEGER,
      store_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees (id),
      FOREIGN KEY (store_id) REFERENCES stores (id)
    )`,
    
    // 休假申請表
    `CREATE TABLE IF NOT EXISTS time_off_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date DATE NOT NULL,
      type TEXT CHECK(type IN ('sick', 'personal', 'vacation')) NOT NULL,
      status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees (id)
    )`,
    
    // 需求預測表
    `CREATE TABLE IF NOT EXISTS demand_forecasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL,
      week_start DATE NOT NULL,
      expected_revenue REAL,
      hour_units INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores (id)
    )`,
    
    // 班次表
    `CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL,
      date DATE NOT NULL,
      slot TEXT CHECK(slot IN ('AM', 'PM')) NOT NULL,
      min_cashier INTEGER DEFAULT 1,
      min_server INTEGER DEFAULT 1,
      min_kitchen INTEGER DEFAULT 1,
      min_support INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores (id)
    )`,
    
    // 排班指派表
    `CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      role TEXT CHECK(role IN ('cashier', 'reception', 'runner', 'tea_service', 'control', 'plating', 'clearing', 'beverage')) NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      break_minutes INTEGER DEFAULT 120,
      regular_hours REAL DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      consec_days INTEGER DEFAULT 0,
      locked BOOLEAN DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      modified_by INTEGER,
      modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (shift_id) REFERENCES shifts (id),
      FOREIGN KEY (employee_id) REFERENCES employees (id),
      FOREIGN KEY (modified_by) REFERENCES users (id)
    )`,
    
    // 排班表
    `CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL,
      week_start DATE NOT NULL,
      status TEXT CHECK(status IN ('draft', 'review1', 'review2', 'published')) DEFAULT 'draft',
      sla_deadline_at DATETIME,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores (id),
      FOREIGN KEY (created_by) REFERENCES users (id)
    )`,
    
    // 審核記錄表
    `CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      stage TEXT CHECK(stage IN ('supervisor', 'area_manager')) NOT NULL,
      status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
      comment TEXT,
      decided_by INTEGER,
      decided_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schedule_id) REFERENCES schedules (id),
      FOREIGN KEY (decided_by) REFERENCES users (id)
    )`,
    
    // 匯出記錄表
    `CREATE TABLE IF NOT EXISTS exports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schedule_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('pdf', 'csv')) NOT NULL,
      url TEXT,
      status TEXT CHECK(status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schedule_id) REFERENCES schedules (id)
    )`
  ];

  let completedTables = 0;
  const totalTables = tables.length;

  tables.forEach(sql => {
    db.run(sql, (err) => {
      if (err) {
        console.error('建立表格錯誤:', err.message);
      }
      completedTables++;
      
      // 當所有表格都建立完成後，才建立預設資料
      if (completedTables === totalTables) {
        console.log('所有資料庫表格建立完成');
        createDefaultData();
      }
    });
  });
}

// 建立預設資料
function createDefaultData() {
  // 檢查是否已有資料
  db.get("SELECT COUNT(*) as count FROM stores", (err, row) => {
    if (err) {
      console.error('檢查預設資料錯誤:', err.message);
      return;
    }
    
    if (row.count === 0) {
      // 建立預設店鋪
      db.run(`INSERT INTO stores (name, business_hours, area_manager_id) 
              VALUES ('鉅鋼機械總店', '10:00-22:00', 1)`, (err) => {
        if (err) console.error('建立預設店鋪錯誤:', err.message);
      });

      // 建立預設管理員
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      db.run(`INSERT INTO users (username, password, role, store_id) 
              VALUES ('admin', ?, 'admin', 1)`, [hashedPassword], (err) => {
        if (err) console.error('建立預設管理員錯誤:', err.message);
      });

      // 建立範例員工資料
      const sampleEmployees = [
        { name: '張三', type: 'fulltime', role_primary: 'cashier', skills: ['cashier', 'reception'], emp_no: 'EMP001' },
        { name: '李四', type: 'fulltime', role_primary: 'server', skills: ['server', 'tea_service'], emp_no: 'EMP002' },
        { name: '王五', type: 'pt', role_primary: 'kitchen', skills: ['kitchen', 'plating'], emp_no: 'EMP003' },
        { name: '趙六', type: 'pt', role_primary: 'reception', skills: ['reception', 'plating', 'clearing'], emp_no: 'EMP004' },
        { name: '錢七', type: 'fulltime', role_primary: 'control', skills: ['control', 'server'], emp_no: 'EMP005' },
        { name: '小蛋', type: 'pt', role_primary: 'beverage', skills: ['beverage', 'runner'], emp_no: 'EMP006' }
      ];

      sampleEmployees.forEach((emp, index) => {
        setTimeout(() => {
          db.run(`INSERT INTO employees (name, type, role_primary, skills, store_id, emp_no) 
                  VALUES (?, ?, ?, ?, ?, ?)`,
            [emp.name, emp.type, emp.role_primary, JSON.stringify(emp.skills), 1, emp.emp_no],
            (err) => {
              if (err) {
                console.error(`建立員工 ${emp.name} 錯誤:`, err.message);
              } else {
                console.log(`已建立員工: ${emp.name}`);
              }
            }
          );
        }, index * 100); // 延遲執行避免同時插入
      });
    }
  });
}

// JWT 驗證中介軟體
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '需要存取權杖' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '無效的存取權杖' });
    }
    req.user = user;
    next();
  });
}

// 角色權限檢查
function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '權限不足' });
    }
    next();
  };
}

// API 路由
// 登入
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ error: '資料庫錯誤' });
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: '使用者名稱或密碼錯誤' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, store_id: user.store_id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, username: user.username, role: user.role, store_id: user.store_id } });
  });
});

// 取得使用者資訊
app.get('/api/user', authenticateToken, (req, res) => {
  res.json(req.user);
});

// 取得店鋪列表
app.get('/api/stores', authenticateToken, (req, res) => {
  db.all('SELECT * FROM stores', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '資料庫錯誤' });
    }
    res.json(rows);
  });
});

// 取得員工列表
app.get('/api/employees', authenticateToken, (req, res) => {
  const storeId = req.user.role === 'admin' ? req.query.store_id : req.user.store_id;
  
  let query = 'SELECT * FROM employees';
  let params = [];
  
  if (storeId) {
    query += ' WHERE store_id = ?';
    params.push(storeId);
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '資料庫錯誤' });
    }
    res.json(rows);
  });
});

// 建立員工
app.post('/api/employees', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const { name, type, role_primary, skills, store_id, emp_no } = req.body;
  
  console.log('建立員工請求:', {
    name,
    type,
    role_primary,
    skills,
    store_id,
    emp_no
  });
  
  // 驗證必填欄位
  if (!name || !type || !role_primary) {
    console.error('必填欄位缺失:', { name, type, role_primary });
    return res.status(400).json({ error: '姓名、類型和主要職位為必填欄位' });
  }
  
  // 驗證類型值
  if (!['fulltime', 'pt'].includes(type)) {
    console.error('無效的員工類型:', type);
    return res.status(400).json({ error: '員工類型必須為 fulltime 或 pt' });
  }
  
  // 驗證主要職位值
  const validRoles = ['cashier', 'reception', 'runner', 'tea_service', 'control', 'plating', 'clearing', 'beverage'];
  if (!validRoles.includes(role_primary)) {
    console.error('無效的主要職位:', role_primary);
    return res.status(400).json({ error: '主要職位無效' });
  }
  
  db.run(`INSERT INTO employees (name, type, role_primary, skills, store_id, emp_no) 
          VALUES (?, ?, ?, ?, ?, ?)`,
    [name, type, role_primary, JSON.stringify(skills || []), store_id, emp_no],
    function(err) {
      if (err) {
        console.error('建立員工資料庫錯誤:', err.message);
        console.error('SQL 錯誤詳情:', err);
        
        // 檢查是否為唯一約束錯誤
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: '員工編號已存在，請使用其他編號' });
        }
        
        return res.status(500).json({ error: '建立員工失敗: ' + err.message });
      }
      console.log('員工建立成功，ID:', this.lastID);
      res.json({ id: this.lastID, message: '員工建立成功' });
    }
  );
});

// 更新員工
app.put('/api/employees/:id', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const employeeId = req.params.id;
  const { name, type, role_primary, skills, emp_no } = req.body;
  
  console.log('更新員工請求:', {
    employeeId,
    name,
    type,
    role_primary,
    skills,
    emp_no
  });
  
  db.run(`UPDATE employees 
          SET name = ?, type = ?, role_primary = ?, skills = ?, emp_no = ?
          WHERE id = ?`,
    [name, type, role_primary, JSON.stringify(skills || []), emp_no, employeeId],
    function(err) {
      if (err) {
        console.error('更新員工資料庫錯誤:', err.message);
        console.error('SQL 錯誤詳情:', err);
        return res.status(500).json({ error: '更新員工失敗: ' + err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: '找不到該員工' });
      }
      console.log('員工更新成功，影響行數:', this.changes);
      res.json({ message: '員工更新成功' });
    }
  );
});

// 取得排班表
app.get('/api/schedules', authenticateToken, (req, res) => {
  const storeId = req.user.role === 'admin' ? req.query.store_id : req.user.store_id;
  
  let query = `
    SELECT s.*, st.name as store_name, u.username as created_by_name
    FROM schedules s
    LEFT JOIN stores st ON s.store_id = st.id
    LEFT JOIN users u ON s.created_by = u.id
  `;
  let params = [];
  
  if (storeId) {
    query += ' WHERE s.store_id = ?';
    params.push(storeId);
  }
  
  query += ' ORDER BY s.week_start DESC';
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '資料庫錯誤' });
    }
    res.json(rows);
  });
});

// 建立排班表
app.post('/api/schedules', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const { store_id, week_start } = req.body;
  
  db.run(`INSERT INTO schedules (store_id, week_start, created_by) 
          VALUES (?, ?, ?)`,
    [store_id, week_start, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '建立排班表失敗' });
      }
      res.json({ id: this.lastID, message: '排班表建立成功' });
    }
  );
});

// 自動排班
app.post('/api/schedules/:id/autoplan', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const scheduleId = req.params.id;
  
  // 取得排班表資訊
  db.get('SELECT * FROM schedules WHERE id = ?', [scheduleId], (err, schedule) => {
    if (err) {
      return res.status(500).json({ error: '取得排班表失敗' });
    }
    
    if (!schedule) {
      return res.status(404).json({ error: '找不到排班表' });
    }
    
    // 取得該店鋪的員工
    db.all('SELECT * FROM employees WHERE store_id = ?', [schedule.store_id], (err, employees) => {
      if (err) {
        return res.status(500).json({ error: '取得員工資料失敗' });
      }
      
      // 計算週開始日期
      const weekStart = new Date(schedule.week_start);
      const weekDays = [];
      
      // 生成一週的日期（週一到週日）
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        weekDays.push(date.toISOString().split('T')[0]);
      }
      
      // 崗位配置需求
      const roleRequirements = {
        'cashier': { min: 1, max: 2, priority: 1 },      // 收銀
        'reception': { min: 1, max: 1, priority: 2 },     // 接待
        'tea_service': { min: 1, max: 2, priority: 3 },   // 茶水
        'runner': { min: 1, max: 2, priority: 4 },        // 走餐
        'plating': { min: 1, max: 2, priority: 5 },       // 出餐
        'clearing': { min: 1, max: 2, priority: 6 },      // 撤餐
        'beverage': { min: 1, max: 1, priority: 7 },      // 酒水
        'control': { min: 1, max: 1, priority: 8 }        // 控場
      };
      
      const shifts = [];
      const assignments = [];
      
      // 為每一天的每個班次建立排班
      weekDays.forEach((date, dayIndex) => {
        ['AM', 'PM'].forEach(slot => {
          // 建立班次記錄 - 使用數字 ID
          const shiftId = parseInt(scheduleId) * 1000 + dayIndex * 2 + (slot === 'AM' ? 0 : 1);
          
          // 隨機選擇員工進行排班
          const availableEmployees = employees.filter(emp => {
            const skills = JSON.parse(emp.skills || '[]');
            return skills.length > 0;
          });
          
          // 按崗位優先級分配員工
          const assignedRoles = new Set();
          const shiftAssignments = [];
          
          Object.entries(roleRequirements).forEach(([role, req]) => {
            if (assignedRoles.has(role)) return;
            
            // 找到適合此崗位的員工
            const suitableEmployees = availableEmployees.filter(emp => {
              const skills = JSON.parse(emp.skills || '[]');
              return skills.includes(role) && !shiftAssignments.some(a => a.employee_id === emp.id);
            });
            
            if (suitableEmployees.length > 0) {
              // 隨機選擇一個員工
              const selectedEmployee = suitableEmployees[Math.floor(Math.random() * suitableEmployees.length)];
              
              // 決定工作時間
              const startTime = slot === 'AM' ? '09:00' : '17:00';
              const endTime = slot === 'AM' ? '17:00' : '01:00';
              
              shiftAssignments.push({
                shift_id: shiftId,
                employee_id: selectedEmployee.id,
                role: role,
                start_time: startTime,
                end_time: endTime,
                break_minutes: 120,
                regular_hours: slot === 'AM' ? 8 : 8,
                overtime_hours: 0,
                consec_days: 1,
                locked: false,
                notes: `自動排班 - ${role}`
              });
              
              assignedRoles.add(role);
            }
          });
          
          // 插入班次記錄
          shifts.push({
            id: shiftId,
            store_id: schedule.store_id,
            date: date,
            slot: slot,
            min_cashier: 1,
            min_server: 1,
            min_kitchen: 1,
            min_support: 1
          });
          
          // 插入排班指派
          assignments.push(...shiftAssignments);
        });
      });
      
      // 先清除現有的排班資料
      db.run('DELETE FROM assignments WHERE shift_id IN (SELECT id FROM shifts WHERE store_id = ?)', [schedule.store_id], (err) => {
        if (err) {
          console.error('清除現有排班失敗:', err);
        }
        
        db.run('DELETE FROM shifts WHERE store_id = ?', [schedule.store_id], (err) => {
          if (err) {
            console.error('清除現有班次失敗:', err);
          }
          
          // 插入新的班次資料
          const shiftInsert = 'INSERT INTO shifts (id, store_id, date, slot, min_cashier, min_server, min_kitchen, min_support) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
          let completedShifts = 0;
          
          shifts.forEach(shift => {
            db.run(shiftInsert, [
              shift.id, shift.store_id, shift.date, shift.slot,
              shift.min_cashier, shift.min_server, shift.min_kitchen, shift.min_support
            ], (err) => {
              if (err) {
                console.error('插入班次失敗:', err);
              }
              
              completedShifts++;
              if (completedShifts === shifts.length) {
                // 插入排班指派
                const assignmentInsert = 'INSERT INTO assignments (shift_id, employee_id, role, start_time, end_time, break_minutes, regular_hours, overtime_hours, consec_days, locked, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
                let completedAssignments = 0;
                
                assignments.forEach(assignment => {
                  db.run(assignmentInsert, [
                    assignment.shift_id, assignment.employee_id, assignment.role,
                    assignment.start_time, assignment.end_time, assignment.break_minutes,
                    assignment.regular_hours, assignment.overtime_hours, assignment.consec_days,
                    assignment.locked ? 1 : 0, assignment.notes
                  ], (err) => {
                    if (err) {
                      console.error('插入排班指派失敗:', err);
                    }
                    
                    completedAssignments++;
                    if (completedAssignments === assignments.length) {
                      res.json({ 
                        scheduleId: parseInt(scheduleId),
                        message: '自動排班完成',
                        shiftsCreated: shifts.length,
                        assignmentsCreated: assignments.length,
                        warnings: ['排班已自動生成，請檢查並調整'] 
                      });
                    }
                  });
                });
              }
            });
          });
        });
      });
    });
  });
});

// 取得排班細節
app.get('/api/schedules/:id/details', authenticateToken, (req, res) => {
  const scheduleId = req.params.id;
  
  const query = `
    SELECT 
      sh.date,
      sh.slot,
      sh.id as shift_id,
      GROUP_CONCAT(
        e.name || '|' || a.role || '|' || e.emp_no, 
        '||'
      ) as assignments
    FROM shifts sh
    LEFT JOIN assignments a ON sh.id = a.shift_id
    LEFT JOIN employees e ON a.employee_id = e.id
    WHERE sh.store_id = (SELECT store_id FROM schedules WHERE id = ?)
    GROUP BY sh.id, sh.date, sh.slot
    ORDER BY sh.date, sh.slot
  `;
  
  db.all(query, [scheduleId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: '取得排班細節失敗' });
    }
    
    // 處理資料格式
    const processedRows = rows.map(row => {
      const assignments = row.assignments ? 
        row.assignments.split('||').filter(a => a).map(assignment => {
          const [name, role, empNo] = assignment.split('|');
          return { employee_name: name, role_primary: role, emp_no: empNo };
        }) : [];
      
      return {
        date: row.date,
        slot: row.slot,
        shift_id: row.shift_id,
        assignments: assignments
      };
    });
    
    res.json(processedRows);
  });
});

// 提交審核
app.post('/api/schedules/:id/submit', authenticateToken, requireRole(['admin', 'editor']), (req, res) => {
  const scheduleId = req.params.id;
  const { stage } = req.query;
  
  if (!['supervisor', 'area_manager'].includes(stage)) {
    return res.status(400).json({ error: '無效的審核階段' });
  }
  
  // 更新排班表狀態
  const status = stage === 'supervisor' ? 'review1' : 'review2';
  const slaDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小時後
  
  db.run(`UPDATE schedules SET status = ?, sla_deadline_at = ? WHERE id = ?`,
    [status, slaDeadline.toISOString(), scheduleId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '提交審核失敗' });
      }
      
      // 建立審核記錄
      db.run(`INSERT INTO reviews (schedule_id, stage, status) VALUES (?, ?, 'pending')`,
        [scheduleId, stage],
        function(err) {
          if (err) {
            console.error('建立審核記錄錯誤:', err.message);
          }
          res.json({ message: '已提交審核' });
        }
      );
    }
  );
});

// 審核決定
app.post('/api/reviews/:id/decision', authenticateToken, requireRole(['admin', 'approver1', 'approver2']), (req, res) => {
  const reviewId = req.params.id;
  const { status, comment } = req.body;
  
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: '無效的審核狀態' });
  }
  
  db.run(`UPDATE reviews SET status = ?, comment = ?, decided_by = ?, decided_at = CURRENT_TIMESTAMP 
          WHERE id = ?`,
    [status, comment, req.user.id, reviewId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '審核決定失敗' });
      }
      res.json({ message: '審核決定已記錄' });
    }
  );
});

// 匯出 PDF
app.post('/api/exports/:id/pdf', authenticateToken, (req, res) => {
  const scheduleId = req.params.id;
  
  // 這裡實作 PDF 匯出邏輯
  // 暫時回傳成功訊息
  res.json({ 
    exportId: Date.now(), 
    url: `/exports/schedule_${scheduleId}.pdf`,
    message: 'PDF 匯出成功' 
  });
});

// 匯出 CSV
app.post('/api/exports/:id/csv', authenticateToken, (req, res) => {
  const scheduleId = req.params.id;
  
  // 這裡實作 CSV 匯出邏輯
  // 暫時回傳成功訊息
  res.json({ 
    exportId: Date.now(), 
    url: `/exports/schedule_${scheduleId}.csv`,
    message: 'CSV 匯出成功' 
  });
});

// 定時任務：檢查 SLA 逾時
cron.schedule('0 */1 * * *', () => {
  console.log('檢查 SLA 逾時...');
  
  db.all(`SELECT * FROM schedules 
          WHERE status IN ('review1', 'review2') 
          AND sla_deadline_at < datetime('now')`,
    (err, rows) => {
      if (err) {
        console.error('檢查 SLA 逾時錯誤:', err.message);
        return;
      }
      
      rows.forEach(schedule => {
        // 自動核可
        const nextStatus = schedule.status === 'review1' ? 'review2' : 'published';
        const nextSlaDeadline = nextStatus === 'review2' ? 
          new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
        
        db.run(`UPDATE schedules SET status = ?, sla_deadline_at = ? WHERE id = ?`,
          [nextStatus, nextSlaDeadline, schedule.id],
          (err) => {
            if (err) {
              console.error('自動核可失敗:', err.message);
            } else {
              console.log(`排班表 ${schedule.id} 已自動核可`);
            }
          }
        );
      });
    }
  );
});

// 前端路由
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 錯誤處理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '伺服器內部錯誤' });
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`排班工具伺服器運行在 http://localhost:${PORT}`);
});

// 優雅關閉
process.on('SIGINT', () => {
  console.log('正在關閉伺服器...');
  db.close((err) => {
    if (err) {
      console.error('關閉資料庫錯誤:', err.message);
    } else {
      console.log('資料庫連接已關閉');
    }
    process.exit(0);
  });
});
