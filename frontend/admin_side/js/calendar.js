const API_BASE = 'http://127.0.0.1:5000/api/admin';
let historyDataMap = {}; 
let currentDate = new Date();
let selectedIsoDate = null;
let activeCharts = []; // Holds references to destroy old charts to prevent overlapping

async function fetchHistory() {
    try {
        const res = await fetch(`${API_BASE}/calendar-history`);
        const data = await res.json();
        
        historyDataMap = {};
        data.history.forEach(report => {
            historyDataMap[report.iso_date] = report;
        });

        setupDropdowns();
        renderCalendar();
        
        const todayIso = new Date().toISOString().split('T')[0];
        selectDate(todayIso);
        
    } catch (e) {
        console.error("Failed to load history", e);
    }
}

function setupDropdowns() {
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');
    
    if (monthSelect.options.length > 0) return; 

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    monthNames.forEach((m, i) => {
        let opt = document.createElement('option');
        opt.value = i; opt.text = m;
        monthSelect.appendChild(opt);
    });

    let currentYear = new Date().getFullYear();
    for(let y = currentYear - 2; y <= currentYear + 3; y++) {
        let opt = document.createElement('option');
        opt.value = y; opt.text = y;
        yearSelect.appendChild(opt);
    }

    monthSelect.value = currentDate.getMonth();
    yearSelect.value = currentDate.getFullYear();

    monthSelect.addEventListener('change', (e) => {
        currentDate.setMonth(parseInt(e.target.value));
        renderCalendar();
    });
    
    yearSelect.addEventListener('change', (e) => {
        currentDate.setFullYear(parseInt(e.target.value));
        renderCalendar();
    });
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const container = document.getElementById('cal-days-container');
    container.innerHTML = '';
    
    for (let i = 0; i < firstDay; i++) {
        container.innerHTML += `<div class="cal-day empty"></div>`;
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const checkDate = new Date(year, month, day);
        const isoString = checkDate.toLocaleDateString('en-CA'); 
        
        const hasRecord = historyDataMap[isoString] ? true : false;
        const isSelected = selectedIsoDate === isoString;
        
        let classes = 'cal-day';
        if (hasRecord) classes += ' has-record';
        if (isSelected) classes += ' selected';
        
        container.innerHTML += `<div class="${classes}" onclick="selectDate('${isoString}')">${day}</div>`;
    }
}

function selectDate(isoDate) {
    selectedIsoDate = isoDate;
    renderCalendar(); 
    
    const report = historyDataMap[isoDate];
    const detailsContainer = document.getElementById('report-details-container');
    
    let [y, m, d] = isoDate.split('-');
    let displayDate = new Date(y, m-1, d).toLocaleDateString('en-US', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});
    
    if (!report) {
        detailsContainer.innerHTML = `
            <div class="report-card" style="text-align: center; padding: 50px 20px;">
                <h3 style="color: var(--black); margin: 0 0 10px 0; font-size: 1.3em;">${displayDate}</h3>
                <p style="color: #888;">No cuts or specific services logged for this date.</p>
            </div>
        `;
        return;
    }

    let barberHtml = '';
    report.barbers.forEach(b => {
        let svcHtml = '';
        if (b.services && Object.keys(b.services).length > 0) {
            for (const [srvName, count] of Object.entries(b.services)) {
                svcHtml += `<div style="font-size:0.9em; color:#555; padding-left: 15px; margin-top: 4px;">↳ ${count} ${srvName}</div>`;
            }
        } else {
             svcHtml = `<div style="font-size:0.9em; color:#aaa; padding-left: 15px; margin-top: 4px;">↳ No specific services logged</div>`;
        }

        barberHtml += `
            <div class="barber-stat" style="display:block; padding: 12px 0; border-bottom: 1px solid #eee;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:var(--black); font-size:1.1em;">${b.name}</strong> 
                    <span style="background:var(--black); color:white; padding:3px 10px; border-radius:12px; font-size:0.9em;">${b.cuts} total</span>
                </div>
                ${svcHtml}
            </div>
        `;
    });

    let logsHtml = '';
    if (report.detailed_logs && report.detailed_logs.length > 0) {
        logsHtml += `<table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 0.9em; text-align: left; background: white;">
            <tr style="background: #eee; border-bottom: 2px solid #ccc;">
                <th style="padding: 10px;">Time Frame</th>
                <th style="padding: 10px;">Duration</th>
                <th style="padding: 10px;">Customer</th>
                <th style="padding: 10px;">Service</th>
                <th style="padding: 10px;">Barber</th>
                <th style="padding: 10px;">Type</th>
            </tr>`;
        
        report.detailed_logs.forEach(log => {
            logsHtml += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; color: var(--red); font-weight:bold;">${log.time_seated} - ${log.time_finished}</td>
                <td style="padding: 10px; font-weight: bold; background: #fafafa;">${log.total_minutes} min</td>
                <td style="padding: 10px; font-weight: bold;">${log.customer}</td>
                <td style="padding: 10px;">${log.service}</td>
                <td style="padding: 10px;">${log.barber_name}</td>
                <td style="padding: 10px;">${log.type}</td>
            </tr>`;
        });
        logsHtml += `</table>`;
    } else {
        logsHtml = `<p style="color: #888; padding: 15px; text-align:center;">No detailed time logs recorded for this date.</p>`;
    }

    detailsContainer.innerHTML = `
        <div class="report-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="color: var(--black); margin: 0; font-size: 1.3em;">${report.display_date}</h3>
                <div style="display:flex; gap: 10px; align-items: center;">
                    <div style="background: var(--red); color: white; padding: 6px 15px; border-radius: 20px; font-weight: bold; font-size: 1em; white-space: nowrap;">
                        Total Handled : ${report.total_cuts}
                    </div>
                    <button class="btn btn-outline" style="border-color: #b71c1c; color: #b71c1c; padding: 4px 10px; font-size: 0.85em;" onclick="deleteRecord('${report.iso_date}')">Delete Record</button>
                </div>
            </div>
            
            <div style="background: #fafafa; padding: 15px; border-radius: 4px; border: 1px solid #ddd;">
                <h4 style="margin-bottom:10px; border-bottom: 2px solid #ccc; padding-bottom: 5px; color: var(--red);">Summary Output</h4>
                ${barberHtml}
            </div>

            <button class="btn btn-outline" onclick="document.getElementById('detailed-logs-wrapper').style.display = document.getElementById('detailed-logs-wrapper').style.display === 'none' ? 'block' : 'none';" style="width: 100%; margin-top: 15px; color: var(--black); border-color: var(--black);">⏱️ View Detailed Time Logs</button>
            <div id="detailed-logs-wrapper" style="display: none; border: 1px solid #ddd; border-radius: 4px; overflow-x: auto; margin-top: 10px;">
                ${logsHtml}
            </div>
        </div>
    `;
}

window.deleteRecord = async (isoDate) => {
    if (confirm(`Are you completely sure you want to delete the history record for ${isoDate}? This cannot be undone.`)) {
        try {
            await fetch(`${API_BASE}/delete-history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ iso_date: isoDate })
            });
            fetchHistory(); 
        } catch(e) {
            alert("Failed to delete record.");
        }
    }
};

