// 通知服務
class NotificationService {
    constructor() {
        this.config = {
            line: {
                enabled: false,
                channelAccessToken: '',
                channelSecret: ''
            },
            email: {
                enabled: false,
                host: '',
                port: 587,
                secure: false,
                auth: {
                    user: '',
                    pass: ''
                }
            }
        };
        
        this.templates = {
            scheduleSubmitted: {
                subject: '排班表已提交審核',
                line: '📅 排班表已提交審核\n店鋪: {storeName}\n週期: 第{weekNumber}週\n提交者: {submitter}\n請及時審核',
                email: `
                    <h2>排班表審核通知</h2>
                    <p>您好，</p>
                    <p>排班表已提交審核，詳情如下：</p>
                    <ul>
                        <li><strong>店鋪:</strong> {storeName}</li>
                        <li><strong>週期:</strong> 第{weekNumber}週</li>
                        <li><strong>提交者:</strong> {submitter}</li>
                        <li><strong>提交時間:</strong> {submitTime}</li>
                    </ul>
                    <p>請及時登入系統進行審核。</p>
                    <p>系統連結: <a href="{systemUrl}">{systemUrl}</a></p>
                `
            },
            
            scheduleApproved: {
                subject: '排班表已核可',
                line: '✅ 排班表已核可\n店鋪: {storeName}\n週期: 第{weekNumber}週\n審核者: {approver}',
                email: `
                    <h2>排班表核可通知</h2>
                    <p>您好，</p>
                    <p>排班表已通過審核，詳情如下：</p>
                    <ul>
                        <li><strong>店鋪:</strong> {storeName}</li>
                        <li><strong>週期:</strong> 第{weekNumber}週</li>
                        <li><strong>審核者:</strong> {approver}</li>
                        <li><strong>審核時間:</strong> {approveTime}</li>
                    </ul>
                    <p>排班表現已發布，員工可查看個人班表。</p>
                `
            },
            
            scheduleRejected: {
                subject: '排班表已退回',
                line: '❌ 排班表已退回\n店鋪: {storeName}\n週期: 第{weekNumber}週\n審核者: {approver}\n原因: {reason}',
                email: `
                    <h2>排班表退回通知</h2>
                    <p>您好，</p>
                    <p>排班表已被退回，詳情如下：</p>
                    <ul>
                        <li><strong>店鋪:</strong> {storeName}</li>
                        <li><strong>週期:</strong> 第{weekNumber}週</li>
                        <li><strong>審核者:</strong> {approver}</li>
                        <li><strong>退回時間:</strong> {rejectTime}</li>
                        <li><strong>退回原因:</strong> {reason}</li>
                    </ul>
                    <p>請根據審核意見修改排班表後重新提交。</p>
                `
            },
            
            schedulePublished: {
                subject: '排班表已發布',
                line: '📢 排班表已發布\n店鋪: {storeName}\n週期: 第{weekNumber}週\n請查看個人班表',
                email: `
                    <h2>排班表發布通知</h2>
                    <p>您好，</p>
                    <p>本週排班表已發布，請查看您的班表：</p>
                    <ul>
                        <li><strong>店鋪:</strong> {storeName}</li>
                        <li><strong>週期:</strong> 第{weekNumber}週</li>
                        <li><strong>發布時間:</strong> {publishTime}</li>
                    </ul>
                    <p>如有疑問，請聯繫排班負責人。</p>
                `
            },
            
            slaReminder: {
                subject: '排班審核提醒',
                line: '⏰ 排班審核提醒\n店鋪: {storeName}\n週期: 第{weekNumber}週\n剩餘時間: {remainingTime}',
                email: `
                    <h2>排班審核提醒</h2>
                    <p>您好，</p>
                    <p>有排班表等待您的審核，請及時處理：</p>
                    <ul>
                        <li><strong>店鋪:</strong> {storeName}</li>
                        <li><strong>週期:</strong> 第{weekNumber}週</li>
                        <li><strong>剩餘時間:</strong> {remainingTime}</li>
                    </ul>
                    <p>如未及時審核，系統將自動核可。</p>
                `
            },
            
            overtimeAlert: {
                subject: '加班警示',
                line: '⚠️ 加班警示\n員工: {employeeName}\n日期: {date}\n工時: {workHours}小時',
                email: `
                    <h2>加班警示</h2>
                    <p>您好，</p>
                    <p>以下員工工時超過標準：</p>
                    <ul>
                        <li><strong>員工:</strong> {employeeName}</li>
                        <li><strong>日期:</strong> {date}</li>
                        <li><strong>工時:</strong> {workHours}小時</li>
                        <li><strong>類型:</strong> {employeeType}</li>
                    </ul>
                    <p>請檢查排班安排是否合理。</p>
                `
            }
        };
    }

