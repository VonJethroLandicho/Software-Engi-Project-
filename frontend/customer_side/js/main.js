const API_BASE = 'http://127.0.0.1:5000/api/customer';
let globalBarbers = [];
let globalServices = []; 
let currentApptTab = 'All';
let globalTimeOffset = 0; // NEW: Ensures customers run on the same official shop clock

const topBarStyle = document.createElement('style');
topBarStyle.innerHTML = `
    .top-bar button {
        background: transparent; color: white; border: 2px solid white;
        padding: 6px 16px; border-radius: 20px; cursor: pointer;
        font-weight: bold; font-size: 0.9em; transition: background 0.2s, color 0.2s;
    }
    .top-bar button:hover { background: white; color: var(--red, #b71c1c); }
`;
document.head.appendChild(topBarStyle);

document.addEventListener("DOMContentLoaded", () => {
    const hasVisited = localStorage.getItem("mugshot_visited");
    
    const overlay = document.createElement("div");
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;";
    
    const msgBox = document.createElement("div");
    msgBox.style = "background:white; padding:40px; border-radius:10px; text-align:center; max-width:400px; border-top: 5px solid var(--red); box-shadow: 0 10px 25px rgba(0,0,0,0.5);";
    
    if (hasVisited) {
        msgBox.innerHTML = `
            <h2 style="color:var(--black); margin-bottom:10px; font-size: 2em;">Welcome back</h2>
            <p style="color:#666; font-weight:bold; margin-bottom:25px; font-size: 1.1em;">Live Shop Status & Appointments</p>
            <button class="btn btn-red" style="width: 100%; padding: 12px; font-size: 1.1em;" onclick="this.parentElement.parentElement.remove()">Enter Shop</button>
        `;
    } else {
        msgBox.innerHTML = `
            <h2 style="color:var(--black); margin-bottom:10px; font-size: 1.8em;">Welcome to<br><span style="color:var(--red);">MUGSHOT PH</span></h2>
            <p style="color:#666; font-weight:bold; margin-bottom:25px;">Live Shop Status & Appointments</p>
            <button class="btn btn-red" style="width: 100%; padding: 12px; font-size: 1.1em;" onclick="this.parentElement.parentElement.remove()">Enter Shop</button>
        `;
        localStorage.setItem("mugshot_visited", "true");
    }
    
    overlay.appendChild(msgBox);
    document.body.appendChild(overlay);
});

function formatAMPM(time24) {
    if (!time24) return "";
    let [hours, minutes] = time24.split(':');
    hours = parseInt(hours);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
}

function calculateEndTime(startTime, durationMins) {
    if (!startTime) return "";
    let [hours, minutes] = startTime.split(':').map(Number);
    let date = new Date(2000, 0, 1, hours, minutes);
    date.setMinutes(date.getMinutes() + parseInt(durationMins || 30));
    let endHours = date.getHours().toString().padStart(2, '0');
    let endMins = date.getMinutes().toString().padStart(2, '0');
    return `${endHours}:${endMins}`;
}

