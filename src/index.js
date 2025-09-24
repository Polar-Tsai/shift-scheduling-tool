// 全域變數
let currentUser = null;
let authToken = null;

// API 基礎類別
class API {
    constructor() {
        this.baseURL = '/api';
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (authToken) {
            config.headers.Authorization = `Bearer ${authToken}`;
        }

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '請求失敗');
            }

            return data;
        } catch (error) {
            console.error('API 請求錯誤:', error);
            throw error;
        }
    }

    // 登入
    async login(username, password) {
        return this.request('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    }

    // 取得使用者資訊
    async getUser() {
        return this.request('/user');
    }

    // 取得店鋪列表
    async getStores() {
        return this.request('/stores');
    }

    // 取得員工列表
    async getEmployees(storeId = null) {
        const params = storeId ? `?store_id=${storeId}` : '';
        return this.request(`/employees${params}`);
    }

    // 建立員工
    async createEmployee(employeeData) {
        return this.request('/employees', {
            method: 'POST',
            body: JSON.stringify(employeeData)
        });
    }

    // 更新員工
    async updateEmployee(employeeId, employeeData) {
        return this.request(`/employees/${employeeId}`, {
            method: 'PUT',
            body: JSON.stringify(employeeData)
        });
    }

    // 取得排班表
    async getSchedules(storeId = null) {
        const params = storeId ? `?store_id=${storeId}` : '';
        return this.request(`/schedules${params}`);
    }

    // 建立排班表
    async createSchedule(scheduleData) {
        return this.request('/schedules', {
            method: 'POST',
            body: JSON.stringify(scheduleData)
        });
    }

    // 自動排班
    async autoPlan(scheduleId) {
        return this.request(`/schedules/${scheduleId}/autoplan`, {
            method: 'POST'
        });
    }

    // 提交審核
    async submitForReview(scheduleId, stage) {
        return this.request(`/schedules/${scheduleId}/submit?stage=${stage}`, {
            method: 'POST'
        });
    }

    // 審核決定
    async reviewDecision(reviewId, status, comment = '') {
        return this.request(`/reviews/${reviewId}/decision`, {
            method: 'POST',
            body: JSON.stringify({ status, comment })
        });
    }

    // 匯出 PDF
    async exportPDF(scheduleId) {
        return this.request(`/exports/${scheduleId}/pdf`, {
            method: 'POST'
        });
    }

    // 匯出 CSV
    async exportCSV(scheduleId) {
        return this.request(`/exports/${scheduleId}/csv`, {
            method: 'POST'
        });
    }
}

// 建立 API 實例
const api = new API();

// 工具函數
const utils = {
    // 顯示錯誤訊息
    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.classList.remove('hidden');
            setTimeout(() => {
                element.classList.add('hidden');
            }, 5000);
        }
    },

    // 顯示成功訊息
    showSuccess(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.classList.remove('hidden');
            setTimeout(() => {
                element.classList.add('hidden');
            }, 3000);
        }
    },

    // 格式化日期
    formatDate(date) {
        return new Date(date).toLocaleDateString('zh-TW');
    },

    // 格式化時間
    formatTime(time) {
        return new Date(`2000-01-01T${time}`).toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    // 計算工時
    calculateWorkHours(startTime, endTime, breakMinutes = 120) {
        const start = new Date(`2000-01-01T${startTime}`);
        const end = new Date(`2000-01-01T${endTime}`);
        const workMinutes = (end - start) / (1000 * 60) - breakMinutes;
        const workHours = workMinutes / 60;
        const regularHours = Math.min(workHours, 8);
        const overtimeHours = Math.max(workHours - 8, 0);
        
        return {
            total: workHours,
            regular: regularHours,
            overtime: overtimeHours
        };
    },

    // 檢查權限
    hasPermission(requiredRoles) {
        return currentUser && requiredRoles.includes(currentUser.role);
    }
};

