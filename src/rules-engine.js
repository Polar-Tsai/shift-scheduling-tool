// 排班規則引擎
class RulesEngine {
    constructor() {
        this.rules = {
            // 餐期設定
            mealPeriods: {
                AM: { start: '10:00', end: '14:00' },
                PM: { start: '18:00', end: '22:00' }
            },
            
            // 工時限制
            workLimits: {
                fulltime: {
                    maxDaily: 12, // 每日最大工時（小時）
                    maxConsecutive: 5, // 最大連續上班天數
                    regularHours: 8 // 正常工時
                },
                pt: {
                    maxDaily: 10, // 每日最大工時（小時）
                    maxConsecutive: 6, // 最大連續上班天數
                    regularHours: 8 // 正常工時
                }
            },
            // PT 班別：限制可以被指派的時段或日別
            ptShiftTypes: {
                weekday_pm: {
                    description: '平日晚班（18:00 ~ 22:00）',
                    allowedSlots: ['PM'],
                    weekendOnly: false
                },
                weekend_pm: {
                    description: '假日晚班（18:00 ~ 22:00）',
                    allowedSlots: ['PM'],
                    weekendOnly: true
                },
                full_day: {
                    description: '全日（同正職工時）',
                    allowedSlots: ['AM', 'PM'],
                    weekendOnly: false
                }
            },
            
            // 休息時間
            breakTime: {
                standard: 120, // 標準休息時間（分鐘）
                minimum: 30 // 最小休息時間（分鐘）
            },
            
            // 崗位最低人數
            minStaffing: {
                cashier: 1,      // 收銀
                reception: 1,    // 接待
                runner: 1,       // 走餐
                tea_service: 1,  // 茶水
                control: 1,      // 控場
                plating: 1,      // 出餐
                clearing: 1,     // 撤餐
                beverage: 1      // 酒水
            }
        };
    }

    // 驗證排班指派
    validateAssignment(assignment, employee, existingAssignments = []) {
        const violations = [];
        const warnings = [];

        // 檢查員工類型限制
        if (employee.type === 'pt' && assignment.workHours > this.rules.workLimits.pt.maxDaily) {
            violations.push({
                type: 'error',
                message: `PT 員工 ${employee.name} 日工時超過 ${this.rules.workLimits.pt.maxDaily} 小時限制`
            });
        }

        if (employee.type === 'fulltime' && assignment.workHours > this.rules.workLimits.fulltime.maxDaily) {
            violations.push({
                type: 'error',
                message: `正職員工 ${employee.name} 日工時超過 ${this.rules.workLimits.fulltime.maxDaily} 小時限制`
            });
        }

        // 檢查連續上班天數
        const consecutiveDays = this.calculateConsecutiveDays(assignment.date, existingAssignments, employee.id);
        const maxConsecutive = this.rules.workLimits[employee.type].maxConsecutive;
        
        if (consecutiveDays >= maxConsecutive) {
            violations.push({
                type: 'error',
                message: `${employee.name} 連續上班天數已達 ${maxConsecutive} 天限制`
            });
        }

        // 檢查休息時間
        if (assignment.breakMinutes < this.rules.breakTime.minimum) {
            violations.push({
                type: 'error',
                message: `${employee.name} 休息時間少於 ${this.rules.breakTime.minimum} 分鐘`
            });
        } else if (assignment.breakMinutes < this.rules.breakTime.standard) {
            warnings.push({
                type: 'warning',
                message: `${employee.name} 休息時間少於標準 ${this.rules.breakTime.standard} 分鐘，將計入加班`
            });
        }

        // 檢查崗位技能
        if (!this.hasRequiredSkills(employee, assignment.role)) {
            warnings.push({
                type: 'warning',
                message: `${employee.name} 可能不具備 ${assignment.role} 崗位所需技能`
            });
        }

        return {
            isValid: violations.length === 0,
            violations,
            warnings
        };
    }