async function fetchState() {
    try {
        const res = await fetch(`${API_BASE}/state`);
        const data = await res.json();
        globalBarbers = data.barbers;
        globalServices = data.services; 
        globalTimeOffset = data.time_offset || 0; // Grabs official time from MongoDB
        
        const grid = document.getElementById('seat-grid');
        grid.innerHTML = '';
        data.barbers.forEach(barber => grid.appendChild(createCustomerCard(barber)));

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
            let elapsedMins = 0;
            if (barber.current_customer.start_time) {
                let startTime = new Date(barber.current_customer.start_time);
                elapsedMins = Math.floor(((Date.now() + globalTimeOffset) - startTime) / 60000);
            }
            
            // FIXED: Changed colors to #555 (dark gray) and #b71c1c (dark red) for high contrast
            activeHtml = `
                <div style="text-align:center; line-height: 1.4;">
                    <span style="font-size:1.2em; color:var(--red); font-weight:bold;">Occupied</span><br>
                    <span style="font-size:0.95em; font-weight:600; color:#555;">${barber.current_customer.service || "Haircut"} (${barber.current_customer.mins || 30}m)</span><br>
                    <span style="font-size:0.9em; color:#b71c1c; font-weight:bold; margin-top:5px; display:inline-block;">⏱️ Elapsed: ${elapsedMins} mins</span>
                </div>`;
        } else {
            activeHtml = `Currently Busy`;
        }
    }

    let queueHtml = barber.queue.length === 0 ? `<span style="color:#aaa; font-size:0.8em;">No Line</span>` : ``;
    barber.queue.forEach((customer) => { 
        queueHtml += `
            <div class="name-chip" style="display:flex; flex-direction:column; align-items:flex-start; padding: 8px 12px; background: var(--black);">
                <span style="font-weight:bold; font-size: 1.1em; color: white;">👤 Waiting</span>
                <span style="font-size: 0.95em; color: #fff; margin-top: 2px;">${customer.service || "Haircut"} (${customer.mins || 30}m)</span>
            </div>`; 
    });

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
            <button class="btn btn-outline" ${barber.status === 'offline' ? 'disabled' : ''} onclick="viewSchedule(${barber.id}, '${barber.name}')">Appointed Schedules</button>
        </div>
    `;
    return card;
}

window.switchTab = (tabValue) => { currentApptTab = tabValue; fetchState(); };

function renderAppointments(appointments, barbers) {
    const list = document.getElementById('appointment-list');
    if (!list) return; 
    let tabsHtml = `<div style="display:flex; gap:10px; margin-bottom: 25px; border-bottom: 2px solid #ddd; padding-bottom: 15px;">
        <button class="btn ${currentApptTab === 'All' ? 'btn-red' : 'btn-outline'}" style="width: auto; padding: 8px 15px;" onclick="window.switchTab('All')">All Appointments</button>`;
    barbers.forEach(b => {
        tabsHtml += `<button class="btn ${currentApptTab === b.id ? 'btn-red' : 'btn-outline'}" style="width: auto; padding: 8px 15px;" onclick="window.switchTab(${b.id})">${b.name}</button>`;
    });
    tabsHtml += `</div>`;

    let filteredAppts = currentApptTab !== 'All' ? appointments.filter(a => a.barber_id === currentApptTab) : appointments;
    let pendingAppts = filteredAppts.filter(a => a.status === 'pending');
    let acceptedAppts = filteredAppts.filter(a => a.status === 'accepted');

    let contentHtml = `<h3 style="margin-bottom: 15px; color: var(--text-dark);">Pending Requests (${pendingAppts.length})</h3>`;
    if (pendingAppts.length === 0) contentHtml += `<p style="color:#888; margin-bottom: 30px;">No pending requests in this view.</p>`;
    else pendingAppts.forEach(appt => { contentHtml += buildPublicApptCard(appt, barbers, "PENDING"); });

    contentHtml += `<h3 style="margin-top: 40px; margin-bottom: 15px; color: var(--red);">Accepted Appointments (${acceptedAppts.length})</h3>`;
    if (acceptedAppts.length === 0) contentHtml += `<p style="color:#888;">No accepted appointments in this view.</p>`;
    else acceptedAppts.forEach(appt => { contentHtml += buildPublicApptCard(appt, barbers, "ACCEPTED"); });

    list.innerHTML = tabsHtml + contentHtml;
}

function buildPublicApptCard(appt, barbers, statusText) {
    const barberName = barbers.find(b => b.id === appt.barber_id)?.name || "Unknown Barber";
    let serviceObj = globalServices.find(srv => srv.name === appt.service);
    let displayTime = `${formatAMPM(appt.time)} - ${formatAMPM(calculateEndTime(appt.time, serviceObj ? serviceObj.mins : 30))}`;
    let statusColor = statusText === 'ACCEPTED' ? '#00695c' : '#b71c1c';

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

window.viewSchedule = async (barberId, barberName) => {
    const res = await fetch(`${API_BASE}/schedule/${barberId}`);
    const data = await res.json();
    let html = `<h3 style="margin-bottom: 15px; border-bottom: 2px solid #ccc; padding-bottom:5px;">${barberName} - Appointed Schedules</h3><div>`;
    if(data.schedule.length === 0) html += `<p style="color:#00695c; font-weight:bold;">No appointments booked. Wide open!</p>`;
    else {
        data.schedule.sort((a, b) => new Date(a.date + 'T' + a.time) - new Date(b.date + 'T' + b.time));
        data.schedule.forEach(s => {
            let serviceObj = globalServices.find(srv => srv.name === s.service);
            html += `<div class="schedule-item" style="margin-bottom: 10px; padding: 10px; background: #ffebee; border-radius: 4px; border-left: 4px solid var(--red);">
                        <strong>🚫 ${s.date}</strong><br>
                        <span style="font-size: 1.1em; color: var(--black); font-weight: bold;">${formatAMPM(s.time)} - ${formatAMPM(calculateEndTime(s.time, serviceObj ? serviceObj.mins : 30))}</span><br>
                        <span style="color:#666; font-size: 0.9em;">Service: ${s.service}</span>
                     </div>`;
        });
    }
    html += `</div>`;
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('booking-modal').className = 'modal-active';
};

window.viewServicesMenu = () => {
    const overlay = document.createElement("div");
    overlay.id = "services-menu-overlay";
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;";
    
    let listHtml = '';
    globalServices.forEach(s => {
        let isAvail = s.available !== false;
        let availBadge = isAvail ? `<span style="color:#00695c; font-weight:bold; font-size:0.8em; padding: 2px 6px; border: 1px solid #00695c; border-radius: 4px;">Available</span>` 
                                 : `<span style="color:#b71c1c; font-weight:bold; font-size:0.8em; padding: 2px 6px; border: 1px solid #b71c1c; border-radius: 4px;">Currently Unavailable</span>`;
        let opacity = isAvail ? '1' : '0.5';
        
        listHtml += `
            <div style="padding: 12px 0; border-bottom: 1px solid #eee; opacity: ${opacity};">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:var(--black); font-size:1.1em;">${s.name}</strong>
                    <span style="color:var(--red); font-weight:bold;">${s.price || ''}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:6px; align-items: center;">
                    <span style="font-size:0.85em; color:#666; max-width: 70%;">${s.mins} mins | ${s.desc || ''}</span>
                    ${availBadge}
                </div>
            </div>
        `;
    });

    overlay.innerHTML = `
        <div style="background:white; padding:30px; border-radius:10px; max-width:500px; width: 90%; border-top: 5px solid var(--red); position: relative; max-height: 80vh; overflow-y:auto; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
            <button onclick="document.getElementById('services-menu-overlay').remove()" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 1.5em; cursor: pointer; color: #888;">&times;</button>
            <h3 style="margin-bottom:5px; color:var(--black);">Our Services</h3>
            <p style="font-size: 0.85em; color: #666; margin-bottom: 15px;">Check out what we offer before booking!</p>
            <div style="background: #fafafa; border: 1px solid #ddd; padding: 10px; border-radius: 4px;">
                ${listHtml}
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};

