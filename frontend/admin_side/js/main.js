const API_BASE = 'http://127.0.0.1:5000/api/admin';
let currentApptTab = 'All'; 

const SERVICE_MENU = [
    { name: "Haircut", mins: 30 }, { name: "Haircut & Style", mins: 45 },
    { name: "Haircut & Shave", mins: 60 }, { name: "Kiddie MugShot", mins: 45 },
    { name: "MugShot Favorite", mins: 60 }, { name: "MugShot Sulit", mins: 45 },
    { name: "MugShot Supreme", mins: 90 }, { name: "MugShot Elite", mins: 120 },
    { name: "Scalp / Hair Treatment", mins: 45 }, { name: "Beard Sculpting", mins: 20 },
    { name: "Shave", mins: 30 }, { name: "Hair Coloring", mins: 120 },
    { name: "Hair Art", mins: 30 }, { name: "Shampoo & Blow dry", mins: 15 }
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
        
        const grid = document.getElementById('seat-grid');
        
        let shopTotalCuts = data.barbers.reduce((sum, b) => sum + b.cuts_today, 0);
        let subHeader = document.getElementById('dashboard-page-subheader');
        if(!subHeader){
            subHeader = document.createElement('section');
            subHeader.id = 'dashboard-page-subheader';
            subHeader.className = 'page-subheader';
            grid.parentElement.insertBefore(subHeader, grid);
        }
        subHeader.innerHTML = `<span class="subheader-title">Live Barbershop Floor</span>
                              <span class="total-cuts-shop">✂️ Total Shop Cuts: ${shopTotalCuts}</span>`;

        data.barbers.forEach((barber) => {
            const barberCardId = `barber-card-${barber.id}`;
            let barberCard = document.getElementById(barberCardId);
            
            if(!barberCard){
                barberCard = document.createElement('div');
                barberCard.id = barberCardId;
                barberCard.className = `seat-card status-${barber.status}`;
                grid.appendChild(barberCard);
                barberCard.innerHTML = `
                    <div class="counter-group">Cuts: <span id="counter-${barber.id}"></span> <button class="edit-counter-btn" id="edit-counter-${barber.id}">✎</button></div>
                    <div class="card-header">
                        <h2>${barber.name}</h2>
                        <span class="status-indicator" id="status-ind-${barber.id}"></span>
                    </div>
                    <div id="dropzone-${barber.id}" class="active-seat-zone"></div>
                    <div class="waiting-line-group">
                        <div style="text-align:left; font-size:0.85em; font-weight:bold; color:#666; margin-bottom:5px;">Waiting Line (Max 2):</div>
                        <div class="queue-row" id="queue-${barber.id}"></div>
                    </div>
                    <div class="walkin-group">
                        <input type="text" id="walkin-input-${barber.id}" class="walkin-input" placeholder="Enter name...">
                        <button class="btn btn-dark btn-small" id="submit-walkin-${barber.id}">Add</button>
                    </div>
                    <div class="controls" id="controls-${barber.id}"></div>
                `;
                
                document.getElementById(`submit-walkin-${barber.id}`).onclick = () => window.submitWalkIn(barber.id);
                document.getElementById(`edit-counter-${barber.id}`).onclick = () => window.promptEditCounter(barber.id, barber.cuts_today);
                
                const dropzone = document.getElementById(`dropzone-${barber.id}`);
                dropzone.ondragover = (event) => { event.preventDefault(); dropzone.classList.add('drag-over') };
                dropzone.ondragleave = () => { dropzone.classList.remove('drag-over') };
                dropzone.ondrop = (event) => { window.handleDrop(event, barber.id) };
            }

            barberCard.className = `seat-card status-${barber.status}`;
            document.getElementById(`counter-${barber.id}`).innerText = barber.cuts_today;
            document.getElementById(`status-ind-${barber.id}`).innerText = barber.status.toUpperCase();
            
            const dropzone = document.getElementById(`dropzone-${barber.id}`);
            if (barber.status === 'offline') {
                dropzone.innerHTML = `Offline`;
                dropzone.className = "active-seat-zone";
            } else if (barber.status === 'cutting' && barber.current_customer) {
                dropzone.innerHTML = `✂️ Cutting: ${barber.current_customer.name}`;
                dropzone.className = "active-seat-zone cutting";
            } else {
                dropzone.innerHTML = `Drop Name Here`;
                dropzone.className = "active-seat-zone";
            }

            renderQueue(`queue-${barber.id}`, barber.queue, barber.id);

            const input = document.getElementById(`walkin-input-${barber.id}`);
            const submitBtn = document.getElementById(`submit-walkin-${barber.id}`);
            input.disabled = !barber.is_valid_choice || barber.status === 'offline';
            submitBtn.disabled = !barber.is_valid_choice || barber.status === 'offline';
            
            if (!barber.is_valid_choice && barber.status !== 'offline'){ 
                input.placeholder = "Line full (Max 2)";
            } else { 
                input.placeholder = "Enter name...";
            }

            const controls = document.getElementById(`controls-${barber.id}`);
            let buttonsHtml = '';
            if (barber.status === 'offline') {
                buttonsHtml = `<button class="btn btn-dark" onclick="window.updateStatus(${barber.id}, 'available')">Time In</button>`;
            } else if (barber.status === 'available') {
                buttonsHtml = `<button class="btn btn-outline" onclick="window.updateStatus(${barber.id}, 'offline')">Time Out</button>`;
            } else if (barber.status === 'cutting') {
                buttonsHtml = `<button class="btn btn-red" onclick="window.updateStatus(${barber.id}, 'available')">Finish Cut</button>`;
            }
            if(controls.innerHTML !== buttonsHtml) { controls.innerHTML = buttonsHtml; }
        });

        renderAppointments(data.appointments, data.barbers);

    } catch (e) { console.error("Backend offline", e); }
}

