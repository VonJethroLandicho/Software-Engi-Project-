const API_BASE = 'http://127.0.0.1:5000/api/customer';
let globalBarbers = [];

const SERVICE_MENU = [
    { name: "Haircut", price: "P200", desc: "With blow dry & pomade", mins: 30 },
    { name: "Haircut & Style", price: "P240", desc: "With shampoo, blow dry & pomade", mins: 45 },
    { name: "Haircut & Shave", price: "P300", desc: "With shave, shampoo, blow dry & pomade", mins: 60 },
    { name: "Kiddie MugShot", price: "P270", desc: "Haircut for kids aged 1 to 6", mins: 45 },
    { name: "MugShot Favorite", price: "P400", desc: "Cut, shampoo, blow dry, pomade & body massage", mins: 60 },
    { name: "MugShot Sulit", price: "P350", desc: "Cut, blow dry, pomade & body massage", mins: 45 },
    { name: "MugShot Supreme", price: "P550", desc: "Cut, beard sculpt/shave, wash, pomade & massage", mins: 90 },
    { name: "MugShot Elite", price: "P700", desc: "Cut, scalp treatment, wash, pomade & massage", mins: 120 },
    { name: "Scalp / Hair Treatment", price: "P420", desc: "With scalp massage, shampoo, blow dry & pomade", mins: 45 },
    { name: "Beard Sculpting", price: "P200", desc: "Standard beard shaping/trimming", mins: 20 },
    { name: "Shave", price: "P150", desc: "Full clean shave", mins: 30 },
    { name: "Hair Coloring", price: "P470", desc: "Basic colors only", mins: 120 },
    { name: "Hair Art", price: "P150", desc: "Depends on design complexity", mins: 30 },
    { name: "Shampoo & Blow dry", price: "P110", desc: "With pomade", mins: 15 }
];

function formatAMPM(time24) {
    if (!time24) return "";
    let [hours, minutes] = time24.split(':');
    hours = parseInt(hours);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
}

// Calculates the exact end time based on the service selected
function calculateEndTime(startTime, durationMins) {
    let [hours, minutes] = startTime.split(':').map(Number);
    let date = new Date(2000, 0, 1, hours, minutes);
    date.setMinutes(date.getMinutes() + durationMins);
    let endHours = date.getHours().toString().padStart(2, '0');
    let endMins = date.getMinutes().toString().padStart(2, '0');
    return `${endHours}:${endMins}`;
}

async function fetchState() {
    try {
        const res = await fetch(`${API_BASE}/state`);
        const data = await res.json();
        globalBarbers = data.barbers;
        
        const grid = document.getElementById('seat-grid');
        grid.innerHTML = '';
        data.barbers.forEach(barber => grid.appendChild(createCustomerCard(barber)));
    } catch (e) { console.error("API Offline", e); }
}

function createCustomerCard(barber) {
    const card = document.createElement('div');
    card.className = `seat-card status-${barber.status}`;
    
    let activeHtml = barber.status === 'offline' ? `Offline` : `Empty Seat`;
    if (barber.status === 'cutting') activeHtml = `✂️ Currently Busy`;

    let queueHtml = barber.queue.length === 0 ? `<span style="color:#aaa; font-size:0.8em;">No Line</span>` : ``;
    barber.queue.forEach(() => { queueHtml += `<div class="name-chip">👤 Waiting</div>`; });

    const btnState = barber.status === 'offline' ? 'disabled' : '';

    // Removed the booking button here entirely. Only Appointed Schedules remains.
    card.innerHTML = `
        <div class="card-header">
            <h2>${barber.name}</h2>
            <span class="status-indicator">${barber.status.toUpperCase()}</span>
        </div>
        <div class="active-seat-zone ${barber.status === 'cutting' ? 'cutting' : ''}">${activeHtml}</div>
        <div class="waiting-line-group">
            <div style="font-size:0.85em; font-weight:bold; color:#666; margin-bottom:5px; text-align:left;">In Line:</div>
            <div class="queue-row">${queueHtml}</div>
        </div>
        <div class="controls" style="margin-top:15px;">
            <button class="btn btn-outline" ${btnState} onclick="viewSchedule(${barber.id}, '${barber.name}')">Appointed Schedules</button>
        </div>
    `;
    return card;
}

