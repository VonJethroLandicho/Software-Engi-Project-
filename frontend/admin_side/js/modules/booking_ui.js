function renderAppointments(appointments, barbers) {
    const list = document.getElementById('appointment-list');
    list.innerHTML = '';

    if (appointments.length === 0) {
        list.innerHTML = '<p style="color:#888; text-align:center;">No pending appointments.</p>';
        return;
    }

    appointments.forEach(appt => {
        const barberName = barbers.find(b => b.id === appt.barber_id)?.name || "Unknown Barber";
        const item = document.createElement('div');
        item.className = 'appt-item';
        
        let actions = '';
        if (appt.status === 'pending') {
            actions = `
                <button class="btn btn-dark" onclick="window.manageAppt(${appt.id}, 'accept')">Accept</button>
                <button class="btn btn-outline" onclick="window.manageAppt(${appt.id}, 'cancel')">Decline</button>
            `;
        } else {
            actions = `<span style="color:#00695c; font-weight:bold; width:100%; text-align:center;">Accepted</span>
                       <button class="btn btn-outline" onclick="window.manageAppt(${appt.id}, 'cancel')" style="margin-left:10px;">Cancel</button>`;
        }

        item.innerHTML = `
            <div>
                <strong>${barberName}</strong> - ${appt.time} <br/>
                <span style="color:#666; font-size:0.9em;">Service: ${appt.service}</span>
            </div>
            <div class="appt-actions">${actions}</div>
        `;
        list.appendChild(item);
    });
}