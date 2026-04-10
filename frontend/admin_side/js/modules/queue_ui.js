function renderQueue(queueContainerId, queueList) {
    const container = document.getElementById(queueContainerId);
    if (!container) return;
    
    container.innerHTML = '';
    if (queueList.length === 0) {
        container.innerHTML = '<span style="color:#bbb; font-size:0.85em; width:100%; text-align:center; padding-top:10px;">Queue is empty</span>';
        return;
    }

    queueList.forEach(customer => {
        const chip = document.createElement('div');
        chip.className = 'name-chip';
        chip.draggable = true;
        // Package the data so the dropzone knows who was dropped
        chip.ondragstart = (event) => {
            event.dataTransfer.setData('text/plain', customer.id);
        };
        chip.innerHTML = `👤 ${customer.name}`;
        container.appendChild(chip);
    });
}