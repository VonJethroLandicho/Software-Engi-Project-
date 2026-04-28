const API_BASE = 'http://127.0.0.1:5000/api/admin';
let currentApptTab = 'All'; 
let globalBarbers = []; 
let globalServices = []; 
let expandedBreakdowns = { shop: false }; 
let globalTimeOffset = 0; 
let isFetchingState = false;

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

window.toggleBreakdown = (id) => { expandedBreakdowns[id] = !expandedBreakdowns[id]; fetchState(); };

function updateClock() {
    const clockEl = document.getElementById('live-clock-display');
    if (!clockEl) return;
    
    const officialTime = new Date(Date.now() + globalTimeOffset);
    const yyyy = officialTime.getFullYear();
    const mm = String(officialTime.getMonth() + 1).padStart(2, '0');
    const dd = String(officialTime.getDate()).padStart(2, '0');
    let hrs = officialTime.getHours();
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    hrs = hrs % 12 || 12;
    const mins = String(officialTime.getMinutes()).padStart(2, '0');
    const secs = String(officialTime.getSeconds()).padStart(2, '0');
    
    clockEl.innerText = `${yyyy}-${mm}-${dd} | ${hrs}:${mins}:${secs} ${ampm}`;
}
setInterval(updateClock, 1000);

async function fetchState() {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) { return; }
    if (isFetchingState) return;

    isFetchingState = true;

    try {
        const res = await fetch(`${API_BASE}/state`);
        const data = await res.json();
        globalBarbers = data.barbers;
        globalServices = data.services; 
        globalTimeOffset = data.time_offset || 0; 
        
        const grid = document.getElementById('seat-grid');
        
        let shopTotalCuts = data.barbers.reduce((sum, b) => sum + b.cuts_today, 0);
        let shopServices = {};
        
        // MODIFIED: Adapts to the new deeply detailed object logic 
        data.barbers.forEach(b => {
            (b.completed_services || []).forEach(record => { 
                let svcName = typeof record === 'object' ? record.service : record;
                shopServices[svcName] = (shopServices[svcName] || 0) + 1; 
            });
        });
        
        let shopBreakdownHtml = '';
        if (Object.keys(shopServices).length > 0) {
            for (const [srv, count] of Object.entries(shopServices)) {
                shopBreakdownHtml += `<div style="font-size:0.85em; color:#555;">↳ ${count}x ${srv}</div>`;
            }
        } else {
            shopBreakdownHtml = `<div style="font-size:0.85em; color:#999;">↳ No services logged today</div>`;
        }

        let subHeader = document.getElementById('dashboard-page-subheader');
        if(!subHeader){
            subHeader = document.createElement('section');
            subHeader.id = 'dashboard-page-subheader';
            subHeader.className = 'page-subheader';
            grid.parentElement.insertBefore(subHeader, grid);
        }
        
        subHeader.innerHTML = `
            <div style="display:flex; justify-content: space-between; width: 100%; align-items: center; flex-wrap: wrap; gap: 15px;">
                
                <div style="display:flex; align-items:center; gap: 10px; flex-wrap: nowrap;">
                    <span class="subheader-title" style="font-size: 1.5em; font-weight: bold; color: var(--red); margin: 0; padding-right: 5px;">LIVE BARBERSHOP FLOOR</span>
                    
                    <div style="background: var(--black); color: white; padding: 6px 12px; border-radius: 4px; font-family: monospace; font-size: 1.1em; display:flex; align-items:center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                        <span id="live-clock-display">--:--:--</span>
                    </div>
                    
                    <button class="btn btn-outline" style="width: auto; padding: 6px 12px; font-size: 0.85em; margin: 0; white-space: nowrap;" onclick="window.openTimeOverrideModal()">Change Time</button>
                </div>

                <div style="text-align: right; position: relative;">
                    <div style="cursor: pointer; background: white; border: 1px solid #ccc; color: var(--black); padding: 5px 15px; border-radius: 4px; font-weight: bold; display: inline-block; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" onclick="window.toggleBreakdown('shop')">
                        Total Shop Cuts: ${shopTotalCuts} <span style="font-size:0.8em; margin-left:5px; color:#888;">${expandedBreakdowns['shop'] ? '▲' : '▼'}</span>
                    </div>
                    <div style="display: ${expandedBreakdowns['shop'] ? 'block' : 'none'}; position: absolute; right: 0; top: 100%; z-index: 10; background: white; border: 1px solid #ddd; padding: 15px; border-radius: 6px; margin-top: 5px; text-align: left; box-shadow: 0 4px 10px rgba(0,0,0,0.15); min-width: 200px;">
                        <strong style="display:block; margin-bottom: 5px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Today's Shop Services</strong>
                        ${shopBreakdownHtml}
                    </div>
                </div>
            </div>
        `;
        
        updateClock(); 

        grid.innerHTML = ''; 

        data.barbers.forEach((barber) => {
            const barberCardId = `barber-card-${barber.id}`;
            let barberCard = document.createElement('div');
            barberCard.id = barberCardId;
            grid.appendChild(barberCard);
            
            let serviceDropdownHtml = `<select id="walkin-service-${barber.id}" class="walkin-input" style="margin-top: 5px; margin-bottom: 5px; font-size:0.85em; padding: 6px;">`;
            globalServices.filter(s => s.available !== false).forEach(s => {
                serviceDropdownHtml += `<option value="${s.name}" data-mins="${s.mins}">${s.name} (${s.mins} mins)</option>`;
            });
            serviceDropdownHtml += `</select>`;

            let bServices = {};
            (barber.completed_services || []).forEach(record => { 
                let svcName = typeof record === 'object' ? record.service : record;
                bServices[svcName] = (bServices[svcName] || 0) + 1; 
            });
            
            let bBreakdownHtml = '';
            if (Object.keys(bServices).length > 0) {
                for (const [srv, count] of Object.entries(bServices)) {
                    bBreakdownHtml += `<div style="font-size:0.85em; color:#555; padding-left: 10px; margin-top:2px;">↳ ${count}x ${srv}</div>`;
                }
            } else { bBreakdownHtml = `<div style="font-size:0.85em; color:#999; padding-left: 10px;">↳ No cuts yet</div>`; }

            // MODIFIED: Updated the Max line text to be dynamic based on current_limit
            barberCard.innerHTML = `
                <div style="cursor: pointer; background: #eee; padding: 5px 10px; border-radius: 4px; text-align: center; margin-bottom: 10px; transition: background 0.2s;" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='#eee'" onclick="window.toggleBreakdown('barber-${barber.id}')">
                    <strong>Cuts: ${barber.cuts_today}</strong> <span style="font-size:0.8em; color:#888; margin-left:5px;">${expandedBreakdowns['barber-'+barber.id] ? '▲' : '▼'}</span>
                </div>
                <div style="display: ${expandedBreakdowns['barber-'+barber.id] ? 'block' : 'none'}; background: #fafafa; border: 1px solid #ddd; padding: 10px; border-radius: 4px; margin-bottom: 15px; text-align: left;">
                    <strong style="display:block; font-size:0.9em; margin-bottom: 5px; color: var(--red);">Completed Services:</strong>
                    ${bBreakdownHtml}
                </div>
                <div class="card-header"><h2>${barber.name}</h2><span class="status-indicator" id="status-ind-${barber.id}"></span></div>
                <div id="dropzone-${barber.id}" class="active-seat-zone"></div>
                <div class="waiting-line-group">
                    <div style="text-align:left; font-size:0.85em; font-weight:bold; color:#666; margin-bottom:5px;">Waiting Line (Max ${barber.current_limit || 2}):</div>
                    <div class="queue-row" id="queue-${barber.id}"></div>
                </div>
                <div class="walkin-group" style="display:flex; flex-direction:column; gap:3px;">
                    <input type="text" id="walkin-input-${barber.id}" class="walkin-input" placeholder="Enter name...">
                    ${serviceDropdownHtml}
                    <button class="btn btn-dark btn-small" id="submit-walkin-${barber.id}" style="margin-top:5px;">Add Walk-in</button>
                </div>
                <div class="controls" id="controls-${barber.id}"></div>
            `;
            
            document.getElementById(`submit-walkin-${barber.id}`).onclick = () => window.submitWalkIn(barber.id);
            barberCard.className = `seat-card status-${barber.status}`;
            document.getElementById(`status-ind-${barber.id}`).innerText = barber.status.toUpperCase();
            
            const dropzone = document.getElementById(`dropzone-${barber.id}`);
            if (barber.status === 'offline') {
                dropzone.innerHTML = `Offline`; dropzone.className = "active-seat-zone";
            
            } else if (barber.status === 'cutting' && barber.current_customer) {
                let elapsedMins = 0;
                if (barber.current_customer.start_time) {
                    let startTime = new Date(barber.current_customer.start_time);
                    elapsedMins = Math.floor(((Date.now() + globalTimeOffset) - startTime) / 60000);
                }
                
                let serviceText = barber.current_customer.service ? `<br><span style="font-size:0.9em; font-weight:600; color:#555;">${barber.current_customer.service}</span>` : '';
                dropzone.innerHTML = `<span style="color:var(--red); font-weight:bold;">Cutting: ${barber.current_customer.name}</span> ${serviceText}<br><span style="font-size:0.9em; color:#b71c1c; font-weight:bold; display:inline-block; margin-top:4px;">⏱️ Elapsed: ${elapsedMins} mins</span>`;
                dropzone.className = "active-seat-zone cutting";
            } else {
                dropzone.innerHTML = `Empty Seat`; dropzone.className = "active-seat-zone";
            }

            renderQueue(`queue-${barber.id}`, barber.queue, barber.id, barber.status);

            const input = document.getElementById(`walkin-input-${barber.id}`);
            const serviceDrop = document.getElementById(`walkin-service-${barber.id}`);
            const submitBtn = document.getElementById(`submit-walkin-${barber.id}`);
            
            let isFull = !barber.is_valid_choice && barber.status !== 'offline';
            input.disabled = isFull || barber.status === 'offline';
            serviceDrop.disabled = isFull || barber.status === 'offline';
            submitBtn.disabled = isFull || barber.status === 'offline';
            // MODIFIED: Updated the placeholder to dynamically show the limit
            input.placeholder = isFull ? `Line full (Max ${barber.current_limit || 2})` : "Enter name...";

            const controls = document.getElementById(`controls-${barber.id}`);
            let buttonsHtml = '';
            if (barber.status === 'offline') buttonsHtml = `<button class="btn btn-dark" onclick="window.updateStatus(${barber.id}, 'available')">Time In</button>`;
            else if (barber.status === 'available') buttonsHtml = `<button class="btn btn-outline" onclick="window.updateStatus(${barber.id}, 'offline')">Time Out</button>`;
            else if (barber.status === 'cutting') buttonsHtml = `<button class="btn btn-red" onclick="window.updateStatus(${barber.id}, 'available')">Finish Cut</button>`;
            
            if(controls.innerHTML !== buttonsHtml) { controls.innerHTML = buttonsHtml; }
        });

        renderAppointments(data.appointments, data.barbers);

    } catch (e) { console.error("Backend offline", e); }
    finally { isFetchingState = false; }
}