// 應用程式主類別
class SchedulingApp {
    constructor() {
        this.currentPage = 'dashboard';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuth();
    }

    setupEventListeners() {
        // 登入表單
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }

        // 登出按鈕
        const logoutBtn = document.getElementById('navLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }

        // 導航連結
        const navLinks = document.querySelectorAll('.nav-link[data-page]');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.target.closest('.nav-link').dataset.page;
                this.navigateToPage(page);
            });
        });
    }

    async checkAuth() {
        const token = localStorage.getItem('authToken');
        if (token) {
            authToken = token;
            try {
                currentUser = await api.getUser();
                this.showMainApp();
                this.loadDashboard();
            } catch (error) {
                this.logout();
            }
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('loginBtn');

        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登入中...';

        try {
            const response = await api.login(username, password);
            authToken = response.token;
            currentUser = response.user;
            
            localStorage.setItem('authToken', authToken);
            this.showMainApp();
            this.loadDashboard();
            
            utils.showSuccess('loginSuccess', '登入成功！');
        } catch (error) {
            utils.showError('loginError', error.message);
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 登入';
        }
    }

    handleLogout() {
        this.logout();
    }

    logout() {
        authToken = null;
        currentUser = null;
        localStorage.removeItem('authToken');
        this.showLoginPage();
    }

    showLoginPage() {
        document.getElementById('loginPage').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
    }

    showMainApp() {
        document.getElementById('loginPage').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        
        // 更新使用者名稱
        const userNameElement = document.getElementById('userName');
        if (userNameElement && currentUser) {
            userNameElement.textContent = currentUser.username;
        }
    }

    navigateToPage(page) {
        // 更新導航狀態
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-page="${page}"]`).classList.add('active');

        // 隱藏所有頁面
        document.querySelectorAll('.page').forEach(pageElement => {
            pageElement.classList.add('hidden');
        });

        // 顯示目標頁面
        document.getElementById(`${page}Page`).classList.remove('hidden');
        this.currentPage = page;

        // 載入頁面資料
        switch (page) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'schedule':
                this.loadSchedule();
                break;
            case 'employees':
                this.loadEmployees();
                break;
            case 'approval':
                this.loadApproval();
                break;
            case 'export':
                this.loadExport();
                break;
        }
    }

    async loadDashboard() {
        try {
            // 載入統計資料
            const [employees, schedules] = await Promise.all([
                api.getEmployees(),
                api.getSchedules()
            ]);

            // 更新統計數字
            document.getElementById('totalEmployees').textContent = employees.length;
            
            const pendingSchedules = schedules.filter(s => 
                s.status === 'review1' || s.status === 'review2'
            ).length;
            document.getElementById('pendingSchedules').textContent = pendingSchedules;

            // 載入本週班表
            this.renderWeeklySchedule(schedules);
            
            // 載入警示事項
            this.renderAlerts(employees, schedules);

        } catch (error) {
            console.error('載入看板資料錯誤:', error);
        }
    }

    renderWeeklySchedule(schedules) {
        const container = document.getElementById('weeklySchedule');
        
        if (schedules.length === 0) {
            container.innerHTML = '<p>尚無排班資料</p>';
            return;
        }

        const currentWeek = this.getCurrentWeek();
        const thisWeekSchedules = schedules.filter(s => 
            s.week_start === currentWeek
        );

        if (thisWeekSchedules.length === 0) {
            container.innerHTML = '<p>本週尚未建立排班</p>';
            return;
        }

        const schedule = thisWeekSchedules[0];
        container.innerHTML = `
            <div class="schedule-info">
                <h3>${schedule.store_name} - 第 ${this.getWeekNumber(schedule.week_start)} 週</h3>
                <p>狀態: <span class="status-${schedule.status}">${this.getStatusText(schedule.status)}</span></p>
                <p>建立者: ${schedule.created_by_name}</p>
                <p>建立時間: ${utils.formatDate(schedule.created_at)}</p>
            </div>
        `;
    }

    renderAlerts(employees, schedules) {
        const container = document.getElementById('alerts');
        const alerts = [];

        // 檢查待審核排班
        const pendingSchedules = schedules.filter(s => 
            s.status === 'review1' || s.status === 'review2'
        );

        if (pendingSchedules.length > 0) {
            alerts.push({
                type: 'warning',
                message: `有 ${pendingSchedules.length} 個排班等待審核`
            });
        }

        // 檢查 SLA 逾時
        const overdueSchedules = schedules.filter(s => {
            if (s.status === 'review1' || s.status === 'review2') {
                const deadline = new Date(s.sla_deadline_at);
                return deadline < new Date();
            }
            return false;
        });

        if (overdueSchedules.length > 0) {
            alerts.push({
                type: 'error',
                message: `有 ${overdueSchedules.length} 個排班審核逾時`
            });
        }

        // 檢查員工數量
        if (employees.length < 5) {
            alerts.push({
                type: 'info',
                message: '員工數量較少，建議增加人手'
            });
        }

        if (alerts.length === 0) {
            container.innerHTML = '<p class="text-success">目前無警示事項</p>';
            return;
        }

        container.innerHTML = alerts.map(alert => `
            <div class="alert alert-${alert.type}">
                <i class="fas fa-${this.getAlertIcon(alert.type)}"></i>
                ${alert.message}
            </div>
        `).join('');
    }

    getAlertIcon(type) {
        const icons = {
            warning: 'exclamation-triangle',
            error: 'times-circle',
            info: 'info-circle',
            success: 'check-circle'
        };
        return icons[type] || 'info-circle';
    }

    getStatusText(status) {
        const statusMap = {
            draft: '草稿',
            review1: '外場主管審核中',
            review2: '區經理審核中',
            published: '已發布'
        };
        return statusMap[status] || status;
    }

    getCurrentWeek() {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1); // 週一開始
        return startOfWeek.toISOString().split('T')[0];
    }

    getWeekNumber(dateString) {
        const date = new Date(dateString);
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
        return Math.ceil((days + startOfYear.getDay() + 1) / 7);
    }

    async loadSchedule() {
        const container = document.getElementById('scheduleContent');
        container.innerHTML = `
            <div class="schedule-management">
                <div class="schedule-actions">
                    <button class="btn" onclick="app.createNewSchedule()">
                        <i class="fas fa-plus"></i> 建立新排班
                    </button>
                    <button class="btn" onclick="app.loadExistingSchedules()">
                        <i class="fas fa-list"></i> 查看現有排班
                    </button>
                </div>
                <div id="scheduleList" class="schedule-list">
                    <p>點擊上方按鈕開始操作</p>
                </div>
            </div>
        `;
    }

    async createNewSchedule() {
        try {
            const stores = await api.getStores();
            const currentWeek = this.getCurrentWeek();
            
            const storeSelect = stores.map(store => 
                `<option value="${store.id}">${store.name}</option>`
            ).join('');

            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>建立新排班</h3>
                    <form id="newScheduleForm">
                        <div class="form-group">
                            <label for="storeSelect">選擇店鋪</label>
                            <select id="storeSelect" required>
                                ${storeSelect}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="weekStart">週開始日期</label>
                            <input type="date" id="weekStart" value="${currentWeek}" required>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
                            <button type="submit" class="btn">建立</button>
                        </div>
                    </form>
                </div>
            `;

            document.body.appendChild(modal);

            document.getElementById('newScheduleForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const storeId = document.getElementById('storeSelect').value;
                const weekStart = document.getElementById('weekStart').value;

                try {
                    await api.createSchedule({ store_id: storeId, week_start: weekStart });
                    modal.remove();
                    this.loadExistingSchedules();
                    utils.showSuccess('scheduleSuccess', '排班建立成功！');
                } catch (error) {
                    utils.showError('scheduleError', error.message);
                }
            });

        } catch (error) {
            utils.showError('scheduleError', '載入店鋪資料失敗');
        }
    }

    async loadExistingSchedules() {
        try {
            const schedules = await api.getSchedules();
            const container = document.getElementById('scheduleList');
            
            if (schedules.length === 0) {
                container.innerHTML = '<p>尚無排班資料</p>';
                return;
            }

            container.innerHTML = schedules.map(schedule => `
                <div class="schedule-item">
                    <h4>${schedule.store_name} - 第 ${this.getWeekNumber(schedule.week_start)} 週</h4>
                    <p>狀態: <span class="status-${schedule.status}">${this.getStatusText(schedule.status)}</span></p>
                    <p>建立者: ${schedule.created_by_name}</p>
                    <p>建立時間: ${utils.formatDate(schedule.created_at)}</p>
                    <div class="schedule-actions">
                        ${this.getScheduleActions(schedule)}
                    </div>
                </div>
            `).join('');

        } catch (error) {
            console.error('載入排班列表錯誤:', error);
        }
    }

    getScheduleActions(schedule) {
        const actions = [];
        
        if (schedule.status === 'draft') {
            actions.push(`<button class="btn btn-sm" onclick="app.autoPlan(${schedule.id})">自動排班</button>`);
            actions.push(`<button class="btn btn-sm" onclick="app.submitForReview(${schedule.id}, 'supervisor')">提交審核</button>`);
        }
        
        if (schedule.status === 'review1' && utils.hasPermission(['admin', 'approver1'])) {
            actions.push(`<button class="btn btn-sm btn-success" onclick="app.approveSchedule(${schedule.id})">核可</button>`);
            actions.push(`<button class="btn btn-sm btn-danger" onclick="app.rejectSchedule(${schedule.id})">退回</button>`);
        }
        
        if (schedule.status === 'review2' && utils.hasPermission(['admin', 'approver2'])) {
            actions.push(`<button class="btn btn-sm btn-success" onclick="app.approveSchedule(${schedule.id})">核可</button>`);
            actions.push(`<button class="btn btn-sm btn-danger" onclick="app.rejectSchedule(${schedule.id})">退回</button>`);
        }
        
        if (schedule.status === 'published') {
            actions.push(`<button class="btn btn-sm" onclick="app.exportPDF(${schedule.id})">匯出 PDF</button>`);
            actions.push(`<button class="btn btn-sm" onclick="app.exportCSV(${schedule.id})">匯出 CSV</button>`);
        }
        
        return actions.join(' ');
    }

    async loadEmployees() {
        const container = document.getElementById('employeesContent');
        container.innerHTML = `
            <div class="employees-management">
                <div class="employees-actions">
                    <button class="btn" onclick="app.showAddEmployeeModal()">
                        <i class="fas fa-plus"></i> 新增員工
                    </button>
                </div>
                <div id="employeesList" class="employees-list">
                    <p>載入中...</p>
                </div>
            </div>
        `;

        try {
            const employees = await api.getEmployees();
            this.renderEmployeesList(employees);
        } catch (error) {
            console.error('載入員工列表錯誤:', error);
        }
    }

    renderEmployeesList(employees) {
        const container = document.getElementById('employeesList');
        
        if (employees.length === 0) {
            container.innerHTML = '<p>尚無員工資料</p>';
            return;
        }

        container.innerHTML = `
            <table class="employees-table">
                <thead>
                    <tr>
                        <th>員工編號</th>
                        <th>姓名</th>
                        <th>類型</th>
                        <th>擅長崗位</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${employees.map(emp => `
                        <tr>
                            <td>${emp.emp_no || '-'}</td>
                            <td>${emp.name}</td>
                            <td>${emp.type === 'fulltime' ? '正職' : 'PT'}</td>
                            <td>${this.getSkillsText(emp.skills)}</td>
                            <td>
                                <button class="btn btn-sm" onclick="app.editEmployee(${emp.id})">編輯</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    getRoleText(role) {
        const roleMap = {
            cashier: '收銀',
            reception: '接待',
            runner: '走餐',
            tea_service: '茶水',
            control: '控場',
            plating: '出餐',
            clearing: '撤餐',
            beverage: '酒水'
        };
        return roleMap[role] || role;
    }

    getSkillsText(skills) {
        if (!skills) return '-';
        const skillsArray = typeof skills === 'string' ? JSON.parse(skills) : skills;
        const roleMap = {
            cashier: '收銀',
            reception: '接待',
            runner: '走餐',
            tea_service: '茶水',
            control: '控場',
            plating: '出餐',
            clearing: '撤餐',
            beverage: '酒水'
        };
        return skillsArray.map(skill => roleMap[skill] || skill).join(', ');
    }

    async showAddEmployeeModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3><i class="fas fa-user-plus"></i> 新增員工</h3>
                    <button type="button" class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <form id="addEmployeeForm">
                    <div class="form-group">
                        <label for="empName">姓名 *</label>
                        <input type="text" id="empName" required placeholder="請輸入員工姓名">
                    </div>
                    <div class="form-group">
                        <label for="empType">類型 *</label>
                        <select id="empType" required>
                            <option value="">請選擇類型</option>
                            <option value="fulltime">正職</option>
                            <option value="pt">PT</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="empNo">員工編號</label>
                        <input type="text" id="empNo" placeholder="請輸入員工編號">
                    </div>
                    <div class="form-group">
                        <label>擅長崗位 *</label>
                        <div class="position-info">
                            <small>前區：收銀、接待 | 中區：茶水、走餐 | 後區：出餐、撤餐、酒水 | 指揮：控場</small>
                        </div>
                        <div class="checkbox-group">
                            <div class="position-section">
                                <h4>前區</h4>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="skills" value="cashier">
                                    <span class="checkmark"></span>
                                    收銀
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="skills" value="reception">
                                    <span class="checkmark"></span>
                                    接待
                                </label>
                            </div>
                            <div class="position-section">
                                <h4>中區</h4>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="skills" value="tea_service">
                                    <span class="checkmark"></span>
                                    茶水
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="skills" value="runner">
                                    <span class="checkmark"></span>
                                    走餐
                                </label>
                            </div>
                            <div class="position-section">
                                <h4>後區</h4>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="skills" value="plating">
                                    <span class="checkmark"></span>
                                    出餐
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="skills" value="clearing">
                                    <span class="checkmark"></span>
                                    撤餐
                                </label>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="skills" value="beverage">
                                    <span class="checkmark"></span>
                                    酒水
                                </label>
                            </div>
                            <div class="position-section">
                                <h4>指揮</h4>
                                <label class="checkbox-label">
                                    <input type="checkbox" name="skills" value="control">
                                    <span class="checkmark"></span>
                                    控場
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times"></i> 取消
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-save"></i> 新增
                        </button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        // 點擊背景關閉視窗
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        document.getElementById('addEmployeeForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // 取得選中的技能
            const selectedSkills = Array.from(document.querySelectorAll('input[name="skills"]:checked'))
                .map(checkbox => checkbox.value);
            
            if (selectedSkills.length === 0) {
                alert('請至少選擇一個擅長職位');
                return;
            }
            
            const employeeData = {
                name: document.getElementById('empName').value,
                type: document.getElementById('empType').value,
                role_primary: selectedSkills[0], // 第一個選中的作為主要職位
                skills: selectedSkills,
                emp_no: document.getElementById('empNo').value,
                store_id: currentUser.store_id
            };

            try {
                await api.createEmployee(employeeData);
                modal.remove();
                this.loadEmployees();
                this.showSuccessMessage('員工新增成功！');
            } catch (error) {
                this.showErrorMessage('員工新增失敗：' + error.message);
            }
        });
    }

    async editEmployee(employeeId) {
        try {
            const employees = await api.getEmployees();
            const employee = employees.find(emp => emp.id === employeeId);
            
            if (!employee) {
                this.showErrorMessage('找不到該員工資料');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-user-edit"></i> 編輯員工</h3>
                        <button type="button" class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <form id="editEmployeeForm">
                        <div class="form-group">
                            <label for="editEmpName">姓名 *</label>
                            <input type="text" id="editEmpName" value="${employee.name}" required placeholder="請輸入員工姓名">
                        </div>
                        <div class="form-group">
                            <label for="editEmpType">類型 *</label>
                            <select id="editEmpType" required>
                                <option value="">請選擇類型</option>
                                <option value="fulltime" ${employee.type === 'fulltime' ? 'selected' : ''}>正職</option>
                                <option value="pt" ${employee.type === 'pt' ? 'selected' : ''}>PT</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editEmpNo">員工編號</label>
                            <input type="text" id="editEmpNo" value="${employee.emp_no || ''}" placeholder="請輸入員工編號">
                        </div>
                        <div class="form-group">
                            <label>擅長職位 *</label>
                            <div class="checkbox-group">
                                ${this.getSkillCheckboxes(employee.skills)}
                            </div>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                                <i class="fas fa-times"></i> 取消
                            </button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save"></i> 儲存
                            </button>
                        </div>
                    </form>
                </div>
            `;

            document.body.appendChild(modal);

            // 點擊背景關閉視窗
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });

            document.getElementById('editEmployeeForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // 取得選中的技能
                const selectedSkills = Array.from(document.querySelectorAll('#editEmployeeForm input[name="editSkills"]:checked'))
                    .map(checkbox => checkbox.value);
                
                if (selectedSkills.length === 0) {
                    alert('請至少選擇一個擅長職位');
                    return;
                }
                
                const employeeData = {
                    name: document.getElementById('editEmpName').value,
                    type: document.getElementById('editEmpType').value,
                    role_primary: selectedSkills[0], // 第一個選中的作為主要職位
                    skills: selectedSkills,
                    emp_no: document.getElementById('editEmpNo').value
                };

                try {
                    await api.updateEmployee(employeeId, employeeData);
                    modal.remove();
                    this.loadEmployees();
                    this.showSuccessMessage('員工資料更新成功！');
                } catch (error) {
                    this.showErrorMessage('員工資料更新失敗：' + error.message);
                }
            });

        } catch (error) {
            this.showErrorMessage('載入員工資料失敗：' + error.message);
        }
    }

    getSkillCheckboxes(currentSkills) {
        const skillNames = {
            cashier: '收銀',
            reception: '接待',
            runner: '走餐',
            tea_service: '茶水',
            control: '控場',
            plating: '出餐',
            clearing: '撤餐',
            beverage: '酒水'
        };
        
        const currentSkillsArray = currentSkills ? 
            (typeof currentSkills === 'string' ? JSON.parse(currentSkills) : currentSkills) : [];
        
        return `
            <div class="position-info">
                <small>前區：收銀、接待 | 中區：茶水、走餐 | 後區：出餐、撤餐、酒水 | 指揮：控場</small>
            </div>
            <div class="checkbox-group">
                <div class="position-section">
                    <h4>前區</h4>
                    <label class="checkbox-label">
                        <input type="checkbox" name="editSkills" value="cashier" 
                               ${currentSkillsArray.includes('cashier') ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        收銀
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" name="editSkills" value="reception" 
                               ${currentSkillsArray.includes('reception') ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        接待
                    </label>
                </div>
                <div class="position-section">
                    <h4>中區</h4>
                    <label class="checkbox-label">
                        <input type="checkbox" name="editSkills" value="tea_service" 
                               ${currentSkillsArray.includes('tea_service') ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        茶水
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" name="editSkills" value="runner" 
                               ${currentSkillsArray.includes('runner') ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        走餐
                    </label>
                </div>
                <div class="position-section">
                    <h4>後區</h4>
                    <label class="checkbox-label">
                        <input type="checkbox" name="editSkills" value="plating" 
                               ${currentSkillsArray.includes('plating') ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        出餐
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" name="editSkills" value="clearing" 
                               ${currentSkillsArray.includes('clearing') ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        撤餐
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" name="editSkills" value="beverage" 
                               ${currentSkillsArray.includes('beverage') ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        酒水
                    </label>
                </div>
                <div class="position-section">
                    <h4>指揮</h4>
                    <label class="checkbox-label">
                        <input type="checkbox" name="editSkills" value="control" 
                               ${currentSkillsArray.includes('control') ? 'checked' : ''}>
                        <span class="checkmark"></span>
                        控場
                    </label>
                </div>
            </div>
        `;
    }

    showSuccessMessage(message) {
        // 建立成功訊息元素
        const messageDiv = document.createElement('div');
        messageDiv.className = 'success-message';
        messageDiv.innerHTML = `
            <i class="fas fa-check-circle"></i>
            ${message}
        `;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(messageDiv);
        
        // 3秒後自動移除
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    showErrorMessage(message) {
        // 建立錯誤訊息元素
        const messageDiv = document.createElement('div');
        messageDiv.className = 'error-message';
        messageDiv.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            ${message}
        `;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(messageDiv);
        
        // 5秒後自動移除
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }

    async loadApproval() {
        const container = document.getElementById('approvalContent');
        container.innerHTML = `
            <div class="approval-management">
                <h3>待審核項目</h3>
                <div id="approvalList" class="approval-list">
                    <p>載入中...</p>
                </div>
            </div>
        `;

        try {
            const schedules = await api.getSchedules();
            const pendingSchedules = schedules.filter(s => 
                s.status === 'review1' || s.status === 'review2'
            );
            
            this.renderApprovalList(pendingSchedules);
        } catch (error) {
            console.error('載入審核列表錯誤:', error);
        }
    }

    renderApprovalList(schedules) {
        const container = document.getElementById('approvalList');
        
        if (schedules.length === 0) {
            container.innerHTML = '<p>目前無待審核項目</p>';
            return;
        }

        container.innerHTML = schedules.map(schedule => `
            <div class="approval-item">
                <h4>${schedule.store_name} - 第 ${this.getWeekNumber(schedule.week_start)} 週</h4>
                <p>狀態: ${this.getStatusText(schedule.status)}</p>
                <p>提交時間: ${utils.formatDate(schedule.created_at)}</p>
                ${schedule.sla_deadline_at ? `<p>審核期限: ${utils.formatDate(schedule.sla_deadline_at)}</p>` : ''}
                <div class="approval-actions">
                    <button class="btn btn-success" onclick="app.approveSchedule(${schedule.id})">
                        <i class="fas fa-check"></i> 核可
                    </button>
                    <button class="btn btn-danger" onclick="app.rejectSchedule(${schedule.id})">
                        <i class="fas fa-times"></i> 退回
                    </button>
                </div>
            </div>
        `).join('');
    }

    async loadExport() {
        const container = document.getElementById('exportContent');
        container.innerHTML = `
            <div class="export-management">
                <h3>匯出功能</h3>
                <div class="export-options">
                    <div class="export-option">
                        <h4><i class="fas fa-file-pdf"></i> PDF 紙本版型</h4>
                        <p>匯出適合列印的紙本班表</p>
                        <button class="btn" onclick="app.showExportModal('pdf')">
                            <i class="fas fa-download"></i> 匯出 PDF
                        </button>
                    </div>
                    <div class="export-option">
                        <h4><i class="fas fa-file-csv"></i> CSV 打卡匯入</h4>
                        <p>匯出適合打卡系統匯入的 CSV 檔案</p>
                        <button class="btn" onclick="app.showExportModal('csv')">
                            <i class="fas fa-download"></i> 匯出 CSV
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    async showExportModal(type) {
        try {
            const schedules = await api.getSchedules();
            const publishedSchedules = schedules.filter(s => s.status === 'published');
            
            if (publishedSchedules.length === 0) {
                utils.showError('exportError', '目前無已發布的排班可匯出');
                return;
            }

            const scheduleSelect = publishedSchedules.map(schedule => 
                `<option value="${schedule.id}">${schedule.store_name} - 第 ${this.getWeekNumber(schedule.week_start)} 週</option>`
            ).join('');

            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>匯出 ${type.toUpperCase()}</h3>
                    <form id="exportForm">
                        <div class="form-group">
                            <label for="scheduleSelect">選擇排班</label>
                            <select id="scheduleSelect" required>
                                ${scheduleSelect}
                            </select>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">取消</button>
                            <button type="submit" class="btn">匯出</button>
                        </div>
                    </form>
                </div>
            `;

            document.body.appendChild(modal);

            document.getElementById('exportForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const scheduleId = document.getElementById('scheduleSelect').value;

                try {
                    const result = type === 'pdf' ? 
                        await api.exportPDF(scheduleId) : 
                        await api.exportCSV(scheduleId);
                    
                    modal.remove();
                    utils.showSuccess('exportSuccess', `${type.toUpperCase()} 匯出成功！`);
                    
                    // 建立下載連結
                    const link = document.createElement('a');
                    link.href = result.url;
                    link.download = result.url.split('/').pop();
                    link.click();
                    
                } catch (error) {
                    utils.showError('exportError', error.message);
                }
            });

        } catch (error) {
            utils.showError('exportError', '載入排班資料失敗');
        }
    }

    // 排班相關方法
    async autoPlan(scheduleId) {
        try {
            const result = await api.autoPlan(scheduleId);
            utils.showSuccess('scheduleSuccess', '自動排班完成！');
            if (result.warnings && result.warnings.length > 0) {
                console.warn('排班警告:', result.warnings);
            }
            this.loadExistingSchedules();
        } catch (error) {
            utils.showError('scheduleError', error.message);
        }
    }

    async submitForReview(scheduleId, stage) {
        try {
            await api.submitForReview(scheduleId, stage);
            utils.showSuccess('scheduleSuccess', '已提交審核！');
            this.loadExistingSchedules();
        } catch (error) {
            utils.showError('scheduleError', error.message);
        }
    }

    async approveSchedule(scheduleId) {
        try {
            // 這裡需要實作審核決定 API
            utils.showSuccess('approvalSuccess', '排班已核可！');
            this.loadApproval();
        } catch (error) {
            utils.showError('approvalError', error.message);
        }
    }

    async rejectSchedule(scheduleId) {
        try {
            // 這裡需要實作審核決定 API
            utils.showSuccess('approvalSuccess', '排班已退回！');
            this.loadApproval();
        } catch (error) {
            utils.showError('approvalError', error.message);
        }
    }

    async exportPDF(scheduleId) {
        try {
            const result = await api.exportPDF(scheduleId);
            utils.showSuccess('exportSuccess', 'PDF 匯出成功！');
            
            const link = document.createElement('a');
            link.href = result.url;
            link.download = result.url.split('/').pop();
            link.click();
        } catch (error) {
            utils.showError('exportError', error.message);
        }
    }

    async exportCSV(scheduleId) {
        try {
            const result = await api.exportCSV(scheduleId);
            utils.showSuccess('exportSuccess', 'CSV 匯出成功！');
            
            const link = document.createElement('a');
            link.href = result.url;
            link.download = result.url.split('/').pop();
            link.click();
        } catch (error) {
            utils.showError('exportError', error.message);
        }
    }
}

// 初始化應用程式
const app = new SchedulingApp();

// 全域方法（供 HTML 呼叫）
window.app = app;