window.viewSchedule = async (barberId, barberName) => {
    const res = await fetch(`${API_BASE}/schedule/${barberId}`);
    const data = await res.json();
    
    let html = `<h3 style="margin-bottom: 15px; border-bottom: 2px solid #ccc; padding-bottom:5px;">${barberName} - Appointed Schedules</h3><div>`;
    if(data.schedule.length === 0) {
        html += `<p style="color:#00695c; font-weight:bold;">No appointments booked. Wide open!</p>`;
    } else {
        data.schedule.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
        data.schedule.forEach(s => {
            // Find the duration of the service, fallback to 30 mins if not found
            let serviceObj = SERVICE_MENU.find(srv => srv.name === s.service);
            let duration = serviceObj ? serviceObj.mins : 30;
            let end24 = calculateEndTime(s.time, duration);
            
            html += `<div class="schedule-item" style="margin-bottom: 10px; padding: 10px; background: #ffebee; border-radius: 4px; border-left: 4px solid var(--red);">
                        <strong>🚫 ${s.date}</strong><br>
                        <span style="font-size: 1.1em; color: var(--black); font-weight: bold;">${formatAMPM(s.time)} - ${formatAMPM(end24)}</span><br>
                        <span style="color:#666; font-size: 0.9em;">Service: ${s.service}</span>
                     </div>`;
        });
    }
    html += `</div>`;
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('booking-modal').className = 'modal-active';
};

window.openBooking = () => {
    const today = new Date();
    const minDate = new Date(today); minDate.setDate(minDate.getDate() + 1);
    const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 3);
    const minStr = minDate.toISOString().split('T')[0];
    const maxStr = maxDate.toISOString().split('T')[0];

    // Create dropdown of active barbers
    let barberOptions = globalBarbers.map(b => `<option value="${b.id}">${b.name}</option>`).join('');

    let serviceHtml = `<div style="max-height: 180px; overflow-y: auto; border: 1px solid #ccc; border-radius: 4px; padding: 10px; background: #fafafa;">`;
    SERVICE_MENU.forEach((srv, index) => {
        serviceHtml += `
            <label style="display: block; padding: 8px; border-bottom: 1px solid #eee; cursor: pointer;">
                <input type="radio" name="book-service" value="${srv.name}" ${index === 0 ? 'checked' : ''} style="margin-right: 10px;">
                <strong>${srv.name}</strong> - <span style="color:var(--red);">${srv.price}</span><br>
                <span style="font-size: 0.8em; color: #666; margin-left: 25px; display:block;">${srv.desc} (${srv.mins} mins)</span>
            </label>
        `;
    });
    serviceHtml += `</div>`;

    let html = `
        <h3 style="margin-bottom:5px;">Book an Appointment</h3>
        <p style="font-size:0.85em; color:#a30000; margin-bottom:15px; font-weight:bold;">*1-3 days in advance. Hours: 9 AM - 9 PM</p>
        
        <div class="form-group">
            <label style="font-size:0.8em; display:block; margin-bottom:5px;">Select Barber:</label>
            <select id="book-barber" class="form-control">${barberOptions}</select>
        </div>
        <div class="form-group">
            <input type="text" id="book-name" class="form-control" placeholder="Your Full Name" required>
        </div>
        <div class="form-group">
            <input type="text" id="book-contact" class="form-control" placeholder="Contact Number" required>
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label style="font-size:0.8em; display:block; margin-bottom:5px;">Date:</label>
                <input type="date" id="book-date" class="form-control" min="${minStr}" max="${maxStr}" required>
            </div>
            <div class="form-group" style="flex:1;">
                <label style="font-size:0.8em; display:block; margin-bottom:5px;">Time (09:00 - 21:00):</label>
                <input type="time" id="book-time" class="form-control" min="09:00" max="21:00" required>
            </div>
        </div>
        <div class="form-group">
            <label style="font-size:0.8em; display:block; margin-bottom:5px;">Select Service:</label>
            ${serviceHtml}
        </div>
        <button class="btn btn-red" onclick="submitBooking()">Submit Request</button>
    `;

    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('booking-modal').className = 'modal-active';
};

window.submitBooking = async () => {
    const barberId = document.getElementById('book-barber').value;
    const name = document.getElementById('book-name').value.trim();
    const contact = document.getElementById('book-contact').value.trim();
    const date = document.getElementById('book-date').value;
    const time = document.getElementById('book-time').value;
    
    const serviceRadio = document.querySelector('input[name="book-service"]:checked');
    const service = serviceRadio ? serviceRadio.value : "";
    
    if(!name || !contact || !date || !time) return alert("Please fill out all fields.");

    const res = await fetch(`${API_BASE}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            barber_id: barberId, date: date, time: time, service: service, 
            customer_name: name, contact: contact 
        })
    });
    
    const data = await res.json();
    if(data.success) {
        alert("Appointment requested successfully! Awaiting admin approval.");
        document.getElementById('booking-modal').className = 'modal-hidden';
    } else {
        alert("Booking Failed: " + data.message); 
    }
};

document.getElementById('close-modal').onclick = () => {
    document.getElementById('booking-modal').className = 'modal-hidden';
};

fetchState();
setInterval(fetchState, 3000);