function renderQueue(queueContainerId, queueList, barberId, barberStatus) {
    const container = document.getElementById(queueContainerId);
    if (!container) return;
    container.innerHTML = '';
    if (queueList.length === 0) {
        container.innerHTML = '<span style="color:#bbb; font-size:0.8em; padding-top:10px;">Empty</span>';
        return;
    }
    
    const isOccupied = barberStatus === 'cutting';

    queueList.forEach(customer => {
        const chip = document.createElement('div');
        chip.className = 'name-chip';
        chip.style.display = 'flex'; chip.style.justifyContent = 'space-between'; chip.style.alignItems = 'center';
        chip.style.padding = '8px 12px'; chip.style.background = 'var(--black)';
        
        let serviceName = customer.service || "Haircut";
        let durationMins = customer.mins || 30;
        
        let seatButtonHtml = isOccupied 
            ? `<button disabled class="btn btn-dark" style="padding: 8px 15px; font-size: 0.9em; border-radius:6px; font-weight:bold; opacity: 0.4; cursor: not-allowed;" title="Finish current cut first">Seat</button>`
            : `<button onclick="window.updateStatus(${barberId}, 'cutting', ${customer.id})" class="btn btn-dark" style="padding: 8px 15px; font-size: 0.9em; border-radius:6px; font-weight:bold; border: 1px solid white;">Seat</button>`;

        chip.innerHTML = `
            <div style="display:flex; flex-direction:column; text-align:left;">
                <span style="font-weight:bold; font-size: 1.1em; color: white;">👤 ${customer.name}</span>
                <span style="font-size: 1.05em; color: #ffd700; font-weight: bold; margin-top: 4px; letter-spacing: 0.5px;">${serviceName} (${durationMins}m)</span>
            </div>
            <div style="display:flex; align-items:center; gap: 8px;">
                ${seatButtonHtml}
                <span onclick="window.removeFromQueue(${barberId}, ${customer.id}, event)" style="color: #ffaaaa; cursor: pointer; font-weight: bold; font-size: 1.2em; line-height: 1;" title="Remove from line">✕</span>
            </div>`;
        container.appendChild(chip);
    });
}