    // 設定通知配置
    setConfig(config) {
        this.config = { ...this.config, ...config };
    }

    // 發送通知
    async sendNotification(type, recipients, data) {
        const template = this.templates[type];
        if (!template) {
            throw new Error(`未知的通知類型: ${type}`);
        }

        const results = [];
        
        for (const recipient of recipients) {
            try {
                // 準備通知內容
                const content = this.prepareContent(template, data);
                
                // 發送 LINE 通知
                if (this.config.line.enabled && recipient.lineId) {
                    const lineResult = await this.sendLineNotification(recipient.lineId, content.line);
                    results.push({ type: 'line', recipient: recipient.lineId, success: lineResult });
                }
                
                // 發送 Email 通知
                if (this.config.email.enabled && recipient.email) {
                    const emailResult = await this.sendEmailNotification(recipient.email, content.subject, content.email);
                    results.push({ type: 'email', recipient: recipient.email, success: emailResult });
                }
                
            } catch (error) {
                console.error('發送通知失敗:', error);
                results.push({ 
                    type: 'error', 
                    recipient: recipient, 
                    success: false, 
                    error: error.message 
                });
            }
        }
        
        return results;
    }

    // 準備通知內容
    prepareContent(template, data) {
        const replaceVariables = (text) => {
            return text.replace(/\{(\w+)\}/g, (match, key) => {
                return data[key] || match;
            });
        };

        return {
            subject: replaceVariables(template.subject),
            line: replaceVariables(template.line),
            email: replaceVariables(template.email)
        };
    }

    // 發送 LINE 通知
    async sendLineNotification(userId, message) {
        if (!this.config.line.enabled) {
            console.log('LINE 通知未啟用');
            return false;
        }

        try {
            const response = await fetch('https://api.line.me/v2/bot/message/push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.line.channelAccessToken}`
                },
                body: JSON.stringify({
                    to: userId,
                    messages: [{
                        type: 'text',
                        text: message
                    }]
                })
            });

