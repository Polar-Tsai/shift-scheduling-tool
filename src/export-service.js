// 匯出服務
class ExportService {
    constructor() {
        this.csvHeaders = [
            'emp_no',
            'date', 
            'start_time',
            'end_time',
            'break_minutes',
            'role',
            'store_id',
            'is_peak',
            'regular_hours',
            'overtime_hours',
            'consec_days',
            'notes'
        ];
    }

    // 匯出 CSV 檔案
    async exportToCSV(scheduleData, storeId, weekStart) {
        const csvData = this.prepareCSVData(scheduleData);
        const csvContent = this.generateCSVContent(csvData);
        const filename = this.generateCSVFilename(storeId, weekStart);
        
        return {
            content: csvContent,
            filename: filename,
            mimeType: 'text/csv;charset=utf-8'
        };
    }

    // 準備 CSV 資料
    prepareCSVData(scheduleData) {
        const csvRows = [];

        scheduleData.assignments.forEach(assignment => {
            const employee = scheduleData.employees.find(emp => emp.id === assignment.employee_id);
            const shift = scheduleData.shifts.find(s => s.id === assignment.shift_id);
            
            if (!employee || !shift) return;

            // 計算工時
            const workHours = this.calculateWorkHours(
                assignment.start_time,
                assignment.end_time,
                assignment.break_minutes
            );

            // 計算連續上班天數
            const consecDays = this.calculateConsecutiveDays(
                assignment.date,
                scheduleData.assignments,
                assignment.employee_id
            );

            // 判斷是否為尖峰時段
            const isPeak = this.isPeakTime(assignment.start_time, assignment.end_time);

            const row = {
                emp_no: employee.emp_no || '',
                date: assignment.date,
                start_time: assignment.start_time,
                end_time: assignment.end_time,
                break_minutes: assignment.break_minutes,
                role: assignment.role,
                store_id: scheduleData.store_id,
                is_peak: isPeak ? (shift.slot === 'AM' ? 'AM' : 'PM') : '',
                regular_hours: workHours.regular.toFixed(2),
                overtime_hours: workHours.overtime.toFixed(2),
                consec_days: consecDays,
                notes: assignment.notes || ''
            };

            csvRows.push(row);
        });

        return csvRows;
    }