window.switchTab = (tabValue) => { currentApptTab = tabValue; fetchState(); };

function renderAppointments(appointments, barbers) {
    const list = document.getElementById('appointment-list');
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
    if (pendingAppts.length === 0) contentHtml += `<p style="color:#888; margin-bottom: 30px; text-align: center;">No pending requests in this view.</p>`;
    else pendingAppts.forEach(appt => { contentHtml += buildApptCard(appt, barbers, true); });

    contentHtml += `<h3 style="margin-top: 40px; margin-bottom: 15px; color: var(--red);">Accepted Appointments (${acceptedAppts.length})</h3>`;
    if (acceptedAppts.length === 0) contentHtml += `<p style="color:#888; text-align: center;">No accepted appointments in this view.</p>`;
    else acceptedAppts.forEach(appt => { contentHtml += buildApptCard(appt, barbers, false); });

    list.innerHTML = tabsHtml + contentHtml;
}

function buildApptCard(appt, barbers, isPending) {
    const barberName = barbers.find(b => b.id === appt.barber_id)?.name || "Unknown Barber";
    let serviceObj = globalServices.find(srv => srv.name === appt.service);
    let duration = serviceObj ? serviceObj.mins : 30;
    let displayTime = `${formatAMPM(appt.time)} - ${formatAMPM(calculateEndTime(appt.time, duration))}`;

    let actions = isPending ?
        `<button class="btn btn-dark" style="padding: 10px; font-size: 0.9em; margin-bottom:10px;" onclick="window.manageAppt(${appt.id}, 'accept')">Accept Request</button>
         <button class="btn btn-outline" style="padding: 10px; font-size: 0.9em;" onclick="window.manageAppt(${appt.id}, 'cancel')">Decline</button>` :
        `<span style="color:#00695c; font-weight:bold; font-size: 1em; text-align:center; display:block; margin-bottom:10px;">ACCEPTED</span>
         <button class="btn btn-dark" style="padding: 10px; font-size: 0.9em; margin-bottom: 5px; background: #00695c; border-color: #00695c;" onclick="window.manageAppt(${appt.id}, 'seat')">Seat Customer</button>
         <button class="btn btn-outline" style="padding: 10px; font-size: 0.9em;" onclick="window.manageAppt(${appt.id}, 'cancel')">Cancel Appt</button>`;

    return `
        <div style="display: flex; justify-content: space-between; align-items: center; background: ${isPending ? '#fdfdfd' : '#f4f4f4'}; border: 1px solid #ccc; border-left: 5px solid ${isPending ? 'var(--black)' : 'var(--red)'}; padding: 20px; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
            <div style="font-size: 0.95em; line-height: 1.6;">
                <h4 style="font-size: 1.2em; color: var(--red); margin-bottom: 8px;">${appt.date} @ <span style="color:var(--black);">${displayTime}</span></h4>
                <strong>Barber:</strong> ${barberName} <br>
                <strong>Customer:</strong> ${appt.customer_name || "N/A"} <br>
                <strong>Contact:</strong> ${appt.contact || "N/A"} <br>
                <strong>Service:</strong> <span style="font-weight:bold;">${appt.service}</span>
            </div>
            <div style="width: 180px; display: flex; flex-direction: column; justify-content: center;">
                ${actions}
            </div>
        </div>
    `;
}