            return response.ok;
        } catch (error) {
            console.error('LINE 通知發送失敗:', error);
            return false;
        }
    }

    // 發送 Email 通知
    async sendEmailNotification(to, subject, htmlContent) {
        if (!this.config.email.enabled) {
            console.log('Email 通知未啟用');
            return false;
        }

        try {
            // 這裡需要實作 Email 發送邏輯
            // 可以使用 nodemailer 或其他 Email 服務
            console.log(`發送 Email 到 ${to}: ${subject}`);
            return true;
        } catch (error) {
            console.error('Email 通知發送失敗:', error);
            return false;
        }
    }

    // 排班提交通知
    async notifyScheduleSubmitted(schedule, submitter) {
        const data = {
            storeName: schedule.store_name,
            weekNumber: this.getWeekNumber(schedule.week_start),
            submitter: submitter.username,
            submitTime: new Date().toLocaleString('zh-TW'),
            systemUrl: window.location.origin
        };

        // 取得需要通知的審核者
        const approvers = await this.getApprovers(schedule.store_id, 'supervisor');
        
        return this.sendNotification('scheduleSubmitted', approvers, data);
    }

    // 排班核可通知
    async notifyScheduleApproved(schedule, approver) {
        const data = {
            storeName: schedule.store_name,
            weekNumber: this.getWeekNumber(schedule.week_start),
            approver: approver.username,
            approveTime: new Date().toLocaleString('zh-TW')
        };

        // 通知排班負責人和員工
        const recipients = await this.getScheduleRecipients(schedule);
        
        return this.sendNotification('scheduleApproved', recipients, data);
    }

    // 排班退回通知
    async notifyScheduleRejected(schedule, approver, reason) {
        const data = {
            storeName: schedule.store_name,
            weekNumber: this.getWeekNumber(schedule.week_start),
            approver: approver.username,
            rejectTime: new Date().toLocaleString('zh-TW'),
            reason: reason || '未提供原因'
        };

        // 通知排班負責人
        const creator = await this.getScheduleCreator(schedule.created_by);
        
        return this.sendNotification('scheduleRejected', [creator], data);
    }

    // 排班發布通知
    async notifySchedulePublished(schedule) {
        const data = {
            storeName: schedule.store_name,
            weekNumber: this.getWeekNumber(schedule.week_start),
            publishTime: new Date().toLocaleString('zh-TW')
        };

        // 通知所有相關員工
        const employees = await this.getScheduleEmployees(schedule);
        
        return this.sendNotification('schedulePublished', employees, data);
    }

    // SLA 提醒通知
    async notifySlaReminder(schedule, remainingTime) {
        const data = {
            storeName: schedule.store_name,
            weekNumber: this.getWeekNumber(schedule.week_start),
            remainingTime: remainingTime
        };

        // 取得當前階段的審核者
        const stage = schedule.status === 'review1' ? 'supervisor' : 'area_manager';
        const approvers = await this.getApprovers(schedule.store_id, stage);
        
        return this.sendNotification('slaReminder', approvers, data);
    }

    // 加班警示通知
    async notifyOvertimeAlert(employee, date, workHours) {
        const data = {
            employeeName: employee.name,
            date: date,
            workHours: workHours,
            employeeType: employee.type === 'fulltime' ? '正職' : 'PT'
        };

        // 通知管理層
        const managers = await this.getManagers(employee.store_id);
        
        return this.sendNotification('overtimeAlert', managers, data);
    }

    // 取得審核者
    async getApprovers(storeId, stage) {
        // 這裡應該從資料庫查詢
        // 暫時回傳模擬資料
        return [
            {
                email: 'supervisor@example.com',
                lineId: 'U1234567890'
            }
        ];
    }

    // 取得排班相關人員
    async getScheduleRecipients(schedule) {
        // 這裡應該從資料庫查詢
        return [
            {
                email: 'creator@example.com',
                lineId: 'U0987654321'
            }
        ];
    }

    // 取得排班建立者
    async getScheduleCreator(creatorId) {
        // 這裡應該從資料庫查詢
        return {
            email: 'creator@example.com',
            lineId: 'U0987654321'
        };
    }

    // 取得排班員工
    async getScheduleEmployees(schedule) {
        // 這裡應該從資料庫查詢
        return [
            {
                email: 'employee1@example.com',
                lineId: 'U1111111111'
            },
            {
                email: 'employee2@example.com',
                lineId: 'U2222222222'
            }
        ];
    }

    // 取得管理層
    async getManagers(storeId) {
        // 這裡應該從資料庫查詢
        return [
            {
                email: 'manager@example.com',
                lineId: 'U3333333333'
            }
        ];
    }

    // 取得週數
    getWeekNumber(dateString) {
        const date = new Date(dateString);
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
        return Math.ceil((days + startOfYear.getDay() + 1) / 7);
    }

    // 建立通知記錄
    async createNotificationLog(type, recipients, content, results) {
        const log = {
            type,
            recipients: recipients.map(r => ({ 
                email: r.email, 
                lineId: r.lineId 
            })),
            content,
            results,
            timestamp: new Date().toISOString()
        };

        // 這裡應該儲存到資料庫
        console.log('通知記錄:', log);
        return log;
    }

    // 取得通知歷史
    async getNotificationHistory(limit = 50) {
        // 這裡應該從資料庫查詢
        return [];
    }

    // 測試通知功能
    async testNotification(type = 'scheduleSubmitted') {
        const testData = {
            storeName: '測試店鋪',
            weekNumber: 1,
            submitter: '測試使用者',
            submitTime: new Date().toLocaleString('zh-TW'),
            systemUrl: 'http://localhost:3000'
        };

        const testRecipients = [
            {
                email: 'test@example.com',
                lineId: 'U1234567890'
            }
        ];

        try {
            const results = await this.sendNotification(type, testRecipients, testData);
            console.log('測試通知結果:', results);
            return results;
        } catch (error) {
            console.error('測試通知失敗:', error);
            throw error;
        }
    }
}

// 匯出通知服務
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationService;
} else {
    window.NotificationService = NotificationService;
}