    // 驗證整週排班
    validateWeeklySchedule(schedule) {
        const violations = [];
        const warnings = [];
        const employeeStats = {};

        // 按員工分組統計
        schedule.assignments.forEach(assignment => {
            const empId = assignment.employee_id;
            if (!employeeStats[empId]) {
                employeeStats[empId] = {
                    totalHours: 0,
                    consecutiveDays: 0,
                    assignments: []
                };
            }
            
            employeeStats[empId].totalHours += assignment.workHours;
            employeeStats[empId].assignments.push(assignment);
        });

        // 檢查每個員工的工時
        Object.entries(employeeStats).forEach(([empId, stats]) => {
            const employee = schedule.employees.find(emp => emp.id == empId);
            if (!employee) return;

            // 檢查週工時
            const maxWeeklyHours = this.rules.workLimits[employee.type].maxDaily * 6; // 假設一週最多6天
            if (stats.totalHours > maxWeeklyHours) {
                violations.push({
                    type: 'error',
                    message: `${employee.name} 週工時 ${stats.totalHours.toFixed(1)} 小時超過限制`
                });
            }

            // 檢查連續上班
            const maxConsecutive = this.rules.workLimits[employee.type].maxConsecutive;
            const consecutiveDays = this.calculateMaxConsecutiveDays(stats.assignments);
            if (consecutiveDays > maxConsecutive) {
                violations.push({
                    type: 'error',
                    message: `${employee.name} 連續上班 ${consecutiveDays} 天超過 ${maxConsecutive} 天限制`
                });
            }
        });

        // 檢查崗位最低人數
        this.validateStaffingLevels(schedule, violations, warnings);

        // 檢查公平性
        this.validateFairness(schedule, warnings);

        return {
            isValid: violations.length === 0,
            violations,
            warnings
        };
    }