window.updateStatus = async (barberId, status, customerId = null) => {
    await fetch(`${API_BASE}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ barber_id: barberId, status: status, customer_id: customerId }) });
    fetchState();
};

window.manageAppt = async (apptId, action) => {
    const res = await fetch(`${API_BASE}/appointments/manage`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ appt_id: apptId, action: action }) 
    });
    
    if (!res.ok && action === 'seat') {
        alert("Cannot seat this appointment. Make sure this Barber's active chair is entirely Empty first!");
    }
    fetchState();
};

window.submitWalkIn = async (barberId) => {
    const input = document.getElementById(`walkin-input-${barberId}`);
    const serviceDrop = document.getElementById(`walkin-service-${barberId}`);
    if (!input.value.trim()) return alert("Please enter a name.");
    const res = await fetch(`${API_BASE}/queue/walk-in`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barber_id: barberId, customer_name: input.value.trim(), service: serviceDrop.value, mins: parseInt(serviceDrop.options[serviceDrop.selectedIndex].getAttribute('data-mins')) })
    });
    const data = await res.json();
    if (res.status === 200 && !data.success) alert("This barber's queue became full.");
    else if (res.status === 200 && data.success) input.value = "";
    fetchState();
};

window.removeFromQueue = async (barberId, customerId, event) => {
    event.stopPropagation();
    if (confirm("Remove this customer from the waiting line?")) {
        await fetch(`${API_BASE}/queue/remove`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ barber_id: barberId, customer_id: customerId }) });
        fetchState();
    }
};

window.saveCurrentRecords = async () => {
    if (confirm("Save the current floor numbers into today's History Record? (This will add to the existing record if you've already saved today)")) {
        await fetch(`${API_BASE}/save-records`, { method: 'POST' });
        alert("Records updated successfully!");
        fetchState();
    }
};

// ... (Keep the rest of your main.js file the exact same until this function) ...

window.openAdminModal = (action) => {
    const modal = document.getElementById('admin-modal');
    const body = document.getElementById('admin-modal-body');
    modal.style.display = 'flex';
    
    let html = '';
    
    if (action === 'addBarber') {
        html = `
            <h2 style="margin-bottom:25px; color:var(--red); text-align:center; font-size:1.8em;">Add New Barber</h2>
            <div class="modal-form-group">
                <label>Barber Name:</label>
                <input type="text" id="modal-barber-name">
            </div>
            <button class="btn btn-red" style="width:100%; font-size:1.2em; padding:15px; margin-top:10px;" onclick="window.submitAddBarber()">Save Barber</button>
        `;
    } 
    else if (action === 'removeBarber') {
        let options = '<option value="">-- Select Barber --</option>';
        globalBarbers.forEach(b => options += `<option value="${b.id}">${b.name}</option>`);
        html = `
            <h2 style="margin-bottom:25px; color:var(--red); text-align:center; font-size:1.8em;">Remove Barber</h2>
            <div class="modal-form-group">
                <label>Target Barber:</label>
                <select id="modal-barber-id">${options}</select>
            </div>
            <button class="btn btn-dark" style="width:100%; font-size:1.2em; padding:15px; margin-top:10px;" onclick="window.submitRemoveBarber()">Delete Barber</button>
        `;
    }
    else if (action === 'viewServices') {
        let listHtml = '';
        globalServices.forEach(s => {
            let isAvail = s.available !== false; 
            let btnStyle = isAvail ? "background: #00695c; color: white;" : "background: #b71c1c; color: white;";
            let btnText = isAvail ? "Available" : "Not Available";
            let opacity = isAvail ? "1" : "0.5";
            
            listHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 15px 0; border-bottom: 1px solid #eee; opacity: ${opacity};">
                    <div style="line-height: 1.5;">
                        <strong style="font-size: 1.3em; color: var(--black);">${s.name}</strong> - <span style="color:var(--red); font-weight:bold; font-size: 1.2em;">${s.price || "N/A"}</span><br>
                        <span style="font-size:1em; color:#666;">${s.mins} mins | ${s.desc || "No description"}</span>
                    </div>
                    <button onclick="window.toggleService('${s.name}')" style="padding: 10px 20px; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:1em; ${btnStyle}">${btnText}</button>
                </div>
            `;
        });
        html = `
            <h2 style="margin-bottom:10px; color:var(--red); text-align:center; font-size:1.8em;">Manage Services Menu</h2>
            <p style="font-size:1em; color:#666; margin-bottom: 20px; text-align:center;">Click the status button to disable/enable a service for walk-ins and customer bookings.</p>
            <div style="max-height: 500px; overflow-y: auto; border: 1px solid #ccc; border-radius: 6px; padding: 15px; background: #fafafa;">
                ${listHtml}
            </div>
        `;
    }
    else if (action === 'addService') {
        html = `
            <h2 style="margin-bottom:25px; color:var(--red); text-align:center; font-size:1.8em;">Add New Service</h2>
            <div class="modal-form-group">
                <label>Service Name:</label>
                <input type="text" id="svc-name">
            </div>
            <div class="modal-form-group">
                <label>Price:</label>
                <input type="text" id="svc-price">
            </div>
            <div class="modal-form-group">
                <label>Description:</label>
                <input type="text" id="svc-desc">
            </div>
            <div class="modal-form-group">
                <label>Duration (Mins):</label>
                <input type="number" id="svc-mins">
            </div>
            <button class="btn btn-red" style="width:100%; font-size:1.2em; padding:15px; margin-top:10px;" onclick="window.submitAddService()">Save Service</button>
        `;
    } 
    else if (action === 'editService') {
        let options = '<option value="">-- Select Service to Edit --</option>';
        globalServices.forEach(s => options += `<option value="${s.name}">${s.name}</option>`);
        html = `
            <h2 style="margin-bottom:25px; color:var(--red); text-align:center; font-size:1.8em;">Edit Service</h2>
            <div class="modal-form-group">
                <label>Target Service:</label>
                <select id="edit-svc-select" onchange="window.populateEditForm()">${options}</select>
            </div>
            <div id="edit-fields" style="display:none;">
                <input type="hidden" id="edit-old-name">
                <div class="modal-form-group"><label>New Name:</label><input type="text" id="edit-svc-name"></div>
                <div class="modal-form-group"><label>Price:</label><input type="text" id="edit-svc-price"></div>
                <div class="modal-form-group"><label>Description:</label><input type="text" id="edit-svc-desc"></div>
                <div class="modal-form-group"><label>Duration (Mins):</label><input type="number" id="edit-svc-mins"></div>
                <button class="btn btn-dark" style="width:100%; font-size:1.2em; padding:15px; margin-top:10px;" onclick="window.submitEditService()">Update Service</button>
            </div>
        `;
    } 
    else if (action === 'removeService') {
        let options = '<option value="">-- Select Service to Remove --</option>';
        globalServices.forEach(s => options += `<option value="${s.name}">${s.name}</option>`);
        html = `
            <h2 style="margin-bottom:25px; color:var(--red); text-align:center; font-size:1.8em;">Remove Service</h2>
            <div class="modal-form-group">
                <label>Target Service:</label>
                <select id="remove-svc-select">${options}</select>
            </div>
            <button class="btn btn-dark" style="width:100%; font-size:1.2em; padding:15px; margin-top:10px;" onclick="window.submitRemoveService()">Delete Service</button>
        `;
    }
    
    body.innerHTML = html;
};

