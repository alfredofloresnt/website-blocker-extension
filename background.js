const ALARM_NAME = 'blockCheckAlarm';
const RULE_ID_OFFSET = 1000; // Offset to avoid conflicts with other rules

// Load user settings from storage
function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ['blockedSites', 'startHour', 'endHour'],
      (data) => {
        const blockedSites = data.blockedSites || [];
        const startHour = typeof data.startHour === 'number' ? data.startHour : 9;  // default 9 AM
        const endHour = typeof data.endHour === 'number' ? data.endHour : 17; // default 5 PM
        console.log('Loaded settings:', { blockedSites, startHour, endHour });

        resolve({ blockedSites, startHour, endHour });
      }
    );
  });
}

// Check if current time is within the blocked window
function isWithinBlockTime(startHour, endHour) {
  const now = new Date();
  const currentHour = now.getHours();

  // Case 1:  startHour < endHour
  if (startHour < endHour) {
    return currentHour >= startHour && currentHour < endHour;
  }
  // Case 2:  blocked window wraps past midnight (e.g., 22 (10 PM) to 6 (6 AM))
  else if (startHour > endHour) {
    return currentHour >= startHour || currentHour < endHour;
  }
  else {
    return false;
  }
}

// Builds dynamic redirect rules for each blocked site
function buildRedirectRules(blockedSites) {
  const rules = blockedSites.map((site, index) => {
    return {
      id: RULE_ID_OFFSET + index,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          url: ''
        }
      },
      condition: {
        urlFilter: `${site}`,
        resourceTypes: ["main_frame"]
      }
    };
  });

  // Set the redirect URL for each rule
  const blockUrl = chrome.runtime.getURL('block.html');
  for (let rule of rules) {
    rule.action.redirect.url = blockUrl;
  }

  return rules;
}

// Updates dynamic rules to block or unblock sites
async function updateBlockingRules() {
  const { blockedSites, startHour, endHour } = await loadSettings();

  const shouldBlock = isWithinBlockTime(startHour, endHour);

  // The IDs we plan to use for this extension’s blocking rules
  let ruleIdsToManage = blockedSites.map((_site, i) => RULE_ID_OFFSET + i);

  if (shouldBlock) {
    // Build an array of rules we want to ADD
    const newRules = buildRedirectRules(blockedSites);

    // First remove any old rules in our ID range, then add the new ones
    chrome.declarativeNetRequest.updateDynamicRules(
      {
        addRules: newRules,
        removeRuleIds: ruleIdsToManage
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error('Error adding rules:', chrome.runtime.lastError);
        } else {
          console.log('Blocking rules added for sites:', blockedSites);
        }
      }
    );
  } else {
    // Outside block time, remove all rules in our ID range
    chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [],
      removeRuleIds: await getAllRulesIds()
    },
      () => {
        if (chrome.runtime.lastError) {
          console.error('Error removing rules:', chrome.runtime.lastError);
        } else {
          console.log('Blocking rules removed. Sites are accessible now.');
        }
      }
    );
  }
}

async function getAllRulesIds() {
  return new Promise((resolve) => {
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
      const ruleIds = rules.map(rule => rule.id);
      resolve(ruleIds);
    });
  });
}

// Schedule an alarm to check every 1 minute
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  // Initialaize rules
  updateBlockingRules().catch(console.error);
});

// Listen for the alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    await updateBlockingRules();
  }
});

// Update rules if the extension restarts
chrome.runtime.onStartup.addListener(() => {
  updateBlockingRules().catch(console.error);
});

// Update rules if the settings change
chrome.storage.onChanged.addListener(() => {
  updateBlockingRules().catch(console.error);
});
