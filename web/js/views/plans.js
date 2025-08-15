// web/js/views/plans.js

import { getProjectData } from '../store.js';
import { DAY_TYPE_MAP, PLAN_COLORS } from '../constants.js';

function getPlanColor(planId) {
    return PLAN_COLORS[planId % PLAN_COLORS.length];
}

function drawPlanCard(plan, dayIndex, startTimeInMinutes, endTimeInMinutes) {
    const container = document.getElementById('plan-schedule-container');
    const durationInMinutes = endTimeInMinutes - startTimeInMinutes;
    if (durationInMinutes <= 0) return;

    const color = getPlanColor(plan.id);
    const dayMap = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 0: 7, 7: 8 };
    const column = dayMap[dayIndex];

    const card = document.createElement('div');
    card.className = 'plan-card';
    card.style.backgroundColor = color;
    
    const headerHeight = 40;
    const hourRowHeight = 45;
    
    const topPosition = headerHeight + (startTimeInMinutes / 60) * hourRowHeight;
    const cardHeight = (durationInMinutes / 60) * hourRowHeight;

    card.style.position = 'absolute';
    card.style.top = `${topPosition}px`;
    card.style.height = `${cardHeight - 2}px`;

    const columnWidthPercent = 100 / 9;
    card.style.left = `${(column) * columnWidthPercent}%`;
    card.style.width = `calc(${columnWidthPercent}% - 4px)`;

    card.innerHTML = `
        <span class="plan-card-title">Plan #${plan.id}</span>
        <span class="plan-card-details">Sec: ${plan.sequence_id}</span>
    `;
    const startHour = String(plan.hour).padStart(2,'0');
    const startMinute = String(plan.minute).padStart(2,'0');
    card.title = `Plan #${plan.id} - Sec: ${plan.sequence_id} | Inicia: ${startHour}:${startMinute}`;
    
    container.appendChild(card);
}

export function initializePlansView() {
    const container = document.getElementById('plan-schedule-container');
    const projectData = getProjectData();
    const hardwareData = projectData.hardware_config;
    if (!container) return;
    container.innerHTML = '';

    const days = ['Hora', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo', 'Feriados'];
    days.forEach(day => container.insertAdjacentHTML('beforeend', `<div class="schedule-cell schedule-header">${day}</div>`));
    for (let hour = 0; hour < 24; hour++) {
        const timeStr = hour.toString().padStart(2, '0') + ':00';
        container.insertAdjacentHTML('beforeend', `<div class="schedule-cell time-slot">${timeStr}</div>`);
        for (let i = 0; i < 8; i++) { container.insertAdjacentHTML('beforeend', `<div class="schedule-cell"></div>`); }
    }

    if (!hardwareData || !hardwareData.plans || hardwareData.plans.length === 0) return;

    const weeklySchedule = {};
    for (let i = 0; i < 8; i++) { weeklySchedule[i] = []; }
    hardwareData.plans.forEach(plan => {
        const applicableDays = DAY_TYPE_MAP[plan.day_type_id];
        if (applicableDays) {
            applicableDays.forEach(dayIndex => {
                weeklySchedule[dayIndex].push({ ...plan, startTime: plan.hour * 60 + plan.minute });
            });
        }
    });
    for (let day in weeklySchedule) { weeklySchedule[day].sort((a, b) => a.startTime - b.startTime); }

    for (let dayIndex = 0; dayIndex < 8; dayIndex++) {
        const plansForToday = weeklySchedule[dayIndex];
        const yesterdayIndex = (dayIndex === 1) ? 0 : (dayIndex === 0) ? 6 : dayIndex - 1;
        const plansFromYesterday = weeklySchedule[yesterdayIndex];
        const lastPlanFromYesterday = plansFromYesterday && plansFromYesterday.length > 0 ? plansFromYesterday[plansFromYesterday.length - 1] : null;

        if (lastPlanFromYesterday) {
            const firstPlanStartTime = plansForToday.length > 0 ? plansForToday[0].startTime : 24 * 60;
            if (firstPlanStartTime > 0) {
                drawPlanCard(lastPlanFromYesterday, dayIndex, 0, firstPlanStartTime);
            }
        }

        for (let i = 0; i < plansForToday.length; i++) {
            const currentPlan = plansForToday[i];
            const nextPlanStartTime = (i + 1 < plansForToday.length) ? plansForToday[i + 1].startTime : 24 * 60;
            drawPlanCard(currentPlan, dayIndex, currentPlan.startTime, nextPlanStartTime);
        }
    }
}