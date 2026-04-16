const API_BASE = 'http://127.0.0.1:5000/api/customer';
let globalBarbers = [];
let currentApptTab = 'All';

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

        // Render the new appointments dashboard
        if(data.appointments) {
            renderAppointments(data.appointments, data.barbers);
        }
    } catch (e) { console.error("API Offline", e); }
}

function createCustomerCard(barber) {
    const card = document.createElement('div');
    card.className = `seat-card status-${barber.status}`;
    
    let activeHtml = barber.status === 'offline' ? `Offline` : `Empty Seat`;
    if (barber.status === 'cutting') {
        if (barber.current_customer) {
            let serviceName = barber.current_customer.service || "Haircut";
            let totalMins = barber.current_customer.mins || 30;
            let elapsedMins = 0;
            
            // Calculate live elapsed time
            if (barber.current_customer.start_time) {
                let startTime = new Date(barber.current_customer.start_time);
                let now = new Date();
                elapsedMins = Math.floor((now - startTime) / 60000);
            }
            
            activeHtml = `
                <div style="text-align:center;">
                    <span style="font-size:1.2em;">✂️ Occupied</span><br>
                    <span style="font-size:0.9em; color:#ddd;">${serviceName} (${totalMins}m)</span><br>
                    <span style="font-size:0.85em; color:#ffaaaa; font-weight:bold; margin-top:5px; display:inline-block;">Elapsed: ${elapsedMins} mins</span>
                </div>`;
        } else {
            activeHtml = `✂️ Currently Busy`;
        }
    }

    let queueHtml = barber.queue.length === 0 ? `<span style="color:#aaa; font-size:0.8em;">No Line</span>` : ``;
    barber.queue.forEach((customer) => { 
        let serviceName = customer.service || "Haircut";
        let durationMins = customer.mins || 30;
        
        // Changed fonts to be white, bolder, and slightly larger
        queueHtml += `
            <div class="name-chip" style="display:flex; flex-direction:column; align-items:flex-start; padding: 8px 12px; background: var(--black);">
                <span style="font-weight:bold; font-size: 1.1em; color: white;">👤 Waiting</span>
                <span style="font-size: 0.95em; color: #fff; margin-top: 2px;">${serviceName} (${durationMins}m)</span>
            </div>`; 
    });

    const btnState = barber.status === 'offline' ? 'disabled' : '';

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

// -- NEW: APPOINTMENTS DASHBOARD LOGIC FOR CUSTOMERS --
window.switchTab = (tabValue) => {
    currentApptTab = tabValue;
    fetchState(); 
};

function renderAppointments(appointments, barbers) {
    const list = document.getElementById('appointment-list');
    if (!list) return; // Failsafe if HTML isn't updated yet
    
    let tabsHtml = `<div style="display:flex; gap:10px; margin-bottom: 25px; border-bottom: 2px solid #ddd; padding-bottom: 15px;">
        <button class="btn ${currentApptTab === 'All' ? 'btn-red' : 'btn-outline'}" style="width: auto; padding: 8px 15px;" onclick="window.switchTab('All')">All Appointments</button>`;
    
    barbers.forEach(b => {
        tabsHtml += `<button class="btn ${currentApptTab === b.id ? 'btn-red' : 'btn-outline'}" style="width: auto; padding: 8px 15px;" onclick="window.switchTab(${b.id})">${b.name}</button>`;
    });
    tabsHtml += `</div>`;

    let filteredAppts = appointments;
    if (currentApptTab !== 'All') {
        filteredAppts = appointments.filter(a => a.barber_id === currentApptTab);
    }

    let pendingAppts = filteredAppts.filter(a => a.status === 'pending');
    let acceptedAppts = filteredAppts.filter(a => a.status === 'accepted');

    let contentHtml = '';

    contentHtml += `<h3 style="margin-bottom: 15px; color: var(--text-dark);">Pending Requests (${pendingAppts.length})</h3>`;
    if (pendingAppts.length === 0) {
        contentHtml += `<p style="color:#888; margin-bottom: 30px;">No pending requests in this view.</p>`;
    } else {
        pendingAppts.forEach(appt => { contentHtml += buildPublicApptCard(appt, barbers, "PENDING"); });
    }

    contentHtml += `<h3 style="margin-top: 40px; margin-bottom: 15px; color: var(--red);">Accepted Appointments (${acceptedAppts.length})</h3>`;
    if (acceptedAppts.length === 0) {
        contentHtml += `<p style="color:#888;">No accepted appointments in this view.</p>`;
    } else {
        acceptedAppts.forEach(appt => { contentHtml += buildPublicApptCard(appt, barbers, "ACCEPTED"); });
    }

    list.innerHTML = tabsHtml + contentHtml;
}

function buildPublicApptCard(appt, barbers, statusText) {
    const barberName = barbers.find(b => b.id === appt.barber_id)?.name || "Unknown Barber";
    
    let serviceObj = SERVICE_MENU.find(srv => srv.name === appt.service);
    let duration = serviceObj ? serviceObj.mins : 30;
    let end24 = calculateEndTime(appt.time, duration);
    let displayTime = `${formatAMPM(appt.time)} - ${formatAMPM(end24)}`;
    
    let statusColor = statusText === 'ACCEPTED' ? '#00695c' : '#b71c1c';

    // Stripped down card - no names, no buttons, just schedule data
    return `
        <div style="background: #fdfdfd; border: 1px solid #ccc; border-left: 5px solid ${statusColor}; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
            <div style="display:flex; justify-content: space-between; align-items:center;">
                <div style="font-size: 0.95em; line-height: 1.6;">
                    <h4 style="font-size: 1.1em; color: var(--black); margin-bottom: 5px;">${appt.date} @ ${displayTime}</h4>
                    <strong>Barber:</strong> ${barberName} <br>
                    <strong>Service:</strong> ${appt.service}
                </div>
                <div style="font-weight: bold; font-size: 0.9em; color: ${statusColor}; border: 1px solid ${statusColor}; padding: 5px 10px; border-radius: 4px;">
                    ${statusText}
                </div>
            </div>
        </div>
    `;
}

// -----------------------------------------------------------

window.viewSchedule = async (barberId, barberName) => {
    const res = await fetch(`${API_BASE}/schedule/${barberId}`);
    const data = await res.json();
    
    let html = `<h3 style="margin-bottom: 15px; border-bottom: 2px solid #ccc; padding-bottom:5px;">${barberName} - Appointed Schedules</h3><div>`;
    if(data.schedule.length === 0) {
        html += `<p style="color:#00695c; font-weight:bold;">No appointments booked. Wide open!</p>`;
    } else {
        data.schedule.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
        data.schedule.forEach(s => {
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