// ... (Keep the rest of the functions like closeAdminModal below this untouched) ...

window.closeAdminModal = () => { document.getElementById('admin-modal').style.display = 'none'; };

window.populateEditForm = () => {
    const val = document.getElementById('edit-svc-select').value;
    const fields = document.getElementById('edit-fields');
    if(!val) { fields.style.display = 'none'; return; }
    
    const srv = globalServices.find(s => s.name === val);
    if(srv) {
        document.getElementById('edit-old-name').value = srv.name;
        document.getElementById('edit-svc-name').value = srv.name;
        document.getElementById('edit-svc-price').value = srv.price || "";
        document.getElementById('edit-svc-desc').value = srv.desc || "";
        document.getElementById('edit-svc-mins').value = srv.mins || 30;
        fields.style.display = 'block';
    }
};

window.submitAddBarber = async () => {
    let name = document.getElementById('modal-barber-name').value.trim();
    if (!name) return alert("Enter a name.");
    await fetch(`${API_BASE}/add-barber`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name })
    });
    window.closeAdminModal();
    fetchState();
};

window.submitRemoveBarber = async () => {
    let targetId = document.getElementById('modal-barber-id').value;
    if (!targetId) return alert("Select a barber.");
    if (confirm(`Are you absolutely sure you want to permanently delete this Barber?`)) {
        await fetch(`${API_BASE}/remove-barber`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ barber_id: parseInt(targetId) })
        });
        window.closeAdminModal();
        fetchState();
    }
};

