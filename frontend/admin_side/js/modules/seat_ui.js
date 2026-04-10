function createSeatCard(barber) {
    const card = document.createElement('div');
    card.className = `seat-card status-${barber.status}`;
    
    // Create Dropzone UI
    let activeSeatHtml = '';
    if (barber.status === 'offline') {
        activeSeatHtml = `<div class="active-seat-zone">Barber Offline</div>`;
    } else if (barber.status === 'cutting' && barber.current_customer) {
        activeSeatHtml = `<div class="active-seat-zone cutting">✂️ Cutting: ${barber.current_customer.name}</div>`;
    } else {
        activeSeatHtml = `
            <div class="active-seat-zone" 
                 ondragover="event.preventDefault(); this.classList.add('drag-over')" 
                 ondragleave="this.classList.remove('drag-over')" 
                 ondrop="window.handleDrop(event, ${barber.id})">
                 Drop Name Here to Start Cut
            </div>`;
    }

    // Control Buttons
    let buttonsHtml = '';
    if (barber.status === 'offline') {
        buttonsHtml = `<button class="btn btn-dark" onclick="window.updateStatus(${barber.id}, 'available')">Time In</button>`;
    } else if (barber.status === 'available') {
        buttonsHtml = `<button class="btn btn-outline" onclick="window.updateStatus(${barber.id}, 'offline')">Time Out</button>`;
    } else if (barber.status === 'cutting') {
        buttonsHtml = `<button class="btn btn-red" onclick="window.updateStatus(${barber.id}, 'available')">Finish Cut</button>`;
    }

    card.innerHTML = `
        <div class="counter-display">
            <span>✂️ Total Cuts: ${barber.cuts_today}</span>
            <button class="edit-counter-btn" onclick="window.promptEditCounter(${barber.id}, ${barber.cuts_today})" title="Edit Count">✎</button>
        </div>
        
        <h2>${barber.name}</h2>
        <span class="status-indicator">${barber.status.toUpperCase()}</span>
        
        ${activeSeatHtml}

        <div style="text-align:left; font-size:0.85em; font-weight:bold; color:#666;">Waiting Line:</div>
        <div class="queue-row" id="queue-${barber.id}">
            </div>

        <div class="walkin-input-group">
            <input type="text" id="walkin-input-${barber.id}" class="walkin-input" placeholder="Enter customer name..." ${barber.status === 'offline' ? 'disabled' : ''}>
            <button class="btn btn-dark btn-small" onclick="window.submitWalkIn(${barber.id})" ${barber.status === 'offline' ? 'disabled' : ''}>Add</button>
        </div>

        <div class="controls" style="margin-top:20px;">${buttonsHtml}</div>
    `;
    return card;
}