    // 計算連續上班天數
    calculateConsecutiveDays(targetDate, existingAssignments, employeeId) {
        const target = new Date(targetDate);
        let consecutiveDays = 1;

        // 向前檢查
        for (let i = 1; i <= 7; i++) {
            const checkDate = new Date(target);
            checkDate.setDate(target.getDate() - i);
            
            const hasAssignment = existingAssignments.some(assignment => 
                assignment.employee_id === employeeId && 
                new Date(assignment.date).toDateString() === checkDate.toDateString()
            );
            
            if (hasAssignment) {
                consecutiveDays++;
            } else {
                break;
            }
        }

        // 向後檢查
        for (let i = 1; i <= 7; i++) {
            const checkDate = new Date(target);
            checkDate.setDate(target.getDate() + i);
            
            const hasAssignment = existingAssignments.some(assignment => 
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

    // 計算最大連續上班天數
    calculateMaxConsecutiveDays(assignments) {
        if (assignments.length === 0) return 0;

        const sortedAssignments = assignments.sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );

        let maxConsecutive = 1;
        let currentConsecutive = 1;

        for (let i = 1; i < sortedAssignments.length; i++) {
            const prevDate = new Date(sortedAssignments[i - 1].date);
            const currDate = new Date(sortedAssignments[i].date);
            const dayDiff = (currDate - prevDate) / (1000 * 60 * 60 * 24);

            if (dayDiff === 1) {
                currentConsecutive++;
                maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
            } else {
                currentConsecutive = 1;
            }
        }

        return maxConsecutive;
    }

    // 檢查崗位技能
    hasRequiredSkills(employee, role) {
        if (!employee.skills) return true; // 如果沒有技能資料，假設可以勝任
        
        const skills = typeof employee.skills === 'string' ? 
            JSON.parse(employee.skills) : employee.skills;
        
        return skills.includes(role) || skills.includes('all');
    }

    // 驗證崗位最低人數
    validateStaffingLevels(schedule, violations, warnings) {
        const dailyStaffing = {};

        schedule.assignments.forEach(assignment => {
            const date = assignment.date;
            const slot = assignment.slot;
            const role = assignment.role;

            if (!dailyStaffing[date]) {
                dailyStaffing[date] = { AM: {}, PM: {} };
            }

            if (!dailyStaffing[date][slot][role]) {
                dailyStaffing[date][slot][role] = 0;
            }

            dailyStaffing[date][slot][role]++;
        });

        // 檢查每個日期每個時段每個崗位的人數
        Object.entries(dailyStaffing).forEach(([date, slots]) => {
            Object.entries(slots).forEach(([slot, roles]) => {
                Object.entries(this.rules.minStaffing).forEach(([role, minCount]) => {
                    const actualCount = roles[role] || 0;
                    if (actualCount < minCount) {
                        violations.push({
                            type: 'error',
                            message: `${date} ${slot} 時段 ${role} 崗位人數不足（需要 ${minCount} 人，實際 ${actualCount} 人）`
                        });
                    }
                });
            });
        });
    }

    // 驗證公平性
    validateFairness(schedule, warnings) {
        const employeeStats = {};

        // 統計每個員工的班次
        schedule.assignments.forEach(assignment => {
            const empId = assignment.employee_id;
            if (!employeeStats[empId]) {
                employeeStats[empId] = {
                    weekendShifts: 0,
                    eveningShifts: 0,
                    totalShifts: 0
                };
            }

            employeeStats[empId].totalShifts++;

            // 檢查週末班
            const date = new Date(assignment.date);
            if (date.getDay() === 0 || date.getDay() === 6) {
                employeeStats[empId].weekendShifts++;
            }

            // 檢查晚餐期
            if (assignment.slot === 'PM') {
                employeeStats[empId].eveningShifts++;
            }
        });

        // 檢查公平性
        const employees = Object.keys(employeeStats);
        if (employees.length > 1) {
            const weekendRates = employees.map(empId => 
                employeeStats[empId].weekendShifts / employeeStats[empId].totalShifts
            );
            const eveningRates = employees.map(empId => 
                employeeStats[empId].eveningShifts / employeeStats[empId].totalShifts
            );

            const maxWeekendRate = Math.max(...weekendRates);
            const minWeekendRate = Math.min(...weekendRates);
            const maxEveningRate = Math.max(...eveningRates);
            const minEveningRate = Math.min(...eveningRates);

            if (maxWeekendRate - minWeekendRate > 0.3) {
                warnings.push({
                    type: 'warning',
                    message: '週末班次分配不均，建議調整'
                });
            }

            if (maxEveningRate - minEveningRate > 0.3) {
                warnings.push({
                    type: 'warning',
                    message: '晚餐期班次分配不均，建議調整'
                });
            }
        }
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

    // 自動排班建議
    generateAutoScheduleSuggestions(employees, shifts, constraints = {}) {
        const suggestions = [];
        const employeeAvailability = this.calculateEmployeeAvailability(employees, constraints);
        const shiftRequirements = this.calculateShiftRequirements(shifts);

        // 為每個班次建議員工
        shifts.forEach(shift => {
            const requirements = shiftRequirements[shift.id];
            const availableEmployees = employeeAvailability.filter(emp => 
                this.isEmployeeAvailable(emp, shift, constraints)
            );

            // 按技能和經驗排序
            const sortedEmployees = availableEmployees.sort((a, b) => {
                const aScore = this.calculateEmployeeScore(a, shift, requirements);
                const bScore = this.calculateEmployeeScore(b, shift, requirements);
                return bScore - aScore;
            });

            // 選擇最佳員工組合
            const selectedEmployees = this.selectOptimalTeam(sortedEmployees, requirements);
            
            suggestions.push({
                shiftId: shift.id,
                date: shift.date,
                slot: shift.slot,
                suggestedAssignments: selectedEmployees.map(emp => ({
                    employeeId: emp.id,
                    role: this.getBestRoleForEmployee(emp, requirements),
                    startTime: shift.slot === 'AM' ? '10:00' : '18:00',
                    endTime: shift.slot === 'AM' ? '14:00' : '22:00',
                    breakMinutes: 120
                }))
            });
        });

        return suggestions;
    }

    // 計算員工可用性
    calculateEmployeeAvailability(employees, constraints) {
        return employees.filter(employee => {
            // 檢查休假申請
            if (constraints.timeOffRequests) {
                const hasTimeOff = constraints.timeOffRequests.some(request => 
                    request.employee_id === employee.id && 
                    request.status === 'approved'
                );
                if (hasTimeOff) return false;
            }

            // 檢查其他約束條件
            return true;
        });
    }

    // 計算班次需求
    calculateShiftRequirements(shifts) {
        const requirements = {};
        
        shifts.forEach(shift => {
            requirements[shift.id] = {
                cashier: shift.min_cashier || this.rules.minStaffing.cashier,
                server: shift.min_server || this.rules.minStaffing.server,
                kitchen: shift.min_kitchen || this.rules.minStaffing.kitchen,
                support: shift.min_support || this.rules.minStaffing.support
            };
        });

        return requirements;
    }

    // 檢查員工是否可用
    isEmployeeAvailable(employee, shift, constraints) {
        // 基本可用性：若有請假等約束可在 calculateEmployeeAvailability 已過濾

        // 若為 PT，依照其 pt_shift_type 限制
        if (employee.type === 'pt') {
            const ptType = employee.pt_shift_type || employee.ptShiftType;
            if (ptType && this.rules.ptShiftTypes[ptType]) {
                const rule = this.rules.ptShiftTypes[ptType];

                // 檢查允許的時段（AM/PM）
                if (!rule.allowedSlots.includes(shift.slot)) {
                    return false;
                }

                // 週末限定
                if (rule.weekendOnly) {
                    const d = new Date(shift.date);
                    const day = d.getDay();
                    const isWeekend = day === 0 || day === 6;
                    if (!isWeekend) return false;
                } else {
                    // 若非週末限定，且是平日晚班限定，需避開週末
                    if (ptType === 'weekday_pm') {
                        const d = new Date(shift.date);
                        const day = d.getDay();
                        const isWeekend = day === 0 || day === 6;
                        if (isWeekend) return false;
                    }
                }
            }
        }

        return true;
    }

    // 計算員工分數
    calculateEmployeeScore(employee, shift, requirements) {
        let score = 0;

        // 技能匹配分數
        if (employee.skills) {
            const skills = typeof employee.skills === 'string' ? 
                JSON.parse(employee.skills) : employee.skills;
            
            Object.keys(requirements).forEach(role => {
                if (skills.includes(role)) {
                    score += 10;
                }
            });
        }

        // 經驗分數（基於員工類型）
        if (employee.type === 'fulltime') {
            score += 5;
        }

        // 公平性分數（避免某些員工過度排班）
        // 這裡可以加入更複雜的公平性計算

        return score;
    }

    // 選擇最佳團隊
    selectOptimalTeam(availableEmployees, requirements) {
        const selected = [];
        const remainingRequirements = { ...requirements };

        // 貪心算法選擇員工
        while (Object.values(remainingRequirements).some(count => count > 0) && availableEmployees.length > 0) {
            const bestEmployee = availableEmployees.shift();
            const bestRole = this.getBestRoleForEmployee(bestEmployee, remainingRequirements);
            
            if (bestRole && remainingRequirements[bestRole] > 0) {
                selected.push(bestEmployee);
                remainingRequirements[bestRole]--;
            }
        }

        return selected;
    }

    // 為員工選擇最佳角色
    getBestRoleForEmployee(employee, requirements) {
        if (!employee.skills) {
            // 如果沒有技能資料，使用主要角色
            return employee.role_primary;
        }

        const skills = typeof employee.skills === 'string' ? 
            JSON.parse(employee.skills) : employee.skills;

        // 優先選擇有需求且員工有技能的角色
        for (const [role, count] of Object.entries(requirements)) {
            if (count > 0 && skills.includes(role)) {
                return role;
            }
        }

        // 如果沒有匹配的技能，使用主要角色
        return employee.role_primary;
    }

    // 更新規則
    updateRules(newRules) {
        this.rules = { ...this.rules, ...newRules };
    }

    // 取得規則
    getRules() {
        return this.rules;
    }
}

// 匯出規則引擎
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RulesEngine;
} else {
    window.RulesEngine = RulesEngine;
}