window.submitAddService = async () => {
    let name = document.getElementById('svc-name').value.trim();
    let price = document.getElementById('svc-price').value.trim();
    let desc = document.getElementById('svc-desc').value.trim();
    let mins = document.getElementById('svc-mins').value;
    if (!name || !price || !desc || !mins) return alert("Please fill all fields.");

    await fetch(`${API_BASE}/add-service`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price, desc, mins: parseInt(mins) })
    });
    window.closeAdminModal();
    fetchState();
};

window.submitEditService = async () => {
    let oldName = document.getElementById('edit-old-name').value;
    let newName = document.getElementById('edit-svc-name').value.trim();
    let newPrice = document.getElementById('edit-svc-price').value.trim();
    let newDesc = document.getElementById('edit-svc-desc').value.trim();
    let newMins = document.getElementById('edit-svc-mins').value;
    
    if (!newName || !newPrice || !newDesc || !newMins) return alert("Please fill all fields.");

    await fetch(`${API_BASE}/edit-service`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_name: oldName, new_name: newName, price: newPrice, desc: newDesc, mins: parseInt(newMins) })
    });
    window.closeAdminModal();
    fetchState();
};

window.submitRemoveService = async () => {
    let name = document.getElementById('remove-svc-select').value;
    if (!name) return alert("Select a service.");
    
    if (confirm(`Are you completely sure you want to delete the service: "${name}"?`)) {
        await fetch(`${API_BASE}/remove-service`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name })
        });
        window.closeAdminModal();
        fetchState();
    }
};

