const blockedSitesInput = document.getElementById('blockedSites');
const startHourInput = document.getElementById('startHour');
const endHourInput = document.getElementById('endHour');
const saveBtn = document.getElementById('saveBtn');

// Load existing settings when the page is opened
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['blockedSites', 'startHour', 'endHour'], (data) => {
    if (data.blockedSites) {
      blockedSitesInput.value = data.blockedSites.join(', ');
    }
    if (typeof data.startHour === 'number') {
      startHourInput.value = data.startHour;
    }
    if (typeof data.endHour === 'number') {
      endHourInput.value = data.endHour;
    }
  });
});

// Save settings when the user clicks "Save"
saveBtn.addEventListener('click', () => {
  const sitesString = blockedSitesInput.value.trim();
  const sitesArray = sitesString.split(',').map(s => s.trim()).filter(s => s);
  
  const start = parseInt(startHourInput.value, 10) || 0;
  const end = parseInt(endHourInput.value, 10) || 0;

  chrome.storage.sync.set({
    blockedSites: sitesArray,
    startHour: start,
    endHour: end
  }, () => {
    alert('Settings saved!');
  });
});