// --- NEW: AI REPORTING LOGIC ---
window.openAIReport = async () => {
    const sDate = document.getElementById('report-start').value;
    const eDate = document.getElementById('report-end').value;
    if(!sDate || !eDate) return alert("Select both a start and end date.");
    
    document.getElementById('report-date-range').innerText = `${sDate} to ${eDate}`;
    document.getElementById('report-loading').style.display = 'block';
    document.getElementById('report-charts').style.display = 'none';
    document.getElementById('btn-download-pdf').style.display = 'none';
    document.getElementById('ai-modal').style.display = 'flex';

    try {
        const res = await fetch(`${API_BASE}/generate-report`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ start_date: sDate, end_date: eDate })
        });
        const payload = await res.json();
        
        drawCharts(payload.data);
        injectAIText(payload.ai_analysis);
        
        document.getElementById('report-loading').style.display = 'none';
        document.getElementById('report-charts').style.display = 'block';
        document.getElementById('btn-download-pdf').style.display = 'block';
    } catch(e) {
        alert("Failed to generate report.");
        document.getElementById('ai-modal').style.display = 'none';
    }
};

function injectAIText(ai) {
    document.getElementById('ai-trend').innerText = ai.trend_analysis || "No AI analysis generated.";
    document.getElementById('ai-barber').innerText = ai.barber_analysis || "No AI analysis generated.";
    document.getElementById('ai-ratio').innerText = ai.walkin_vs_appt_analysis || "No AI analysis generated.";
    document.getElementById('ai-hours').innerText = ai.peak_hours_analysis || "No AI analysis generated.";
    document.getElementById('ai-services').innerText = ai.service_distribution_analysis || "No AI analysis generated.";
}

function drawCharts(data) {
    activeCharts.forEach(c => c.destroy());
    activeCharts = [];

    activeCharts.push(new Chart(document.getElementById('chart-trend'), {
        type: 'line',
        data: { labels: Object.keys(data.daily_trend), datasets: [{ label: 'Customers', data: Object.values(data.daily_trend), borderColor: '#b71c1c', tension: 0.1 }] }
    }));

    activeCharts.push(new Chart(document.getElementById('chart-barber'), {
        type: 'bar',
        data: { labels: Object.keys(data.barber_totals), datasets: [{ label: 'Cuts', data: Object.values(data.barber_totals), backgroundColor: '#00695c' }] }
    }));

    activeCharts.push(new Chart(document.getElementById('chart-ratio'), {
        type: 'pie',
        data: { labels: Object.keys(data.walkin_vs_appt), datasets: [{ data: Object.values(data.walkin_vs_appt), backgroundColor: ['#212121', '#b71c1c'] }] }
    }));

    activeCharts.push(new Chart(document.getElementById('chart-hours'), {
        type: 'bar',
        data: { labels: Object.keys(data.hourly_counts), datasets: [{ label: 'Traffic', data: Object.values(data.hourly_counts), backgroundColor: '#ffb300' }] }
    }));

    activeCharts.push(new Chart(document.getElementById('chart-services'), {
        type: 'doughnut',
        data: { labels: Object.keys(data.service_totals), datasets: [{ data: Object.values(data.service_totals) }] }
    }));
}

window.downloadPDF = async () => {
    document.getElementById('btn-download-pdf').innerHTML = "Generating PDF... Please wait.";
    
    // Uses html2canvas to take a perfect screenshot of the layout
    const element = document.getElementById('pdf-content-area');
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('Mugshot_Executive_Report.pdf');
    
    document.getElementById('btn-download-pdf').innerHTML = "⬇️ Download PDF Report";
};

fetchHistory();