function renderQueue(queueContainerId, queueList, barberId) {
    const container = document.getElementById(queueContainerId);
    if (!container) return;
    
    let currentIds = Array.from(container.querySelectorAll('.name-chip')).map(chip => chip.dataset.customerId);
    let newIds = queueList.map(customer => String(customer.id));

    if (JSON.stringify(currentIds) === JSON.stringify(newIds)) return;

    container.innerHTML = '';
    if (queueList.length === 0) {
        container.innerHTML = '<span style="color:#bbb; font-size:0.8em; padding-top:10px;">Empty</span>';
        return;
    }

    queueList.forEach(customer => {
        const chip = document.createElement('div');
        chip.className = 'name-chip';
        chip.dataset.customerId = customer.id;
        chip.draggable = true;
        chip.ondragstart = (event) => { event.dataTransfer.setData('text/plain', customer.id); };
        
        // Added the clickable "✕" icon for removing a walk-in
        chip.innerHTML = `👤 ${customer.name} 
            <span onclick="window.removeFromQueue(${barberId}, ${customer.id}, event)" 
                  style="margin-left: 8px; color: #ffaaaa; cursor: pointer; font-weight: bold; font-size: 1.1em;" 
                  title="Remove from line">✕</span>`;
        container.appendChild(chip);
    });
}

window.switchTab = (tabValue) => {
    currentApptTab = tabValue;
    fetchState(); 
};

function renderAppointments(appointments, barbers) {
    const list = document.getElementById('appointment-list');
    
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
        contentHtml += `<p style="color:#888; margin-bottom: 30px; text-align: center;">No pending requests in this view.</p>`;
    } else {
        pendingAppts.forEach(appt => { contentHtml += buildApptCard(appt, barbers, true); });
    }

    contentHtml += `<h3 style="margin-top: 40px; margin-bottom: 15px; color: var(--red);">Accepted Appointments (${acceptedAppts.length})</h3>`;
    if (acceptedAppts.length === 0) {
        contentHtml += `<p style="color:#888; text-align: center;">No accepted appointments in this view.</p>`;
    } else {
        acceptedAppts.forEach(appt => { contentHtml += buildApptCard(appt, barbers, false); });
    }

    list.innerHTML = tabsHtml + contentHtml;
}

function buildApptCard(appt, barbers, isPending) {
    const barberName = barbers.find(b => b.id === appt.barber_id)?.name || "Unknown Barber";
    
    // Time Calculations for End Time Display
    let serviceObj = SERVICE_MENU.find(srv => srv.name === appt.service);
    let duration = serviceObj ? serviceObj.mins : 30;
    let end24 = calculateEndTime(appt.time, duration);
    let displayTime = `${formatAMPM(appt.time)} - ${formatAMPM(end24)}`;

    let actions = isPending ?
        `<button class="btn btn-dark" style="padding: 10px; font-size: 0.9em; margin-bottom:10px;" onclick="window.manageAppt(${appt.id}, 'accept')">Accept Request</button>
         <button class="btn btn-outline" style="padding: 10px; font-size: 0.9em;" onclick="window.manageAppt(${appt.id}, 'cancel')">Decline</button>` :
        `<span style="color:#00695c; font-weight:bold; font-size: 1em; text-align:center; display:block; margin-bottom:10px;">ACCEPTED</span>
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

// API Calls
window.updateStatus = async (barberId, status, customerId = null) => {
    await fetch(`${API_BASE}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barber_id: barberId, status: status, customer_id: customerId })
    });
    fetchState();
};

window.manageAppt = async (apptId, action) => {
    await fetch(`${API_BASE}/appointments/manage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appt_id: apptId, action: action })
    });
    fetchState();
};

window.submitWalkIn = async (barberId) => {
    const input = document.getElementById(`walkin-input-${barberId}`);
    const name = input.value.trim();
    if (!name) return alert("Please enter a name.");

    const res = await fetch(`${API_BASE}/queue/walk-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barber_id: barberId, customer_name: name })
    });
    
    const resultData = await res.json();
    if (res.status === 200 && !resultData.success) {
        alert("This barber's queue became full, please choose another.");
    } else if (res.status === 200 && resultData.success) {
        input.value = "";
    } else {
        alert("Failed to add walk-in.");
    }
    fetchState();
};

window.handleDrop = (event, barberId) => {
    event.preventDefault();
    document.getElementById(`dropzone-${barberId}`).classList.remove('drag-over');
    const customerId = event.dataTransfer.getData('text/plain');
    if (customerId) {
        window.updateStatus(barberId, 'cutting', customerId);
    }
};

// NEW: Remove from Queue function
window.removeFromQueue = async (barberId, customerId, event) => {
    event.stopPropagation(); // Prevents the drag-and-drop from triggering when you click the X
    if (confirm("Remove this customer from the waiting line?")) {
        await fetch(`${API_BASE}/queue/remove`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barber_id: barberId, customer_id: customerId })
        });
        fetchState();
    }
};

window.promptEditCounter = async (barberId, currentCount) => {
    let newCount = prompt("Edit total cuts for this barber:", currentCount);
    if (newCount === null || newCount === "") return; 
    if (isNaN(newCount) || newCount < 0) return alert("Please enter a positive number.");

    if (confirm(`Change cuts from ${currentCount} to ${newCount}?`)) {
        await fetch(`${API_BASE}/edit-counter`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barber_id: barberId, new_count: newCount })
        });
        fetchState();
    }
};

fetchState();
setInterval(fetchState, 2000);