window.toggleService = async (name) => {
    await fetch(`${API_BASE}/toggle-service`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name })
    });
    await fetchState();
    window.openAdminModal('viewServices'); 
};

window.openTimeOverrideModal = () => {
    const overlay = document.createElement("div");
    overlay.id = "time-override-modal";
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;";
    
    const officialTime = new Date(Date.now() + globalTimeOffset);
    const yyyy = officialTime.getFullYear();
    const mm = String(officialTime.getMonth() + 1).padStart(2, '0');
    const dd = String(officialTime.getDate()).padStart(2, '0');
    const hrs = String(officialTime.getHours()).padStart(2, '0');
    const mins = String(officialTime.getMinutes()).padStart(2, '0');

    overlay.innerHTML = `
        <div style="background:white; padding:30px; border-radius:10px; max-width:400px; width: 90%; border-top: 5px solid var(--red); position: relative;">
            <button onclick="document.getElementById('time-override-modal').remove()" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 1.5em; cursor: pointer; color: #888;">&times;</button>
            <h3 style="margin-bottom:15px; color:var(--black);">Configure Official Time</h3>
            <p style="font-size:0.85em; color:#666; margin-bottom: 15px;">Setting a time here will change the official shop clock for all admins and customers globally.</p>
            <div class="form-group" style="margin-bottom:10px;">
                <label style="font-size:0.85em; font-weight:bold;">Date</label>
                <input type="date" id="override-date" class="form-control" value="${yyyy}-${mm}-${dd}">
            </div>
            <div class="form-group" style="margin-bottom:20px;">
                <label style="font-size:0.85em; font-weight:bold;">Time</label>
                <input type="time" id="override-time" class="form-control" value="${hrs}:${mins}">
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-red" style="flex:1;" onclick="window.submitTimeOverride()">Set Official Time</button>
                <button class="btn btn-outline" style="flex:1;" onclick="window.resetTimeOverride()">Sync Real Time</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
};

window.submitTimeOverride = async () => {
    const d = document.getElementById('override-date').value;
    const t = document.getElementById('override-time').value;
    if (!d || !t) return alert('Please select both date and time.');
    
    const targetTime = new Date(`${d}T${t}:00`);
    const offsetMs = targetTime.getTime() - Date.now(); 
    
    await fetch(`${API_BASE}/set-official-time`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offset_ms: offsetMs })
    });
    
    document.getElementById('time-override-modal').remove();
    fetchState(); 
};

window.resetTimeOverride = async () => {
    await fetch(`${API_BASE}/set-official-time`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offset_ms: 0 })
    });
    document.getElementById('time-override-modal').remove();
    fetchState();
};

fetchState();
setInterval(fetchState, 4000);