    // 產生 CSV 內容
    generateCSVContent(data) {
        const headers = this.csvHeaders.join(',');
        const rows = data.map(row => 
            this.csvHeaders.map(header => {
                const value = row[header] || '';
                // 如果值包含逗號或引號，需要用引號包圍並轉義
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        );

        return [headers, ...rows].join('\n');
    }

    // 產生 CSV 檔名
    generateCSVFilename(storeId, weekStart) {
        const version = 'v1';
        return `${storeId}_${weekStart}_${version}.csv`;
    }

    // 匯出 PDF 檔案
    async exportToPDF(scheduleData, storeId, weekStart) {
        const htmlContent = this.generatePDFHTML(scheduleData);
        
        return {
            content: htmlContent,
            filename: this.generatePDFFilename(storeId, weekStart),
            mimeType: 'text/html'
        };
    }

    // 產生 PDF HTML 內容
    generatePDFHTML(scheduleData) {
        const weekDays = this.getWeekDays(scheduleData.week_start);
        const storeName = scheduleData.store_name || '未知店鋪';
        
        return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>排班表 - ${storeName}</title>
    <style>
        body {
            font-family: 'Microsoft JhengHei', 'PingFang TC', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: white;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
        }
        
        .header h1 {
            margin: 0;
            font-size: 24px;
            color: #333;
        }
        
        .header p {
            margin: 5px 0 0 0;
            font-size: 14px;
            color: #666;
        }
        
        .schedule-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        
        .schedule-table th,
        .schedule-table td {
            border: 1px solid #333;
            padding: 8px;
            text-align: center;
            font-size: 12px;
        }
        
        .schedule-table th {
            background-color: #f5f5f5;
            font-weight: bold;
        }
        
        .employee-row {
            background-color: #fafafa;
        }
        
        .time-slot {
            font-weight: bold;
            color: #333;
        }
        
        .role-tag {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            margin: 1px;
        }
        
        .role-cashier { background-color: #e3f2fd; color: #1976d2; }
        .role-server { background-color: #f3e5f5; color: #7b1fa2; }
        .role-kitchen { background-color: #fff3e0; color: #f57c00; }
        .role-support { background-color: #e8f5e8; color: #388e3c; }
        
        .summary {
            margin-top: 30px;
            border-top: 2px solid #333;
            padding-top: 20px;
        }
        
        .summary h3 {
            margin: 0 0 15px 0;
            font-size: 16px;
            color: #333;
        }
        
        .summary-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .summary-table th,
        .summary-table td {
            border: 1px solid #333;
            padding: 6px;
            text-align: center;
            font-size: 11px;
        }
        
        .summary-table th {
            background-color: #f5f5f5;
            font-weight: bold;
        }
        
        .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #666;
            border-top: 1px solid #ccc;
            padding-top: 10px;
        }
        
        @media print {
            body { margin: 0; padding: 10px; }
            .schedule-table { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${storeName} 排班表</h1>
        <p>第 ${this.getWeekNumber(scheduleData.week_start)} 週 (${weekDays[0]} ~ ${weekDays[6]})</p>
        <p>建立時間: ${new Date().toLocaleString('zh-TW')}</p>
    </div>
    
    ${this.generateScheduleTable(scheduleData, weekDays)}
    
    ${this.generateSummarySection(scheduleData)}
    
    <div class="footer">
        <p>此排班表由排班工具自動產生 | 鉅鋼機械股份有限公司</p>
    </div>
</body>
</html>`;
    }

    // 產生排班表格
    generateScheduleTable(scheduleData, weekDays) {
        const employees = scheduleData.employees;
        const assignments = scheduleData.assignments;
        
        let html = '<table class="schedule-table">';
        
        // 表頭
        html += '<thead><tr>';
        html += '<th>員工</th>';
        html += '<th>類型</th>';
        weekDays.forEach(day => {
            html += `<th>${day}<br/>AM</th>`;
            html += `<th>${day}<br/>PM</th>`;
        });
        html += '<th>週工時</th>';
        html += '</tr></thead>';
        
        // 員工行
        html += '<tbody>';
        employees.forEach(employee => {
            const employeeAssignments = assignments.filter(a => a.employee_id === employee.id);
            const weeklyHours = this.calculateWeeklyHours(employeeAssignments);
            
            html += '<tr class="employee-row">';
            html += `<td>${employee.name}</td>`;
            html += `<td>${employee.type === 'fulltime' ? '正職' : 'PT'}</td>`;
            
            weekDays.forEach(day => {
                const dayAssignments = employeeAssignments.filter(a => a.date === day);
                const amAssignment = dayAssignments.find(a => a.slot === 'AM');
                const pmAssignment = dayAssignments.find(a => a.slot === 'PM');
                
                html += `<td>${this.formatAssignment(amAssignment)}</td>`;
                html += `<td>${this.formatAssignment(pmAssignment)}</td>`;
            });
            
            html += `<td>${weeklyHours.toFixed(1)}h</td>`;
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        return html;
    }

    // 格式化指派
    formatAssignment(assignment) {
        if (!assignment) return '-';
        
        const startTime = assignment.start_time.substring(0, 5);
        const endTime = assignment.end_time.substring(0, 5);
        const roleClass = `role-${assignment.role}`;
        
        return `
            <div class="time-slot">${startTime}-${endTime}</div>
            <div class="role-tag ${roleClass}">${this.getRoleText(assignment.role)}</div>
        `;
    }

    // 產生統計區段
    generateSummarySection(scheduleData) {
        const assignments = scheduleData.assignments;
        const weekDays = this.getWeekDays(scheduleData.week_start);
        
        let html = '<div class="summary">';
        html += '<h3>各時段上工人數統計</h3>';
        html += '<table class="summary-table">';
        
        // 表頭
        html += '<thead><tr>';
        html += '<th>日期</th>';
        html += '<th>時段</th>';
        html += '<th>收銀</th>';
        html += '<th>接待</th>';
        html += '<th>走餐</th>';
        html += '<th>茶水</th>';
        html += '<th>控場</th>';
        html += '<th>出餐</th>';
        html += '<th>撤餐</th>';
        html += '<th>酒水</th>';
        html += '<th>總計</th>';
        html += '</tr></thead>';
        
        // 統計行
        html += '<tbody>';
        weekDays.forEach(day => {
            ['AM', 'PM'].forEach(slot => {
                const daySlotAssignments = assignments.filter(a => 
                    a.date === day && a.slot === slot
                );
                
                const roleCounts = {
                    cashier: daySlotAssignments.filter(a => a.role === 'cashier').length,
                    reception: daySlotAssignments.filter(a => a.role === 'reception').length,
                    runner: daySlotAssignments.filter(a => a.role === 'runner').length,
                    tea_service: daySlotAssignments.filter(a => a.role === 'tea_service').length,
                    control: daySlotAssignments.filter(a => a.role === 'control').length,
                    plating: daySlotAssignments.filter(a => a.role === 'plating').length,
                    clearing: daySlotAssignments.filter(a => a.role === 'clearing').length,
                    beverage: daySlotAssignments.filter(a => a.role === 'beverage').length
                };
                
                const total = Object.values(roleCounts).reduce((sum, count) => sum + count, 0);
                
                html += '<tr>';
                html += `<td>${day}</td>`;
                html += `<td>${slot}</td>`;
                html += `<td>${roleCounts.cashier}</td>`;
                html += `<td>${roleCounts.reception}</td>`;
                html += `<td>${roleCounts.runner}</td>`;
                html += `<td>${roleCounts.tea_service}</td>`;
                html += `<td>${roleCounts.control}</td>`;
                html += `<td>${roleCounts.plating}</td>`;
                html += `<td>${roleCounts.clearing}</td>`;
                html += `<td>${roleCounts.beverage}</td>`;
                html += `<td>${total}</td>`;
                html += '</tr>';
            });
        });
        
        html += '</tbody></table>';
        html += '</div>';
        
        return html;
    }

    // 產生 PDF 檔名
    generatePDFFilename(storeId, weekStart) {
        const weekNumber = this.getWeekNumber(weekStart);
        return `排班表_${storeId}_第${weekNumber}週_${weekStart}.html`;
    }

    // 計算工時
    calculateWorkHours(startTime, endTime, breakMinutes = 120) {
        const start = new Date(`2000-01-01T${startTime}`);
        const end = new Date(`2000-01-01T${endTime}`);
        const workMinutes = (end - start) / (1000 * 60) - breakMinutes;
        const workHours = workMinutes / 60;
        const regularHours = Math.min(workHours, 8);
        const overtimeHours = Math.max(workHours - 8, 0);

        return {
            total: Math.max(0, workHours),
            regular: Math.max(0, regularHours),
            overtime: Math.max(0, overtimeHours)
        };
    }

    // 計算連續上班天數
    calculateConsecutiveDays(targetDate, assignments, employeeId) {
        const target = new Date(targetDate);
        let consecutiveDays = 1;

        // 向前檢查
        for (let i = 1; i <= 7; i++) {
            const checkDate = new Date(target);
            checkDate.setDate(target.getDate() - i);
            
            const hasAssignment = assignments.some(assignment => 
                assignment.employee_id === employeeId && 
                new Date(assignment.date).toDateString() === checkDate.toDateString()
            );
            
            if (hasAssignment) {
                consecutiveDays++;
            } else {
                break;
            }
        }

        return consecutiveDays;
    }

    // 判斷是否為尖峰時段
    isPeakTime(startTime, endTime) {
        const start = startTime.substring(0, 5);
        const end = endTime.substring(0, 5);
        
        // 早餐期 10:00-14:00
        if (start >= '10:00' && end <= '14:00') {
            return true;
        }
        
        // 晚餐期 18:00-22:00
        if (start >= '18:00' && end <= '22:00') {
            return true;
        }
        
        return false;
    }

    // 計算週工時
    calculateWeeklyHours(assignments) {
        return assignments.reduce((total, assignment) => {
            const workHours = this.calculateWorkHours(
                assignment.start_time,
                assignment.end_time,
                assignment.break_minutes
            );
            return total + workHours.total;
        }, 0);
    }

    // 取得週天數
    getWeekDays(weekStart) {
        const start = new Date(weekStart);
        const days = [];
        
        for (let i = 0; i < 7; i++) {
            const day = new Date(start);
            day.setDate(start.getDate() + i);
            days.push(day.toLocaleDateString('zh-TW', { 
                month: '2-digit', 
                day: '2-digit' 
            }));
        }
        
        return days;
    }

    // 取得週數
    getWeekNumber(dateString) {
        const date = new Date(dateString);
        const startOfYear = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
        return Math.ceil((days + startOfYear.getDay() + 1) / 7);
    }

    // 取得角色文字
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

    // 下載檔案
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }
}

// 匯出服務
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExportService;
} else {
    window.ExportService = ExportService;
}