window.openBooking = async () => {
    const uid = localStorage.getItem("uid"); 
    let lastApptData = null;

    if (uid) {
        try {
            const res = await fetch(`${API_BASE}/last-appointment/${uid}`);
            const lastAppt = await res.json();
            if (lastAppt.found) {
                lastApptData = lastAppt.data;
            }
        } catch (e) { console.error("Could not fetch past data"); }
    }

    if (lastApptData) {
        const overlay = document.createElement("div");
        overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;";
        overlay.innerHTML = `
            <div style="background:white; padding:30px; border-radius:10px; max-width:400px; width: 90%; border-top: 5px solid var(--red);">
                <h3 style="margin-bottom:15px; color:var(--black);">Use your previous details?</h3>
                <p style="margin-bottom: 5px; color: #444;"><strong>Name:</strong> ${lastApptData.customer_name}</p>
                <p style="margin-bottom: 5px; color: #444;"><strong>Contact:</strong> ${lastApptData.contact}</p>
                <p style="margin-bottom: 25px; color: #444;"><strong>Service:</strong> ${lastApptData.service}</p>
                <div style="display:flex; gap:10px;">
                    <button class="btn btn-red" id="btn-yes-autofill" style="flex:1;">Yes, use these</button>
                    <button class="btn btn-outline" id="btn-no-manual" style="flex:1;">No, fill manually</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        document.getElementById('btn-yes-autofill').onclick = () => {
            overlay.remove();
            showBookingForm(lastApptData.customer_name, lastApptData.contact, lastApptData.service);
        };
        document.getElementById('btn-no-manual').onclick = () => {
            overlay.remove();
            showBookingForm("", "", "");
        };
    } else {
        showBookingForm("", "", "");
    }
};

function showBookingForm(defaultName, defaultContact, defaultService) {
    const today = new Date(Date.now() + globalTimeOffset);
    const minDate = new Date(today); minDate.setDate(minDate.getDate() + 1);
    const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 3);
    const minStr = minDate.toISOString().split('T')[0];
    const maxStr = maxDate.toISOString().split('T')[0];

    let barberOptions = globalBarbers.map(b => `<option value="${b.id}">${b.name}</option>`).join('');

    let serviceHtml = `<div style="max-height: 180px; overflow-y: auto; border: 1px solid #ccc; border-radius: 4px; padding: 10px; background: #fafafa;">`;
    
    let availableServices = globalServices.filter(s => s.available !== false);
    
    if (availableServices.length === 0) {
        serviceHtml += `<p style="color:#b71c1c; text-align:center; padding: 10px;">No services currently available.</p>`;
    } else {
        availableServices.forEach((srv, index) => {
            let isChecked = defaultService ? (srv.name === defaultService ? 'checked' : '') : (index === 0 ? 'checked' : '');
            serviceHtml += `
                <label style="display: block; padding: 8px; border-bottom: 1px solid #eee; cursor: pointer;">
                    <input type="radio" name="book-service" value="${srv.name}" ${isChecked} style="margin-right: 10px;">
                    <strong>${srv.name}</strong> - <span style="color:var(--red);">${srv.price || ''}</span><br>
                    <span style="font-size: 0.8em; color: #666; margin-left: 25px; display:block;">${srv.desc || ''} (${srv.mins} mins)</span>
                </label>
            `;
        });
    }
    serviceHtml += `</div>`;

    let html = `
        <h3 style="margin-bottom:5px;">Book an Appointment</h3>
        <p style="font-size:0.85em; color:#a30000; margin-bottom:15px; font-weight:bold;">*1-3 days in advance. Hours: 9 AM - 9 PM</p>
        <div class="form-group">
            <label style="font-size:0.8em; display:block; margin-bottom:5px;">Select Barber:</label>
            <select id="book-barber" class="form-control">${barberOptions}</select>
        </div>
        <div class="form-group">
            <input type="text" id="book-name" class="form-control" placeholder="Your Full Name" value="${defaultName}" required>
        </div>
        <div class="form-group">
            <input type="text" id="book-contact" class="form-control" placeholder="Contact Number" value="${defaultContact}" required>
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
}

window.submitBooking = async () => {
    const uid = localStorage.getItem("uid"); 
    const barberId = document.getElementById('book-barber').value;
    const name = document.getElementById('book-name').value.trim();
    const contact = document.getElementById('book-contact').value.trim();
    const date = document.getElementById('book-date').value;
    const time = document.getElementById('book-time').value;
    
    const serviceRadio = document.querySelector('input[name="book-service"]:checked');
    const service = serviceRadio ? serviceRadio.value : "";
    
    if(!name || !contact || !date || !time || !service) return alert("Please fill out all fields.");

    const res = await fetch(`${API_BASE}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            uid: uid, barber_id: barberId, date: date, time: time, 
            service: service, customer_name: name, contact: contact 
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