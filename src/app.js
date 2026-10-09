/**
 * Fuljhori Period Tracker - Canonical App Logic
 * Single, consolidated implementation for all major features
 */

const STATE = {
  profile: null,
  periods: [],
  logs: {},
  settings: {
    displayMode: 'light',
    colorTheme: 'rose-bloom',
    pinEnabled: false,
    pin: null,
    remindersEnabled: false,
    reminderTime: '08:00',
    notificationPreferences: {
      enabled: false,
      time: '08:00',
      period: true,
      ovulation: true,
      selfCare: true,
      water: true
    }
  },
  streak: { current: 0, longest: 0, lastDate: null },
  bookmarks: {},
  backupMeta: {}
};
window.STATE = STATE;

// --- Canonical Date & Localization Helpers ---
function toBanglaNumber(num) {
  if (num == null) return '';
  const e2b = { '0':'০', '1':'১', '2':'২', '3':'৩', '4':'৪', '5':'৫', '6':'৬', '7':'৭', '8':'৮', '9':'৯' };
  return String(num).split('').map(c => e2b[c] || c).join('');
}
window.toBanglaNumber = toBanglaNumber;

function parseLocalDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return new Date(val.getFullYear(), val.getMonth(), val.getDate(), 0, 0, 0, 0);
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }
  if (typeof val === 'string') {
    const match = val.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const y = parseInt(match[1], 10);
      const m = parseInt(match[2], 10) - 1;
      const d = parseInt(match[3], 10);
      const res = new Date(y, m, d, 0, 0, 0, 0);
      return isNaN(res.getTime()) ? null : res;
    }
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  }
  return null;
}
window.parseLocalDate = parseLocalDate;

function addDays(dateObj, days) {
  const d = parseLocalDate(dateObj);
  if (!d) return null;
  d.setDate(d.getDate() + (parseInt(days, 10) || 0));
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
window.addDays = addDays;

function diffInDays(dateA, dateB) {
  const da = parseLocalDate(dateA);
  const db = parseLocalDate(dateB);
  if (!da || !db) return 0;
  const utcA = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const utcB = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((utcA - utcB) / (1000 * 60 * 60 * 24));
}
window.diffInDays = diffInDays;

function getLocalDateString(dateObj) {
  if (!dateObj) return '';
  const d = parseLocalDate(dateObj);
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
window.getLocalDateString = getLocalDateString;

function formatBanglaDate(dateObj) {
  const d = parseLocalDate(dateObj);
  if (!d) return '';
  const bnMonths = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  return `${toBanglaNumber(d.getDate())} ${bnMonths[d.getMonth()]}, ${toBanglaNumber(d.getFullYear())}`;
}
window.formatBanglaDate = formatBanglaDate;

function formatBanglaShortDate(dateObj) {
  const d = parseLocalDate(dateObj);
  if (!d) return '';
  const bnMonths = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  return `${toBanglaNumber(d.getDate())} ${bnMonths[d.getMonth()]}`;
}
window.formatBanglaShortDate = formatBanglaShortDate;

function getGreetingByTime(name) {
  const hour = new Date().getHours();
  let greeting = 'শুভ সকাল';
  if (hour >= 5 && hour < 12) {
    greeting = 'শুভ সকাল';
  } else if (hour >= 12 && hour < 16) {
    greeting = 'শুভ দুপুর';
  } else if (hour >= 16 && hour < 19) {
    greeting = 'শুভ বিকাল';
  } else {
    greeting = 'শুভ রাত';
  }
  return name ? `${greeting}, ${name}! 👋` : `${greeting}! 👋`;
}

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHTML = escapeHTML;

// --- Main Canonical Application Object ---
const app = {
  charts: {},
  pendingAction: null,
  pendingImportPayload: null,
  isEditingNotes: false,
  isLogDirty: false,
  _currentModalDate: null,
  _currentLogDate: null,
  predictions: null,
  reminderInterval: null,
  calContextDate: new Date(),

  // ==========================================
  // 1. DATA SAFETY & STORAGE LAYER (CANONICAL)
  // ==========================================
  safeParseJSON(str, fallback) {
    if (str === null || str === undefined) return fallback;
    if (typeof str !== 'string' || !str.trim()) return fallback;
    try {
      const parsed = JSON.parse(str);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (e) {
      console.warn("safeParseJSON caught malformed JSON:", e);
      return fallback;
    }
  },

  safeParse(str, fallback) {
    return this.safeParseJSON(str, fallback);
  },

  safeGet(key, fallback) {
    try {
      const val = localStorage.getItem(key);
      if (val === null || val === undefined) return fallback;
      return this.safeParseJSON(val, fallback);
    } catch (e) {
      console.warn(`safeGet error for ${key}:`, e);
      return fallback;
    }
  },

  safeSet(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn("Storage write error:", key, e);
      return false;
    }
  },

  safeGetStorage(key, defStr) {
    return this.safeGet(key, this.safeParseJSON(defStr, null));
  },

  safeSetStorage(key, data) {
    return this.safeSet(key, data);
  },

  saveData(key, data) {
    this.safeSet(key, data);
  },

  recover(group, err) {
    console.warn(`Recovering corrupted storage for ${group}:`, err);
    this.showToast('🌸 অ্যাপের কিছু তথ্য নিরাপদে পুনরুদ্ধার করা হয়েছে');
  },

  validate(group, data, context) {
    if (group === 'profile') return this.validateProfile(data);
    if (group === 'periods') return this.validatePeriods(data);
    if (group === 'logs') return this.validateLogs(data);
    if (group === 'dailyLog') return this.validateDailyLog(data, context);
    if (group === 'settings') return this.validateSettings(data);
    if (group === 'streak') return this.validateStreak(data);
    return data;
  },

  validateProfile(data) {
    if (!data || typeof data !== 'object') return null;
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const ageNum = parseInt(data.age, 10);
    const age = !isNaN(ageNum) && ageNum >= 10 && ageNum <= 65 ? ageNum : null;
    const cycleLength = parseInt(data.cycleLength, 10) || 28;
    const periodLength = parseInt(data.periodLength, 10) || 5;

    let lastPeriodStart = null;
    if (data.lastPeriodStart) {
      const parsedLast = parseLocalDate(data.lastPeriodStart);
      if (parsedLast && !isNaN(parsedLast.getTime())) {
        lastPeriodStart = getLocalDateString(parsedLast);
      } else {
        console.warn("Invalid profile.lastPeriodStart excluded:", data.lastPeriodStart);
      }
    }

    return {
      name,
      age,
      lastPeriodStart,
      cycleLength: Math.min(Math.max(cycleLength, 20), 45),
      periodLength: Math.min(Math.max(periodLength, 2), 12),
      isCycleUnknown: Boolean(data.isCycleUnknown),
      isPeriodUnknown: Boolean(data.isPeriodUnknown),
      setupDone: Boolean(data.setupDone)
    };
  },

  validatePeriods(periods) {
    if (!Array.isArray(periods)) {
      console.warn("Invalid periods input, expected array");
      return [];
    }
    return periods
      .filter(p => {
        if (!p || typeof p !== 'object') {
          console.warn("Invalid period entry (not an object), excluding:", p);
          return false;
        }
        const s = p.startDate || p.start;
        const parsedStart = parseLocalDate(s);
        if (!parsedStart || isNaN(parsedStart.getTime())) {
          console.warn("Period record has invalid start date, excluding:", s);
          return false;
        }
        return true;
      })
      .map(p => {
        const s = p.startDate || p.start;
        const e = p.endDate || p.end;
        const validStart = getLocalDateString(parseLocalDate(s));
        
        let validEnd = null;
        if (e !== undefined && e !== null && e !== '') {
          const parsedEnd = parseLocalDate(e);
          if (parsedEnd && !isNaN(parsedEnd.getTime())) {
            const endStr = getLocalDateString(parsedEnd);
            if (endStr >= validStart) {
              validEnd = endStr;
            } else {
              console.warn("Period end date precedes start date, marking incomplete:", e);
            }
          } else {
            console.warn("Invalid period end date, marking incomplete:", e);
          }
        }

        const flow = typeof p.flow === 'string' && p.flow.trim() ? p.flow.trim() : 'মাঝারি';
        return {
          startDate: validStart,
          endDate: validEnd,
          flow,
          start: validStart,
          end: validEnd
        };
      })
      .sort((a, b) => parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime());
  },

  validateDailyLog(log, dateStr) {
    if (!log || typeof log !== 'object') log = {};

    // 1. Date validation
    const parsedDate = parseLocalDate(dateStr || log.date);
    const validDateStr = parsedDate ? getLocalDateString(parsedDate) : null;

    // 2. Flow validation
    let flow = null;
    if (typeof log.flow === 'string' && log.flow.trim()) {
      flow = log.flow.trim();
    }

    // 3. Mood validation (valid string, normalized, or null if missing/invalid)
    let mood = null;
    if (typeof log.mood === 'string' && log.mood.trim()) {
      mood = log.mood.trim();
      if (mood === '😡 রাগী') mood = '😠 বিরক্ত';
      if (mood === '😭 সংবেদনশীল') mood = '😢 কষ্টে';
    } else if (log.mood !== undefined && log.mood !== null && log.mood !== '') {
      console.warn("Invalid mood value, reset to null:", log.mood);
    }

    // 4. Energy validation:
    // valid -> 1–10 (number)
    // missing -> null
    // invalid -> null + safe warning
    let energy = null;
    if (log.energy !== undefined && log.energy !== null && log.energy !== '') {
      const parsedEnergy = Number(log.energy);
      if (!isNaN(parsedEnergy)) {
        const intEnergy = Math.round(parsedEnergy);
        if (intEnergy >= 1 && intEnergy <= 10) {
          energy = intEnergy;
        } else if (intEnergy > 10 && intEnergy <= 100) {
          // Normalize legacy 10-100 scale to 1-10
          energy = Math.min(10, Math.max(1, Math.round(intEnergy / 10)));
        } else {
          console.warn("Invalid energy value out of bounds (1-10), reset to null:", log.energy);
          energy = null;
        }
      } else {
        console.warn("Invalid non-numeric energy value, reset to null:", log.energy);
        energy = null;
      }
    }

    // 5. Sleep Hours validation:
    // valid -> numeric (0 <= hours <= 24)
    // missing -> null
    // invalid -> null + safe warning
    let sleepHours = null;
    if (log.sleepHours !== undefined && log.sleepHours !== null && log.sleepHours !== '') {
      const parsedHours = parseFloat(log.sleepHours);
      if (!isNaN(parsedHours)) {
        if (parsedHours >= 0 && parsedHours <= 24) {
          sleepHours = Math.round(parsedHours * 10) / 10;
        } else {
          console.warn("Invalid sleep hours out of bounds (0-24), reset to null:", log.sleepHours);
          sleepHours = null;
        }
      } else {
        console.warn("Invalid non-numeric sleep hours, reset to null:", log.sleepHours);
        sleepHours = null;
      }
    }

    // 6. Sleep Quality validation (string or null)
    let sleepQuality = null;
    const rawSleepQuality = log.sleepQuality || log.sleep;
    if (typeof rawSleepQuality === 'string' && rawSleepQuality.trim()) {
      sleepQuality = rawSleepQuality.trim();
    }

    // 7. Symptoms validation (Array of strings, or [])
    let symptoms = [];
    if (Array.isArray(log.symptoms)) {
      symptoms = log.symptoms.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim());
    }

    // 8. Notes validation (string, default '')
    let notes = '';
    if (typeof log.notes === 'string') {
      notes = log.notes;
    }

    // 9. Period Flags
    const periodStarted = typeof log.periodStarted === 'boolean' 
      ? log.periodStarted 
      : (flow ? true : null);
    const periodEnded = typeof log.periodEnded === 'boolean' 
      ? log.periodEnded 
      : null;

    return {
      date: validDateStr,
      periodStarted,
      periodEnded,
      flow,
      symptoms,
      mood,
      energy,
      sleepHours,
      sleepQuality,
      sleep: sleepQuality,
      notes
    };
  },

  validateLogs(logs) {
    if (!logs || typeof logs !== 'object') {
      console.warn("Invalid logs container, resetting to empty map");
      return {};
    }
    const valid = {};
    Object.keys(logs).forEach(dateKey => {
      if (!dateKey) return;
      const parsed = parseLocalDate(dateKey);
      if (!parsed || isNaN(parsed.getTime())) {
        console.warn("Log record has invalid date key, excluding corrupted entry:", dateKey);
        return;
      }
      const canonicalDate = getLocalDateString(parsed);
      const validatedLog = this.validateDailyLog(logs[dateKey], canonicalDate);
      if (validatedLog && validatedLog.date) {
        valid[canonicalDate] = validatedLog;
      }
    });
    return valid;
  },

  validateSettings(settings) {
    if (!settings || typeof settings !== 'object') settings = {};
    let displayMode = settings.displayMode;
    if (!['light', 'dark', 'amoled'].includes(displayMode)) {
      displayMode = (settings.theme === 'dark' || settings.theme === 'night-bloom') ? 'dark' : 'light';
    }
    let colorTheme = settings.colorTheme || settings.theme || 'rose-bloom';
    if (!['rose-bloom', 'lavender-dream', 'peach-glow', 'night-bloom'].includes(colorTheme)) {
      colorTheme = 'rose-bloom';
    }
    const accessibilityPreferences = {
      largeText: Boolean(settings.accessibility?.largeText || settings.accessibilityPreferences?.largeText),
      highContrast: Boolean(settings.accessibility?.highContrast || settings.accessibilityPreferences?.highContrast),
      reducedMotion: Boolean(settings.accessibility?.reducedMotion || settings.accessibilityPreferences?.reducedMotion)
    };
    return {
      displayMode,
      colorTheme,
      theme: colorTheme,
      accessibility: accessibilityPreferences,
      accessibilityPreferences,
      pinSettings: {
        enabled: Boolean(settings.pinEnabled || settings.pinSettings?.enabled),
        pin: settings.pin || settings.pinSettings?.pin || null
      },
      pinEnabled: Boolean(settings.pinEnabled || settings.pinSettings?.enabled),
      pin: settings.pin ? String(settings.pin) : (settings.pinSettings?.pin ? String(settings.pinSettings.pin) : null),
      notificationPreferences: {
        enabled: Boolean(settings.remindersEnabled || settings.notificationPreferences?.enabled),
        time: typeof settings.reminderTime === 'string' && settings.reminderTime ? settings.reminderTime : (settings.notificationPreferences?.time || '08:00'),
        period: typeof settings.notificationPreferences?.period === 'boolean' ? settings.notificationPreferences.period : true,
        ovulation: typeof settings.notificationPreferences?.ovulation === 'boolean' ? settings.notificationPreferences.ovulation : true,
        selfCare: typeof settings.notificationPreferences?.selfCare === 'boolean' ? settings.notificationPreferences.selfCare : true,
        water: typeof settings.notificationPreferences?.water === 'boolean' ? settings.notificationPreferences.water : true
      },
      remindersEnabled: Boolean(settings.remindersEnabled || settings.notificationPreferences?.enabled),
      reminderTime: typeof settings.reminderTime === 'string' && settings.reminderTime ? settings.reminderTime : (settings.notificationPreferences?.time || '08:00')
    };
  },

  validateStreak(streak) {
    if (!streak || typeof streak !== 'object') streak = {};
    const current = parseInt(streak.current, 10);
    const longest = parseInt(streak.longest, 10);
    return {
      current: !isNaN(current) && current >= 0 ? current : 0,
      longest: !isNaN(longest) && longest >= 0 ? longest : 0,
      lastDate: streak.lastDate && !isNaN(new Date(streak.lastDate).getTime()) ? getLocalDateString(new Date(streak.lastDate)) : null
    };
  },

  migrate() {
    try {
      const obsoleteKeysToClean = [];

      // 1. Detect & migrate legacy profile keys
      if (!localStorage.getItem('fz_profile')) {
        const legacyProfileKeys = ['fz_user_profile', 'profile', 'user_profile', 'userProfile'];
        for (const k of legacyProfileKeys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = this.safeParse(raw, null);
            if (parsed) {
              const validated = this.validate('profile', parsed);
              if (validated) {
                this.safeSet('fz_profile', validated);
                obsoleteKeysToClean.push(k);
                break;
              }
            }
          }
        }
      }

      // 2. Detect & migrate legacy periods keys
      if (!localStorage.getItem('fz_periods')) {
        const legacyPeriodsKeys = ['periods', 'cycle_history', 'fz_cycle_history', 'fz_period_history'];
        for (const k of legacyPeriodsKeys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = this.safeParse(raw, null);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const validated = this.validate('periods', parsed);
              this.safeSet('fz_periods', validated);
              obsoleteKeysToClean.push(k);
              break;
            }
          }
        }
      }

      // 3. Detect & migrate legacy logs keys
      if (!localStorage.getItem('fz_logs')) {
        const legacyLogsKeys = ['logs', 'daily_logs', 'fz_daily_logs', 'fz_log_history'];
        for (const k of legacyLogsKeys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = this.safeParse(raw, null);
            if (parsed && typeof parsed === 'object') {
              const validated = this.validate('logs', parsed);
              this.safeSet('fz_logs', validated);
              obsoleteKeysToClean.push(k);
              break;
            }
          }
        }
      }

      // 4. Detect & migrate legacy settings keys
      if (!localStorage.getItem('fz_settings')) {
        const legacySettingsKeys = ['settings', 'app_settings', 'fz_app_settings'];
        for (const k of legacySettingsKeys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = this.safeParse(raw, null);
            if (parsed && typeof parsed === 'object') {
              const validated = this.validate('settings', parsed);
              this.safeSet('fz_settings', validated);
              obsoleteKeysToClean.push(k);
              break;
            }
          }
        }
      }

      // 5. Detect & migrate legacy streak keys
      if (!localStorage.getItem('fz_streak')) {
        const legacyStreakKeys = ['streak', 'fz_user_streak'];
        for (const k of legacyStreakKeys) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = this.safeParse(raw, null);
            if (parsed && typeof parsed === 'object') {
              const validated = this.validate('streak', parsed);
              this.safeSet('fz_streak', validated);
              obsoleteKeysToClean.push(k);
              break;
            }
          }
        }
      }

      // Remove obsolete duplicate keys only after successful canonical writing
      obsoleteKeysToClean.forEach(k => {
        try { localStorage.removeItem(k); } catch (e) {}
      });

      this.safeSet('fz_migration_done', true);
      this.safeSet('fz_schema_version', 1);
    } catch (e) {
      console.warn("Migration warning, preserving original state:", e);
      this.showToast('🌸 অ্যাপের ডেটা নিরাপদে সংরক্ষণ করা হয়েছে');
    }
  },

  loadData() {
    this.migrate();

    // 1. Profile
    try {
      const rawProfile = this.safeGet('fz_profile', null);
      if (rawProfile !== null && typeof rawProfile === 'object') {
        STATE.profile = this.validateProfile(rawProfile);
        if (STATE.profile && JSON.stringify(rawProfile) !== JSON.stringify(STATE.profile)) {
          this.saveData('fz_profile', STATE.profile);
        }
      } else {
        STATE.profile = null;
        if (rawProfile !== null) {
          this.saveData('fz_profile', null);
        }
      }
    } catch (e) {
      this.recover('profile', e);
      STATE.profile = null;
      this.saveData('fz_profile', null);
    }

    // 2. Periods
    try {
      const rawPeriods = this.safeGet('fz_periods', null);
      if (rawPeriods === null) {
        STATE.periods = [];
      } else if (Array.isArray(rawPeriods)) {
        STATE.periods = this.validatePeriods(rawPeriods);
        if (JSON.stringify(rawPeriods) !== JSON.stringify(STATE.periods)) {
          this.saveData('fz_periods', STATE.periods);
        }
      } else {
        this.recover('periods', new Error("Corrupted periods container (not array)"));
        STATE.periods = [];
        this.saveData('fz_periods', []);
      }
    } catch (e) {
      this.recover('periods', e);
      STATE.periods = [];
      this.saveData('fz_periods', []);
    }

    // 3. Logs
    try {
      const rawLogs = this.safeGet('fz_logs', null);
      if (rawLogs === null) {
        STATE.logs = {};
      } else if (rawLogs && typeof rawLogs === 'object' && !Array.isArray(rawLogs)) {
        STATE.logs = this.validateLogs(rawLogs);
        if (JSON.stringify(rawLogs) !== JSON.stringify(STATE.logs)) {
          this.saveData('fz_logs', STATE.logs);
        }
      } else {
        this.recover('logs', new Error("Corrupted logs container (not object)"));
        STATE.logs = {};
        this.saveData('fz_logs', {});
      }
    } catch (e) {
      this.recover('logs', e);
      STATE.logs = {};
      this.saveData('fz_logs', {});
    }

    // 4. Settings
    try {
      const rawSettings = this.safeGet('fz_settings', null);
      if (rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)) {
        STATE.settings = this.validateSettings(rawSettings);
        if (JSON.stringify(rawSettings) !== JSON.stringify(STATE.settings)) {
          this.saveData('fz_settings', STATE.settings);
        }
      } else {
        STATE.settings = this.validateSettings({});
        if (rawSettings !== null) {
          this.saveData('fz_settings', STATE.settings);
        }
      }
    } catch (e) {
      this.recover('settings', e);
      STATE.settings = this.validateSettings({});
      this.saveData('fz_settings', STATE.settings);
    }

    // 5. Streak
    try {
      const rawStreak = this.safeGet('fz_streak', null);
      if (rawStreak && typeof rawStreak === 'object' && !Array.isArray(rawStreak)) {
        STATE.streak = this.validateStreak(rawStreak);
        if (JSON.stringify(rawStreak) !== JSON.stringify(STATE.streak)) {
          this.saveData('fz_streak', STATE.streak);
        }
      } else {
        STATE.streak = { current: 0, longest: 0, lastDate: null };
        if (rawStreak !== null) {
          this.saveData('fz_streak', STATE.streak);
        }
      }
    } catch (e) {
      this.recover('streak', e);
      STATE.streak = { current: 0, longest: 0, lastDate: null };
      this.saveData('fz_streak', STATE.streak);
    }

    STATE.bookmarks = this.safeGet('fz_bookmarks', {});
    STATE.backupMeta = this.safeGet('fz_backup_meta', {});
  },

  exportData() {
    try {
      const exportPayload = {
        app: "Fuljhori Period Tracker",
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        profile: STATE.profile,
        periods: STATE.periods,
        logs: STATE.logs,
        settings: STATE.settings,
        streak: STATE.streak,
        bookmarks: STATE.bookmarks
      };
      const dateStr = getLocalDateString(new Date());
      const fileName = `fuljhori-backup-${dateStr}.json`;
      const jsonContent = JSON.stringify(exportPayload, null, 2);

      let downloadUrl;
      let isBlob = false;
      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
        downloadUrl = URL.createObjectURL(blob);
        isBlob = true;
      } else {
        downloadUrl = "data:text/json;charset=utf-8," + encodeURIComponent(jsonContent);
      }

      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", downloadUrl);
      downloadAnchor.setAttribute("download", fileName);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      if (isBlob) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);
      }
      this.showToast('✅ ব্যাকআপ ফাইল সংরক্ষিত হয়েছে');
    } catch (e) {
      console.error('Export error:', e);
      this.showToast('⚠️ ব্যাকআপ তৈরিতে ত্রুটি হয়েছে');
    }
  },

  importData(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON format');
        if (!parsed.profile && !parsed.periods && !parsed.logs) {
          throw new Error('Not a valid Fuljhori backup');
        }
        this.pendingImportPayload = parsed;
        this.confirmAction('restore_backup');
      } catch (err) {
        console.error('Import error:', err);
        this.showToast('⚠️ ফাইলটি সঠিক ব্যাকআপ ফাইল নয়');
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsText(file);
  },

  confirmAction(actionType) {
    this.pendingAction = actionType;
    const modal = document.getElementById('confirm-modal');
    const title = document.getElementById('confirm-title');
    const msg = document.getElementById('confirm-msg');
    const btn = document.getElementById('confirm-action-btn');

    if (actionType === 'reset_data') {
      title.innerText = 'সব ডেটা মুছে ফেলবেন?';
      msg.innerText = 'এর ফলে আপনার সকল রেকর্ড চিরতরে মুছে যাবে।';
      btn.style.background = '#D32F2F';
      btn.innerText = 'মুছে ফেলুন';
    } else if (actionType === 'reset_settings') {
      title.innerText = 'সেটিংস রিসেট করবেন?';
      msg.innerText = 'অ্যাপের থিম এবং অন্যান্য সেটিংস ডিফল্ট হয়ে যাবে।';
      btn.style.background = 'var(--primary)';
      btn.innerText = 'রিসেট করুন';
    } else if (actionType === 'remove_pin_init') {
      title.innerText = 'পিন লক বন্ধ করবেন?';
      msg.innerText = 'এর ফলে অ্যাপের নিরাপত্তার পিন মুছে যাবে।';
      btn.style.background = 'var(--primary)';
      btn.innerText = 'নিশ্চিত করুন';
    } else if (actionType === 'restore_backup') {
      title.innerText = 'ব্যাকআপ রিস্টোর করবেন?';
      msg.innerText = 'বর্তমান ডেটার স্থানে ব্যাকআপের ডেটা প্রতিস্থাপন করা হবে।';
      btn.style.background = 'var(--primary)';
      btn.innerText = 'রিস্টোর করুন';
    }

    modal.classList.remove('hidden');
    btn.onclick = () => {
      this.executePendingAction();
      this.closeConfirm();
    };
  },

  closeConfirm() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.add('hidden');
    this.pendingAction = null;
  },

  confirmDiscardUnsaved(onConfirm) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) {
      if (onConfirm) onConfirm();
      return;
    }
    const icon = document.getElementById('confirm-icon');
    const title = document.getElementById('confirm-title');
    const msg = document.getElementById('confirm-msg');
    const actionBtn = document.getElementById('confirm-action-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');

    if (icon) icon.innerText = '⚠️';
    if (title) title.innerText = 'অসংরক্ষিত তথ্য রয়েছে';
    if (msg) msg.innerText = 'আপনার পরিবর্তনগুলো সংরক্ষণ করা হয়নি। আপনি কি পরিবর্তনগুলো বাদ দিতে চান?';
    if (actionBtn) {
      actionBtn.style.background = 'var(--primary)';
      actionBtn.innerText = 'হ্যাঁ, বাদ দিন';
      actionBtn.onclick = () => {
        this.closeConfirm();
        if (onConfirm) onConfirm();
      };
    }
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        this.closeConfirm();
      };
    }
    modal.classList.remove('hidden');
  },

  executePendingAction() {
    if (this.pendingAction === 'reset_data') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('fz_') || ['profile', 'periods', 'logs', 'settings', 'streak', 'daily_logs', 'cycle_history', 'user_profile', 'userProfile', 'app_settings'].includes(k))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => {
        try { localStorage.removeItem(k); } catch (e) {}
      });
      try {
        sessionStorage.removeItem('fz_unlocked');
      } catch (e) {}

      STATE.profile = null;
      STATE.periods = [];
      STATE.logs = {};
      STATE.settings = this.validateSettings({});
      STATE.streak = { current: 0, longest: 0, lastDate: null };
      STATE.bookmarks = {};
      STATE.backupMeta = {};
      this.predictions = null;

      location.reload();
    } else if (this.pendingAction === 'reset_settings') {
      STATE.settings = this.validateSettings({});
      this.saveData('fz_settings', STATE.settings);
      this.applyAppearance();
      this.renderSettings();
      this.showToast('✅ সেটিংস ডিফল্ট করা হয়েছে');
    } else if (this.pendingAction === 'remove_pin_init') {
      this.showLockScreen('remove_verify');
    } else if (this.pendingAction === 'restore_backup' && this.pendingImportPayload) {
      const payload = this.pendingImportPayload;
      if (payload.profile) {
        STATE.profile = this.validate('profile', payload.profile);
        this.saveData('fz_profile', STATE.profile);
      }
      if (Array.isArray(payload.periods)) {
        STATE.periods = this.validate('periods', payload.periods);
        this.saveData('fz_periods', STATE.periods);
      }
      if (payload.logs && typeof payload.logs === 'object') {
        STATE.logs = this.validate('logs', payload.logs);
        this.saveData('fz_logs', STATE.logs);
      }
      if (payload.settings && typeof payload.settings === 'object') {
        STATE.settings = this.validate('settings', payload.settings);
        this.saveData('fz_settings', STATE.settings);
      }
      if (payload.streak) {
        STATE.streak = this.validate('streak', payload.streak);
        this.saveData('fz_streak', STATE.streak);
      }
      if (payload.bookmarks && typeof payload.bookmarks === 'object') {
        STATE.bookmarks = payload.bookmarks;
        this.saveData('fz_bookmarks', STATE.bookmarks);
      }
      this.saveData('fz_backup_meta', { lastRestoredAt: new Date().toISOString() });
      this.calculatePredictions();
      this.applyAppearance();
      this.renderSettings();
      this.showToast('✅ ব্যাকআপ সফলভাবে রিস্টোর হয়েছে');
      setTimeout(() => location.reload(), 600);
    }
  },

  // ==========================================
  // 2. UNIFIED APPEARANCE & THEME SYSTEM
  // ==========================================
  getThemeColor(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  },

  setDisplayMode(mode) {
    if (!STATE.settings) STATE.settings = {};
    STATE.settings.displayMode = mode;
    STATE.settings = this.validate('settings', STATE.settings);
    this.saveData('fz_settings', STATE.settings);
    this.applyAppearance();
    this.renderSettings();
  },

  setColorTheme(theme) {
    if (!STATE.settings) STATE.settings = {};
    STATE.settings.colorTheme = theme;
    STATE.settings.theme = theme;
    STATE.settings = this.validate('settings', STATE.settings);
    this.saveData('fz_settings', STATE.settings);
    this.applyAppearance();
    this.renderSettings();
  },

  setTheme(theme) {
    this.setColorTheme(theme);
  },

  applyAppearance() {
    if (!STATE.settings) STATE.settings = {};
    let mode = STATE.settings.displayMode || 'light';
    let theme = STATE.settings.colorTheme || STATE.settings.theme || 'rose-bloom';
    if (theme === 'light') { mode = 'light'; theme = 'rose-bloom'; }
    if (theme === 'dark') { mode = 'dark'; theme = 'night-bloom'; }

    STATE.settings.displayMode = mode;
    STATE.settings.colorTheme = theme;

    document.documentElement.setAttribute('data-display-mode', mode);
    document.documentElement.setAttribute('data-color-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);

    this.createPetals();

    const themeColors = {
      'rose-bloom': '#E75480',
      'lavender-dream': '#9B6B9E',
      'peach-glow': '#F08A5D',
      'night-bloom': '#FF7FA5'
    };

    let metaContent = themeColors[theme] || '#E75480';
    if (mode === 'amoled') metaContent = '#000000';
    else if (mode === 'dark') metaContent = '#141418';

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', metaContent);

    const analyticsView = document.getElementById('view-analytics');
    if (analyticsView && analyticsView.classList.contains('active')) {
      this.renderAnalytics();
    }
    this.applyAccessibility();
  },

  applyAccessibility() {
    const prefs = STATE.settings?.accessibilityPreferences || STATE.settings?.accessibility || {};
    const largeText = Boolean(prefs.largeText);
    const highContrast = Boolean(prefs.highContrast);
    const reducedMotion = Boolean(prefs.reducedMotion);

    document.documentElement.setAttribute('data-large-text', largeText ? 'true' : 'false');
    document.documentElement.setAttribute('data-high-contrast', highContrast ? 'true' : 'false');
    document.documentElement.setAttribute('data-reduced-motion', reducedMotion ? 'true' : 'false');

    if (largeText) {
      document.documentElement.classList.add('accessibility-large-text');
    } else {
      document.documentElement.classList.remove('accessibility-large-text');
    }

    if (highContrast) {
      document.documentElement.classList.add('accessibility-high-contrast');
    } else {
      document.documentElement.classList.remove('accessibility-high-contrast');
    }

    if (reducedMotion) {
      document.documentElement.classList.add('accessibility-reduced-motion');
    } else {
      document.documentElement.classList.remove('accessibility-reduced-motion');
    }
  },

  toggleAccessibilityPreference(prefKey) {
    if (!STATE.settings) STATE.settings = {};
    if (!STATE.settings.accessibilityPreferences) {
      STATE.settings.accessibilityPreferences = {
        largeText: false,
        highContrast: false,
        reducedMotion: false
      };
    }
    STATE.settings.accessibilityPreferences[prefKey] = !STATE.settings.accessibilityPreferences[prefKey];
    STATE.settings.accessibility = { ...STATE.settings.accessibilityPreferences };
    STATE.settings = this.validate('settings', STATE.settings);
    this.saveData('fz_settings', STATE.settings);
    this.applyAccessibility();
    this.renderSettings();
  },

  applyTheme() {
    this.applyAppearance();
  },

  createPetals() {
    const container = document.getElementById('petals-container');
    if (!container) return;
    const isDark = (STATE.settings?.displayMode === 'dark' || STATE.settings?.displayMode === 'amoled');
    const colors = isDark
      ? ['rgba(255, 127, 165, 0.05)', 'rgba(216, 27, 96, 0.05)', 'rgba(244, 143, 177, 0.05)']
      : ['rgba(255, 182, 193, 0.3)', 'rgba(255, 192, 203, 0.3)', 'rgba(255, 105, 180, 0.2)'];

    container.innerHTML = '';
    const numPetals = 6;
    for (let i = 0; i < numPetals; i++) {
      const petal = document.createElement('div');
      petal.className = 'petal';
      const size = Math.random() * 12 + 8;
      petal.style.width = `${size}px`;
      petal.style.height = `${size * 1.2}px`;
      petal.style.left = `${Math.random() * 100}vw`;
      petal.style.background = colors[Math.floor(Math.random() * colors.length)];
      petal.style.borderRadius = '50% 0 50% 0';
      petal.style.animationDuration = `${Math.random() * 15 + 20}s`;
      petal.style.animationDelay = `${Math.random() * 10}s`;
      container.appendChild(petal);
    }
  },

  initRipples() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn, .nav-item, .cal-day-cell, .chip, .toggle');
      if (btn && !btn.classList.contains('empty') && !btn.classList.contains('ripple') && !btn.classList.contains('slider')) {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        const currentPos = window.getComputedStyle(btn).position;
        if (currentPos === 'static') btn.style.position = 'relative';
        const oldOverflow = window.getComputedStyle(btn).overflow;
        btn.style.overflow = 'hidden';
        btn.appendChild(ripple);
        setTimeout(() => {
          ripple.remove();
          btn.style.overflow = oldOverflow;
        }, 600);
      }
    });
  },

  safeVibrate(pattern) {
    try {
      if ('vibrate' in navigator) navigator.vibrate(pattern);
    } catch (e) {}
  },

  showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.add('show');
    if (this._toastTimeout) clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => toast.classList.remove('show'), 2500);
  },

  // ==========================================
  // 3. CANONICAL PREDICTION ENGINE
  // ==========================================
  calculateCycleHistory(periods) {
    if (!periods || !Array.isArray(periods) || periods.length < 2) {
      return { cycleLengths: [], allCycleLengths: [] };
    }

    const sorted = [...periods]
      .filter(p => p && (p.startDate || p.start))
      .map(p => ({
        startDate: getLocalDateString(parseLocalDate(p.startDate || p.start)),
        endDate: getLocalDateString(parseLocalDate(p.endDate || p.end || p.startDate || p.start)),
        flow: p.flow || 'মাঝারি'
      }))
      .filter(p => p.startDate)
      .sort((a, b) => parseLocalDate(a.startDate) - parseLocalDate(b.startDate));

    // Deduplicate same-date records
    const deduplicated = [];
    sorted.forEach(p => {
      if (deduplicated.length === 0) {
        deduplicated.push(p);
      } else {
        const last = deduplicated[deduplicated.length - 1];
        if (last.startDate !== p.startDate) {
          deduplicated.push(p);
        }
      }
    });

    if (deduplicated.length < 2) {
      return { cycleLengths: [], allCycleLengths: [] };
    }

    const allCycleLengths = [];
    for (let i = 1; i < deduplicated.length; i++) {
      const prevStart = parseLocalDate(deduplicated[i - 1].startDate);
      const currStart = parseLocalDate(deduplicated[i].startDate);
      const cLen = diffInDays(currStart, prevStart);

      // Only count valid cycle intervals (filter out long gaps where user paused tracking)
      if (cLen >= 15 && cLen <= 110) {
        allCycleLengths.push(cLen);
      }
    }

    // Up to latest 6 completed cycles
    const recentCycleLengths = allCycleLengths.slice(-6);

    return {
      cycleLengths: recentCycleLengths,
      allCycleLengths
    };
  },

  calculatePredictedCycleLength(cycleLengths, fallbackLength) {
    const defaultLen = Math.min(Math.max(parseInt(fallbackLength, 10) || 28, 20), 45);

    if (!cycleLengths || !Array.isArray(cycleLengths) || cycleLengths.length === 0) {
      return defaultLen;
    }

    // Outlier safety: find median
    const sorted = [...cycleLengths].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

    // Dampen extreme outliers without modifying original historical data
    const clampedCycles = cycleLengths.map(c => {
      if (c < 18) return Math.max(18, median - 8);
      if (c > 65) return Math.min(65, median + 8);
      const deviation = c - median;
      if (Math.abs(deviation) > 10) {
        return median + (Math.sign(deviation) * 8);
      }
      return c;
    });

    // CASE 1: 2 or more cycles -> Weighted average (more weight to recent cycles: 1, 2, ..., n)
    if (clampedCycles.length >= 2) {
      let weightedSum = 0;
      let totalWeight = 0;
      for (let i = 0; i < clampedCycles.length; i++) {
        const weight = i + 1;
        weightedSum += clampedCycles[i] * weight;
        totalWeight += weight;
      }
      const weightedAvg = Math.round(weightedSum / totalWeight);
      return Math.min(Math.max(weightedAvg, 20), 45);
    }

    // CASE 2: Exactly 1 completed cycle -> Robust blend of 1 cycle (60%) with profile fallback (40%)
    if (clampedCycles.length === 1) {
      const blended = Math.round(clampedCycles[0] * 0.6 + defaultLen * 0.4);
      return Math.min(Math.max(blended, 20), 45);
    }

    return defaultLen;
  },

  calculateCycleVariability(cycleLengths) {
    if (!cycleLengths || cycleLengths.length < 2) {
      return {
        status: "not_enough_data",
        diff: 0,
        min: cycleLengths && cycleLengths.length === 1 ? cycleLengths[0] : 0,
        max: cycleLengths && cycleLengths.length === 1 ? cycleLengths[0] : 0,
        avg: cycleLengths && cycleLengths.length === 1 ? cycleLengths[0] : 0,
        count: cycleLengths ? cycleLengths.length : 0,
        range: 0,
        irregularityStatus: "আরও তথ্য লাগবে",
        message: "💖 আরও অন্তত দুটি সাইকেল তথ্য দিলে পূর্বাভাস ও বিশ্লেষণ আরও নির্ভুল হবে"
      };
    }

    const min = Math.min(...cycleLengths);
    const max = Math.max(...cycleLengths);
    const diff = max - min;
    const avg = Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length);

    let status = "regular";
    let irregularityStatus = "নিয়ম মোটামুটি একই রকম";
    let message = "🌿 তোমার সাইকেল বেশ নিয়মিত ও স্থিতিশীল";

    if (diff > 3 && diff <= 7) {
      status = "slightly_irregular";
      irregularityStatus = "কিছুটা ওঠানামা আছে";
      message = "📌 সাইকেল দৈর্ঘ্যে অল্প পরিবর্তন দেখা যাচ্ছে, যা স্বাভাবিক";
    } else if (diff > 7) {
      status = "irregular";
      irregularityStatus = "বেশ কিছু পরিবর্তন দেখা যাচ্ছে";
      message = "🌙 সাম্প্রতিক সাইকেলগুলোতে কিছুটা ওঠানামা দেখা যাচ্ছে, পরিমিত বিশ্রাম নাও";
    }

    return {
      status,
      diff,
      min,
      max,
      avg,
      count: cycleLengths.length,
      range: diff,
      irregularityStatus,
      message
    };
  },

  calculatePredictionConfidence(cycleLengths, variability) {
    const count = cycleLengths ? cycleLengths.length : 0;
    const status = variability ? variability.status : "not_enough_data";

    if (count <= 1) {
      return { score: count === 1 ? 50 : 45, level: "আরও তথ্য লাগবে" };
    }

    if (status === "regular") {
      if (count === 2) return { score: 75, level: "মোটামুটি নির্ভরযোগ্য" };
      if (count === 3) return { score: 85, level: "উচ্চ নির্ভরযোগ্যতা" };
      return { score: Math.min(90 + (count - 4) * 2, 96), level: "উচ্চ নির্ভরযোগ্যতা" };
    } else if (status === "slightly_irregular") {
      if (count === 2) return { score: 65, level: "মোটামুটি নির্ভরযোগ্য" };
      if (count === 3) return { score: 72, level: "মোটামুটি নির্ভরযোগ্য" };
      return { score: 78, level: "উচ্চ নির্ভরযোগ্যতা" };
    } else {
      if (count === 2) return { score: 50, level: "আরও তথ্য লাগবে" };
      if (count === 3) return { score: 56, level: "মোটামুটি নির্ভরযোগ্য" };
      return { score: 62, level: "মোটামুটি নির্ভরযোগ্য" };
    }
  },

  calculateCurrentCycleDay(latestPeriodStart, today) {
    const start = parseLocalDate(latestPeriodStart);
    const t = parseLocalDate(today || new Date());
    if (!start || isNaN(start.getTime()) || !t || isNaN(t.getTime())) {
      return null;
    }
    const diff = diffInDays(t, start);
    if (diff < 0) {
      return 1;
    }
    const rawDay = diff + 1;
    if (rawDay > 365) {
      return 365;
    }
    return rawDay;
  },

  calculateNextPeriod(latestPeriodStart, predictedCycleLength, periodLength, allPeriods, today) {
    const anchor = parseLocalDate(latestPeriodStart);
    if (!anchor) return { nextPeriodStart: null, nextPeriodEnd: null, isActualLogged: false };

    const pLen = Math.min(Math.max(parseInt(periodLength, 10) || 5, 2), 12);
    const cLen = Math.min(Math.max(parseInt(predictedCycleLength, 10) || 28, 20), 45);

    // If an actual period has already been logged strictly after anchor date, prefer the earliest one
    const futureLogged = (allPeriods || [])
      .map(p => ({
        start: parseLocalDate(p.startDate || p.start),
        end: parseLocalDate(p.endDate || p.end)
      }))
      .filter(p => p.start && diffInDays(p.start, anchor) > 0)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    if (futureLogged.length > 0) {
      const nextStart = futureLogged[0].start;
      const nextEnd = futureLogged[0].end || addDays(nextStart, pLen - 1);
      return {
        nextPeriodStart: nextStart,
        nextPeriodEnd: nextEnd,
        isActualLogged: true
      };
    }

    const predictedStart = addDays(anchor, cLen);
    const predictedEnd = addDays(predictedStart, pLen - 1);
    return {
      nextPeriodStart: predictedStart,
      nextPeriodEnd: predictedEnd,
      isActualLogged: false
    };
  },

  calculateOvulation(nextPeriodStart) {
    const start = parseLocalDate(nextPeriodStart);
    if (!start) return null;
    return addDays(start, -14);
  },

  calculateFertileWindow(ovulationDate) {
    const ovul = parseLocalDate(ovulationDate);
    if (!ovul) return { fertileStartDate: null, fertileEndDate: null };
    return {
      fertileStartDate: addDays(ovul, -2),
      fertileEndDate: addDays(ovul, +2)
    };
  },

  calculateCurrentPhase(params) {
    const {
      today,
      allPeriods,
      latestPeriodStart,
      periodLength,
      ovulationDate,
      fertileStartDate,
      fertileEndDate,
      nextPeriodStart,
      isOverdue,
      overdueDays
    } = params;

    const t = parseLocalDate(today);
    const pLen = Math.min(Math.max(parseInt(periodLength, 10) || 5, 2), 12);

    // Rule A: মাসিকের সময় (Current date is within user's logged period range)
    let isCurrentPeriodActive = false;
    for (const p of (allPeriods || [])) {
      const pStart = parseLocalDate(p.startDate || p.start);
      const pEnd = parseLocalDate(p.endDate || p.end) || (pStart ? addDays(pStart, pLen - 1) : null);
      if (pStart && pEnd && t >= pStart && t <= pEnd) {
        isCurrentPeriodActive = true;
        break;
      }
    }

    if (isCurrentPeriodActive) {
      return {
        phaseName: "মাসিকের সময়",
        phaseColor: "var(--primary)",
        phaseColorTitle: "var(--primary)",
        advice: "শরীরটা আজ একটু স্লো যেতে চাইতে পারে 🌙",
        isCurrentPeriodActive: true
      };
    }

    // Fallback: If today is within estimated period window from latestPeriodStart
    if (latestPeriodStart) {
      const anchorStart = parseLocalDate(latestPeriodStart);
      const anchorEnd = anchorStart ? addDays(anchorStart, pLen - 1) : null;
      if (anchorStart && anchorEnd && t >= anchorStart && t <= anchorEnd) {
        return {
          phaseName: "মাসিকের সময়",
          phaseColor: "var(--primary)",
          phaseColorTitle: "var(--primary)",
          advice: "শরীরটা আজ একটু স্লো যেতে চাইতে পারে 🌙",
          isCurrentPeriodActive: true
        };
      }
    }

    // Rule Overdue: If cycle is overdue and no bleeding logged
    if (isOverdue) {
      return {
        phaseName: "পিরিয়ড বিলম্বিত",
        phaseColor: "#FF9800",
        phaseColorTitle: "#F57C00",
        advice: overdueDays > 0
          ? `সম্ভাব্য তারিখ ${toBanglaNumber(overdueDays)} দিন পেরিয়ে গেছে। নতুন পিরিয়ড শুরু হলে লগ করো 🌸`
          : "সম্ভাব্য তারিখ পেরিয়ে গেছে। নতুন পিরিয়ড লগ করলে হিসাবটা আবার ঠিক হবে 🌸",
        isCurrentPeriodActive: false
      };
    }

    // Rule B: ডিম্বস্ফোটনের সময় (Current date is ovulation date ±1 day)
    if (ovulationDate) {
      const ovulMinus1 = addDays(ovulationDate, -1);
      const ovulPlus1 = addDays(ovulationDate, 1);
      if (ovulMinus1 && ovulPlus1 && t >= ovulMinus1 && t <= ovulPlus1) {
        return {
          phaseName: "ডিম্বস্ফোটনের সময়",
          phaseColor: "var(--accent)",
          phaseColorTitle: "var(--accent)",
          advice: "আজ কাজকর্মে মন ভালো থাকতে পারে 🌟",
          isCurrentPeriodActive: false
        };
      }
    }

    // Rule C: ফলিকুলার পর্যায় (After menstrual period and before ovulation window)
    if (ovulationDate) {
      const ovulMinus1 = addDays(ovulationDate, -1);
      if (ovulMinus1 && t < ovulMinus1) {
        return {
          phaseName: "ফলিকুলার পর্যায়",
          phaseColor: "var(--secondary)",
          phaseColorTitle: "var(--accent)",
          advice: "আজকে এনার্জি একটু ভালো থাকতে পারে 🌱",
          isCurrentPeriodActive: false
        };
      }
    }

    // Rule D: লুটিয়াল পর্যায় (After ovulation window and before or at next predicted period)
    const isDueToday = nextPeriodStart && diffInDays(nextPeriodStart, t) === 0;
    return {
      phaseName: "লুটিয়াল পর্যায়",
      phaseColor: "#FFB300",
      phaseColorTitle: "#D89A00",
      advice: isDueToday
        ? "আজ তোমার পিরিয়ড শুরু হতে পারে। নিজের যত্ন নিও 🌸"
        : "আজ একটু রেস্ট নিলে ভালো লাগতে পারে 💕",
      isCurrentPeriodActive: false
    };
  },

  getPredictionState() {
    const today = parseLocalDate(new Date());
    const todayStr = getLocalDateString(today);
    const profile = STATE.profile || {};
    const fallbackCycleLength = parseInt(profile.cycleLength, 10) || 28;
    const periodLength = parseInt(profile.periodLength, 10) || 5;

    // Check available periods
    const periods = Array.isArray(STATE.periods) ? STATE.periods : [];
    const validPeriods = periods
      .filter(p => p && (p.startDate || p.start))
      .map(p => {
        const s = p.startDate || p.start;
        const e = p.endDate || p.end || s;
        const parsedStart = parseLocalDate(s);
        const parsedEnd = parseLocalDate(e) || parsedStart;
        return {
          startDate: parsedStart ? getLocalDateString(parsedStart) : null,
          endDate: parsedEnd ? getLocalDateString(parsedEnd) : null,
          flow: p.flow || 'মাঝারি'
        };
      })
      .filter(p => p.startDate)
      .sort((a, b) => parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime());

    // Also merge profile.lastPeriodStart if not already in validPeriods
    if (profile.lastPeriodStart) {
      const pStart = getLocalDateString(parseLocalDate(profile.lastPeriodStart));
      if (pStart && !validPeriods.some(p => p.startDate === pStart)) {
        validPeriods.push({
          startDate: pStart,
          endDate: getLocalDateString(addDays(parseLocalDate(pStart), periodLength - 1)),
          flow: 'মাঝারি'
        });
        validPeriods.sort((a, b) => parseLocalDate(a.startDate).getTime() - parseLocalDate(b.startDate).getTime());
      }
    }

    // Determine latest actual anchor: prefer latest period that has already started (<= today)
    const startedPeriods = validPeriods.filter(p => parseLocalDate(p.startDate) <= today);
    let latestStartStr = null;
    if (startedPeriods.length > 0) {
      latestStartStr = startedPeriods[startedPeriods.length - 1].startDate;
    } else if (validPeriods.length > 0) {
      // If all periods are scheduled for the future, use the earliest one
      latestStartStr = validPeriods[0].startDate;
    }

    // If no usable anchor period at all -> Insufficient data state
    if (!latestStartStr) {
      this.predictions = {
        _calcDate: todayStr,
        predictionAvailable: false,
        predictionStatus: 'insufficient_data',
        isOverdue: false,
        overdueDays: 0,
        overdueDate: null,
        overdueDateStr: '',
        currentCycleDay: null,
        predictedCycleLength: fallbackCycleLength,
        cycleLength: fallbackCycleLength,
        periodLength: periodLength,
        nextPeriodDate: null,
        nextPeriodStart: null,
        nextPeriodDateStr: '',
        nextPeriodEnd: null,
        nextPeriodEndDateStr: '',
        isNextPeriodLogged: false,
        ovulationDate: null,
        ovulationDateStr: '',
        fertileStartDate: null,
        fertileStart: null,
        fertileStartDateStr: '',
        fertileEndDate: null,
        fertileEnd: null,
        fertileEndDateStr: '',
        currentPhase: 'তথ্য অপ্রতুল',
        phaseName: 'তথ্য অপ্রতুল',
        phaseColor: 'var(--text-muted)',
        phaseColorTitle: 'var(--text-muted)',
        advice: '🌸 আরও কিছু তথ্য যোগ করলে তোমার সাইকেল সম্পর্কে ভালোভাবে হিসাব করা যাবে।',
        isCurrentPeriodActive: false,
        confidenceLevel: 'আরও তথ্য লাগবে',
        confidenceScore: 0,
        confidence: 0,
        cycleCountUsed: 0,
        cycleLengths: [],
        cycleVariability: { status: 'not_enough_data', diff: 0, min: 0, max: 0, avg: 0, count: 0, range: 0, irregularityStatus: 'আরও তথ্য লাগবে', message: 'আরও তথ্য লাগবে' },
        variability: { status: 'not_enough_data', diff: 0, min: 0, max: 0, avg: 0, count: 0, range: 0, irregularityStatus: 'আরও তথ্য লাগবে', message: 'আরও তথ্য লাগবে' },
        irregularityStatus: 'আরও তথ্য লাগবে',
        variabilityMessage: '🌸 আরও কিছু তথ্য যোগ করলে তোমার সাইকেল সম্পর্কে ভালোভাবে হিসাব করা যাবে।'
      };
      return this.predictions;
    }

    const latestStart = parseLocalDate(latestStartStr);

    // 1. Calculate Cycle History
    const history = this.calculateCycleHistory(validPeriods);
    const cycleLengths = history.cycleLengths;

    // 2. Calculate Predicted Cycle Length (with outlier safety)
    const predictedCycleLength = this.calculatePredictedCycleLength(cycleLengths, fallbackCycleLength);

    // 3. Cycle Variability & Irregularity
    const cycleVariability = this.calculateCycleVariability(cycleLengths);

    // 4. Prediction Confidence
    const confidence = this.calculatePredictionConfidence(cycleLengths, cycleVariability);

    // 5. Next Period Calculation (Actual vs Predicted)
    const nextPeriodInfo = this.calculateNextPeriod(latestStart, predictedCycleLength, periodLength, validPeriods, today);
    const rawNextPeriodStart = nextPeriodInfo.nextPeriodStart;
    const rawNextPeriodEnd = nextPeriodInfo.nextPeriodEnd;
    const isNextPeriodLogged = Boolean(nextPeriodInfo.isActualLogged);

    // 6. Check Overdue Status
    const daysUntilNext = rawNextPeriodStart ? diffInDays(rawNextPeriodStart, today) : null;
    const isOverdue = !isNextPeriodLogged && daysUntilNext !== null && daysUntilNext < 0;
    const isDueToday = !isNextPeriodLogged && daysUntilNext !== null && daysUntilNext === 0;
    const overdueDays = isOverdue ? Math.abs(daysUntilNext) : 0;
    const predictionStatus = isOverdue ? 'overdue' : (isNextPeriodLogged ? 'logged' : (isDueToday ? 'due_today' : 'active'));
    const predictionAvailable = !isOverdue;

    // 7. Ovulation & Fertile Window
    const ovulationDate = isOverdue ? null : this.calculateOvulation(rawNextPeriodStart);
    const fertileWindow = isOverdue ? { fertileStartDate: null, fertileEndDate: null } : this.calculateFertileWindow(ovulationDate);
    const fertileStartDate = fertileWindow.fertileStartDate;
    const fertileEndDate = fertileWindow.fertileEndDate;

    // 8. Current Cycle Day
    const currentCycleDay = this.calculateCurrentCycleDay(latestStart, today);

    // 9. Phase Calculation
    const phaseInfo = this.calculateCurrentPhase({
      today,
      allPeriods: validPeriods,
      latestPeriodStart: latestStart,
      periodLength,
      ovulationDate,
      fertileStartDate,
      fertileEndDate,
      nextPeriodStart: rawNextPeriodStart,
      isOverdue,
      overdueDays
    });

    const nextPeriodStart = isOverdue ? null : rawNextPeriodStart;
    const nextPeriodEnd = isOverdue ? null : rawNextPeriodEnd;

    this.predictions = {
      _calcDate: todayStr,
      predictionAvailable,
      predictionStatus,
      isOverdue,
      overdueDays,
      overdueDate: isOverdue ? rawNextPeriodStart : null,
      overdueDateStr: (isOverdue && rawNextPeriodStart) ? getLocalDateString(rawNextPeriodStart) : '',
      currentCycleDay,
      predictedCycleLength,
      cycleLength: predictedCycleLength,
      periodLength,
      nextPeriodDate: nextPeriodStart,
      nextPeriodStart,
      nextPeriodDateStr: nextPeriodStart ? getLocalDateString(nextPeriodStart) : '',
      nextPeriodEnd,
      nextPeriodEndDateStr: nextPeriodEnd ? getLocalDateString(nextPeriodEnd) : '',
      isNextPeriodLogged,
      ovulationDate,
      ovulationDateStr: ovulationDate ? getLocalDateString(ovulationDate) : '',
      fertileStartDate,
      fertileStart: fertileStartDate,
      fertileStartDateStr: fertileStartDate ? getLocalDateString(fertileStartDate) : '',
      fertileEndDate,
      fertileEnd: fertileEndDate,
      fertileEndDateStr: fertileEndDate ? getLocalDateString(fertileEndDate) : '',
      currentPhase: phaseInfo.phaseName,
      phaseName: phaseInfo.phaseName,
      phaseColor: phaseInfo.phaseColor,
      phaseColorTitle: phaseInfo.phaseColorTitle,
      advice: phaseInfo.advice,
      isCurrentPeriodActive: phaseInfo.isCurrentPeriodActive,
      confidenceLevel: isOverdue ? 'আরও তথ্য লাগবে' : confidence.level,
      confidenceScore: isOverdue ? Math.min(confidence.score, 45) : confidence.score,
      confidence: isOverdue ? Math.min(confidence.score, 45) : confidence.score,
      cycleCountUsed: cycleLengths.length,
      cycleLengths,
      cycleVariability,
      variability: cycleVariability,
      irregularityStatus: cycleVariability.irregularityStatus,
      variabilityMessage: cycleVariability.message
    };

    return this.predictions;
  },

  calculatePredictions(force = false) {
    const todayStr = getLocalDateString(new Date());
    if (!force && this.predictions && this.predictions._calcDate === todayStr) {
      return this.predictions;
    }
    return this.getPredictionState();
  },

  checkDateRollover() {
    const currentDate = getLocalDateString(new Date());
    if (this._lastObservedDate && this._lastObservedDate !== currentDate) {
      this._lastObservedDate = currentDate;
      this.predictions = null;
      this.calculatePredictions(true);
      const dateEl = document.getElementById('home-date');
      if (dateEl) dateEl.innerText = formatBanglaDate(new Date());

      if (this.activeTab === 'home') {
        this.renderHome();
      } else if (this.activeTab === 'calendar') {
        this.renderCalendar();
      } else if (this.activeTab === 'analytics') {
        this.renderAnalytics();
      }
    }
  },

  // ==========================================
  // 4. BOOT & NAVIGATION
  // ==========================================
  init() {
    window.onerror = (message, source, lineno, colno, error) => {
      console.error('App safely caught error:', error);
      this.showToast('⚠️ অ্যাপ সচল রাখা হয়েছে।');
      return true;
    };

    window.addEventListener('unhandledrejection', (event) => {
      console.warn('Unhandled Promise rejection:', event.reason);
    });

    window.addEventListener('beforeunload', (e) => {
      if (this.isEditingNotes) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    this.loadData();
    this.applyAppearance();
    this._lastObservedDate = getLocalDateString(new Date());

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkDateRollover();
      }
    });
    window.addEventListener('focus', () => {
      this.checkDateRollover();
    });

    this.calContextDate = new Date();
    this.calContextDate.setDate(1);

    this.createPetals();
    this.initRipples();

    const splash = document.getElementById('splash-screen');
    if (splash) {
      setTimeout(() => {
        splash.classList.add('fade-out');
        if (STATE.settings?.pinEnabled && !sessionStorage.getItem('fz_unlocked')) {
          this.showLockScreen('verify');
          return;
        }
        this.bootMainApp();
        this.startReminderService();
        setTimeout(() => splash.remove(), 600);
      }, 1500);
    } else {
      if (STATE.settings?.pinEnabled && !sessionStorage.getItem('fz_unlocked')) {
        this.showLockScreen('verify');
        return;
      }
      this.bootMainApp();
      this.startReminderService();
    }
  },

  bootMainApp() {
    this.initBottomSheets();
    this.loadBookmarks();
    if (!STATE.profile || !STATE.profile.setupDone) {
      document.getElementById('view-onboarding').classList.remove('hidden');
      document.getElementById('main-app').classList.add('hidden');
      const dateInput = document.getElementById('ob-setup-last-period');
      if (dateInput) {
        dateInput.max = getLocalDateString(new Date());
      }
    } else {
      document.getElementById('view-onboarding').classList.add('hidden');
      document.getElementById('main-app').classList.remove('hidden');
      document.getElementById('screen-lock').classList.add('hidden');
      this.renderHome();
      this.renderSettings();
    }
  },

  switchTab(tabName) {
    if (this.isLogDirty && this.activeTab === 'log' && tabName !== 'log') {
      this.confirmDiscardUnsaved(() => {
        this.isLogDirty = false;
        this._doSwitchTab(tabName);
      });
      return;
    }
    if (this.activeTab === 'settings' && tabName !== 'settings') {
      this.flushSettingsIfDirty();
    }
    this._doSwitchTab(tabName);
  },

  _doSwitchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const activeView = document.getElementById(`view-${tabName}`);
    if (activeView) {
      activeView.classList.add('active');
      const scrollContent = activeView.querySelector('.scroll-content');
      if (scrollContent) scrollContent.scrollTop = 0;
    }

    if (tabName === 'home') this.renderHome();
    if (tabName === 'calendar') this.renderCalendar();
    if (tabName === 'log') this.setupLogView();
    if (tabName === 'analytics') this.renderAnalytics();
    if (tabName === 'settings') this.renderSettings();

    document.querySelectorAll('.nav-item').forEach(i => {
      i.classList.remove('active');
      if (i.getAttribute('onclick')?.includes(`'${tabName}'`)) {
        i.classList.add('active');
      }
    });
  },

  // ==========================================
  // 5. ONBOARDING (CANONICAL)
  // ==========================================
  _isSavingOnboarding: false,

  nextOnboardingSlide(slideNum) {
    const slider = document.getElementById('onboarding-slider');
    if (!slider) return;
    slider.style.transform = `translateX(-${(slideNum - 1) * 33.333}%)`;
    document.querySelectorAll('.ob-pagination-group').forEach(group => {
      group.querySelectorAll('.ob-dot').forEach((dot, idx) => {
        dot.classList.toggle('active', idx === (slideNum - 1));
      });
    });

    if (slideNum === 2) {
      const dateInput = document.getElementById('ob-setup-last-period');
      if (dateInput && !dateInput.max) {
        dateInput.max = getLocalDateString(new Date());
      }
    }

    if (slideNum === 3) {
      setTimeout(() => {
        const icon = document.getElementById('ob-success-icon');
        if (icon) {
          icon.style.opacity = '1';
          icon.style.transform = 'scale(1)';
        }
      }, 300);
      this.safeVibrate(50);
    }
  },

  toggleCycleUnknown(isUnknown) {
    const slider = document.getElementById('ob-setup-cycle');
    const pill = document.getElementById('ob-cycle-val');
    if (slider) {
      slider.disabled = Boolean(isUnknown);
      slider.style.opacity = isUnknown ? '0.45' : '1';
      slider.style.pointerEvents = isUnknown ? 'none' : 'auto';
    }
    if (pill) {
      if (isUnknown) {
        pill.innerText = 'জানি না (ডিফল্ট ২৮ দিন)';
      } else {
        const val = slider ? slider.value : 28;
        pill.innerText = toBanglaNumber(val) + ' দিন';
      }
    }
  },

  togglePeriodUnknown(isUnknown) {
    const slider = document.getElementById('ob-setup-period');
    const pill = document.getElementById('ob-period-val');
    if (slider) {
      slider.disabled = Boolean(isUnknown);
      slider.style.opacity = isUnknown ? '0.45' : '1';
      slider.style.pointerEvents = isUnknown ? 'none' : 'auto';
    }
    if (pill) {
      if (isUnknown) {
        pill.innerText = 'জানি না (ডিফল্ট ৫ দিন)';
      } else {
        const val = slider ? slider.value : 5;
        pill.innerText = toBanglaNumber(val) + ' দিন';
      }
    }
  },

  onCycleSliderChange(val) {
    const isUnknown = document.getElementById('ob-cycle-unknown')?.checked;
    if (isUnknown) return;
    const pill = document.getElementById('ob-cycle-val');
    if (pill) {
      pill.innerText = toBanglaNumber(val) + ' দিন';
    }
  },

  onPeriodSliderChange(val) {
    const isUnknown = document.getElementById('ob-period-unknown')?.checked;
    if (isUnknown) return;
    const pill = document.getElementById('ob-period-val');
    if (pill) {
      pill.innerText = toBanglaNumber(val) + ' দিন';
    }
  },

  validateAndNextSlide(slideNum) {
    if (slideNum === 3) {
      const name = document.getElementById('ob-setup-name')?.value;
      const ageStr = document.getElementById('ob-setup-age')?.value;
      const lastP = document.getElementById('ob-setup-last-period')?.value;
      let valid = true;

      // Name is optional. Max length check (30)
      const nameErr = document.getElementById('ob-name-err');
      if (name && name.trim().length > 30) {
        if (nameErr) {
          nameErr.innerText = 'নাম ৩০ অক্ষরের মধ্যে লিখো';
          nameErr.style.display = 'block';
        }
        valid = false;
      } else if (nameErr) {
        nameErr.style.display = 'none';
      }

      // Age is optional. If provided, validate reasonable whole number 10-65
      const ageErr = document.getElementById('ob-age-err');
      if (ageStr && ageStr.trim() !== '') {
        const ageNum = parseInt(ageStr, 10);
        if (isNaN(ageNum) || ageNum < 10 || ageNum > 65) {
          if (ageErr) {
            ageErr.innerText = 'বয়সটা ঠিকভাবে লিখো।';
            ageErr.style.display = 'block';
          }
          valid = false;
        } else if (ageErr) {
          ageErr.style.display = 'none';
        }
      } else if (ageErr) {
        ageErr.style.display = 'none';
      }

      // Last period date is required. Must not be future date.
      const dateErr = document.getElementById('ob-date-err');
      if (!lastP) {
        if (dateErr) {
          dateErr.innerText = 'তারিখটা ঠিক করে দাও।';
          dateErr.style.display = 'block';
        }
        valid = false;
      } else {
        const selectedDate = new Date(lastP);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (isNaN(selectedDate.getTime())) {
          if (dateErr) {
            dateErr.innerText = 'তারিখটা ঠিক করে দাও।';
            dateErr.style.display = 'block';
          }
          valid = false;
        } else if (selectedDate > today) {
          if (dateErr) {
            dateErr.innerText = 'ভবিষ্যতের তারিখ দেওয়া যাবে না।';
            dateErr.style.display = 'block';
          }
          valid = false;
        } else if (dateErr) {
          dateErr.style.display = 'none';
        }
      }

      if (!valid) {
        this.safeVibrate([50, 50, 50]);
        return;
      }
    }
    this.nextOnboardingSlide(slideNum);
  },

  finishOnboarding() {
    if (this._isSavingOnboarding) return;
    this._isSavingOnboarding = true;

    try {
      const name = document.getElementById('ob-setup-name')?.value || '';
      const ageVal = document.getElementById('ob-setup-age')?.value;
      const ageNum = parseInt(ageVal, 10);
      const age = !isNaN(ageNum) && ageNum >= 10 && ageNum <= 65 ? ageNum : null;
      const lastP = document.getElementById('ob-setup-last-period')?.value;

      const isCycleUnknown = Boolean(document.getElementById('ob-cycle-unknown')?.checked);
      const isPeriodUnknown = Boolean(document.getElementById('ob-period-unknown')?.checked);

      const cycleSlider = document.getElementById('ob-setup-cycle');
      const periodSlider = document.getElementById('ob-setup-period');

      const cycle = isCycleUnknown ? 28 : (parseInt(cycleSlider?.value, 10) || 28);
      const period = isPeriodUnknown ? 5 : (parseInt(periodSlider?.value, 10) || 5);

      if (!lastP) {
        this._isSavingOnboarding = false;
        this.nextOnboardingSlide(2);
        this.showToast('তারিখটা ঠিক করে দাও।');
        return;
      }

      const start = new Date(lastP);
      if (isNaN(start.getTime())) {
        this._isSavingOnboarding = false;
        this.nextOnboardingSlide(2);
        this.showToast('তারিখটা ঠিক করে দাও।');
        return;
      }

      const end = new Date(start);
      end.setDate(end.getDate() + period - 1);
      const startDateStr = getLocalDateString(start);
      const endDateStr = getLocalDateString(end);

      STATE.profile = this.validate('profile', {
        name: name.trim(),
        age: age,
        lastPeriodStart: startDateStr,
        cycleLength: cycle,
        periodLength: period,
        isCycleUnknown,
        isPeriodUnknown,
        setupDone: true
      });

      STATE.periods = this.validate('periods', [{
        startDate: startDateStr,
        endDate: endDateStr,
        flow: 'মাঝারি'
      }]);

      if (!STATE.settings) {
        STATE.settings = this.validateSettings({});
      }

      this.saveData('fz_profile', STATE.profile);
      this.saveData('fz_periods', STATE.periods);
      this.saveData('fz_logs', STATE.logs || {});
      this.saveData('fz_settings', STATE.settings);

      document.getElementById('view-onboarding').classList.add('hidden');
      document.getElementById('main-app').classList.remove('hidden');

      this.calculatePredictions();
      this.renderHome();
      this.renderSettings();
      this.safeVibrate(50);
    } catch (err) {
      console.error('Error finishing onboarding:', err);
      this.showToast('⚠️ অনবোর্ডিং সংরক্ষণে সমস্যা হয়েছে');
    } finally {
      this._isSavingOnboarding = false;
    }
  },

  finishOnboardingSafe() {
    this.finishOnboarding();
  },

  // ==========================================
  // 6. HOME VIEW (CANONICAL)
  // ==========================================
  updateGreeting() {
    this.checkDateRollover();
    if (!STATE.profile) return;
    const greetingEl = document.getElementById('greeting-name');
    if (!greetingEl) return;
    const newGreeting = getGreetingByTime(STATE.profile.name);
    if (greetingEl.innerText !== newGreeting) {
      greetingEl.innerText = newGreeting;
    }
  },

  renderHome() {
    if (!STATE.profile) return;
    this.updateGreeting();
    const dateEl = document.getElementById('home-date');
    if (dateEl) dateEl.innerText = formatBanglaDate(new Date());

    if (!window.greetingInterval) {
      window.greetingInterval = setInterval(() => this.updateGreeting(), 60000);
    }

    const p = this.calculatePredictions();
    const todayStr = getLocalDateString(new Date());

    if (p) {
      const ringDay = document.getElementById('ring-day-num');
      if (ringDay) {
        ringDay.innerText = p.currentCycleDay != null ? `দিন ${toBanglaNumber(p.currentCycleDay)}` : '-';
      }

      const ringPhase = document.getElementById('ring-phase-badge');
      if (ringPhase) ringPhase.innerText = p.currentPhase || p.phaseName;

      const cycleRing = document.getElementById('cycle-ring');
      if (cycleRing) {
        // Heartbeat animation in fertile window & ovulation
        const isFertileOrOvulation = p.phaseName === "ডিম্বস্ফোটনের সময়" || 
          (p.fertileStartDateStr && todayStr >= p.fertileStartDateStr && todayStr <= p.fertileEndDateStr);
        if (isFertileOrOvulation) {
          cycleRing.classList.add('heartbeat');
        } else {
          cycleRing.classList.remove('heartbeat');
        }
      }

      const ringProgress = document.getElementById('ring-progress');
      if (ringProgress) {
        ringProgress.style.stroke = p.phaseColor;
        const totalCycle = p.predictedCycleLength || p.cycleLength || 28;
        const ratio = Math.min((p.currentCycleDay || 1) / totalCycle, 1);
        const offset = 283 - (283 * ratio);
        setTimeout(() => { ringProgress.style.strokeDashoffset = offset; }, 100);
      }

      const chipNext = document.getElementById('chip-next-period');
      if (chipNext) {
        if (p.isOverdue) {
          chipNext.innerText = `${toBanglaNumber(p.overdueDays)} দিন বিলম্বিত`;
        } else {
          chipNext.innerText = p.nextPeriodStart ? formatBanglaShortDate(p.nextPeriodStart) : '-';
        }
      }

      const chipCycle = document.getElementById('chip-cycle-length');
      if (chipCycle) {
        chipCycle.innerText = `${toBanglaNumber(p.predictedCycleLength || p.cycleLength || 28)} দিন`;
      }

      const chipPeriod = document.getElementById('chip-period-length');
      if (chipPeriod) {
        chipPeriod.innerText = `${toBanglaNumber(p.periodLength || 5)} দিন`;
      }

      const adviceEl = document.getElementById('home-advice');
      if (adviceEl) adviceEl.innerText = p.advice;

      const phaseCard = document.getElementById('home-phase-card');
      if (phaseCard) {
        phaseCard.style.background = `radial-gradient(circle at top right, color-mix(in srgb, ${p.phaseColor} 15%, transparent), var(--card))`;
      }

      const phaseIcon = document.getElementById('home-phase-icon');
      if (phaseIcon) {
        if (p.phaseName === "মাসিকের সময়") phaseIcon.innerText = '🩸';
        else if (p.phaseName === "ফলিকুলার পর্যায়") phaseIcon.innerText = '🌱';
        else if (p.phaseName === "ডিম্বস্ফোটনের সময়") phaseIcon.innerText = '✨';
        else phaseIcon.innerText = '🌙';
      }

      const wellnessSubtitle = document.getElementById('home-wellness-subtitle');
      if (wellnessSubtitle) {
        if (p.phaseName === "মাসিকের সময়") {
          wellnessSubtitle.innerText = "আজ শরীরকে একটু আরাম দাও। বেশি চাপ নিও না আজ।";
        } else if (p.phaseName === "ফলিকুলার পর্যায়") {
          wellnessSubtitle.innerText = "আজ হালকা পুষ্টিকর কিছু খেলে ভালো লাগবে। এনার্জি ধীরে ধীরে বাড়ছে।";
        } else if (p.phaseName === "ডিম্বস্ফোটনের সময়") {
          wellnessSubtitle.innerText = "পর্যাপ্ত পানি পান করো। আজ তোমার এনার্জি ও কনফিডেন্স সবচেয়ে ভালো থাকার কথা।";
        } else {
          wellnessSubtitle.innerText = "বেশি মানসিক চাপ নিও না। পরিমিত ঘুম ও বিশ্রাম নিলে মেজাজ শান্ত থাকবে।";
        }
      }
    }

    const quickLogText = document.getElementById('quick-log-text');
    if (quickLogText) {
      if (STATE.logs && STATE.logs[todayStr]) {
        quickLogText.innerText = 'আজকের তথ্য আপডেট করো ✏️';
      } else {
        quickLogText.innerText = 'আজকের তথ্য যোগ করো ✏️';
      }
    }

    this.updateStreak();
    this.renderHomeInsights();
  },

  updateStreak() {
    const logs = STATE.logs || {};
    const logDates = Object.keys(logs).filter(d => logs[d]).sort();
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let lastDate = null;

    logDates.forEach(dStr => {
      if (!lastDate) {
        tempStreak = 1;
      } else {
        const diffDays = Math.round((new Date(dStr) - new Date(lastDate)) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
      if (tempStreak > longestStreak) longestStreak = tempStreak;
      lastDate = dStr;
    });

    const todayStr = getLocalDateString(new Date());
    const yest = new Date();
    yest.setDate(yest.getDate() - 1);
    const yestStr = getLocalDateString(yest);

    if (logs[todayStr]) {
      let idx = logDates.indexOf(todayStr);
      let s = 1;
      while (idx > 0 && Math.round((new Date(logDates[idx]) - new Date(logDates[idx - 1])) / (1000 * 60 * 60 * 24)) === 1) {
        s++;
        idx--;
      }
      currentStreak = s;
    } else if (logs[yestStr]) {
      let idx = logDates.indexOf(yestStr);
      let s = 1;
      while (idx > 0 && Math.round((new Date(logDates[idx]) - new Date(logDates[idx - 1])) / (1000 * 60 * 60 * 24)) === 1) {
        s++;
        idx--;
      }
      currentStreak = s;
    } else {
      currentStreak = 0;
    }

    STATE.streak = { current: currentStreak, longest: longestStreak, lastDate: todayStr };
    this.saveData('fz_streak', STATE.streak);

    const currEl = document.getElementById('streak-current');
    if (currEl) currEl.innerText = `${toBanglaNumber(currentStreak)} দিন`;
    const longEl = document.getElementById('streak-longest');
    if (longEl) longEl.innerText = `${toBanglaNumber(longestStreak)} দিন`;
  },

  renderHomeMoodTimeline() {
    const container = document.querySelector('#view-home .mood-timeline');
    if (!container) return;
    const logs = STATE.logs || {};
    let html = '';

    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = getLocalDateString(d);
      const moodVal = logs[dStr]?.mood || null;
      const emoji = moodVal ? moodVal.split(' ')[0] : '➖';

      let label = '';
      if (i === 0) label = 'আজ';
      else if (i === 1) label = 'কাল';
      else label = formatBanglaShortDate(d);

      html += `
        <div style="text-align: center; flex: 1; min-width: 48px;">
          <div style="font-size: 1.6rem;">${emoji}</div>
          <small class="text-muted" style="font-size: 0.72rem; display: block; margin-top: 4px;">${label}</small>
        </div>
      `;
    }
    container.innerHTML = html;
  },

  renderHomeInsights() {
    const container = document.getElementById('home-insights');
    if (!container) return;
    const logs = STATE.logs || {};
    const logDates = Object.keys(logs).sort().reverse();
    const recentLogs = logDates.slice(0, 7).map(d => logs[d]).filter(Boolean);

    const cards = [];

    // Friendly 1: Sleep (Only if sleep was actually recorded - exclude null/missing)
    const validSleepLogs = recentLogs.filter(l => {
      const hasHours = typeof l.sleepHours === 'number' && !isNaN(l.sleepHours) && l.sleepHours > 0;
      const rawQuality = l.sleepQuality || l.sleep;
      const hasQuality = typeof rawQuality === 'string' && rawQuality.trim().length > 0;
      return hasHours || hasQuality;
    });

    if (validSleepLogs.length >= 2) {
      const isLowSleep = (l) => {
        if (typeof l.sleepHours === 'number' && !isNaN(l.sleepHours) && l.sleepHours > 0 && l.sleepHours < 7) return true;
        const q = l.sleepQuality || l.sleep;
        return typeof q === 'string' && (q.includes('কম') || q.includes('খারাপ'));
      };
      const isGoodSleep = (l) => {
        if (typeof l.sleepHours === 'number' && !isNaN(l.sleepHours) && l.sleepHours >= 7.5) return true;
        const q = l.sleepQuality || l.sleep;
        return typeof q === 'string' && q.includes('ভালো');
      };

      const lowSleepCount = validSleepLogs.filter(isLowSleep).length;
      const goodSleepCount = validSleepLogs.filter(isGoodSleep).length;

      if (lowSleepCount >= 2) {
        cards.push({ icon: '😴', text: 'গত কয়েকদিনে ঘুম কিছুটা কম হয়েছে, আজ একটু আগে ঘুমানোর চেষ্টা করো।' });
      } else if (goodSleepCount >= 2) {
        cards.push({ icon: '🌿', text: 'তোমার ঘুমের রুটিন চমৎকার চলছে! এটি শরীরের শক্তি বজায় রাখতে সহায়ক।' });
      }
    }

    // Friendly 2: Energy (Canonical 1-10 scale; exclude null/missing)
    const validEnergyLogs = recentLogs.filter(l => typeof l.energy === 'number' && !isNaN(l.energy) && l.energy >= 1 && l.energy <= 10);
    if (validEnergyLogs.length >= 2) {
      const highEnergyCount = validEnergyLogs.filter(l => l.energy >= 7).length;
      const lowEnergyCount = validEnergyLogs.filter(l => l.energy <= 4).length;

      if (highEnergyCount >= 2) {
        cards.push({ icon: '⚡', text: 'এই সপ্তাহে তোমার শক্তির মাত্রা বেশ ভালো ছিল।' });
      } else if (lowEnergyCount >= 2) {
        cards.push({ icon: '🍃', text: 'গত কয়েকদিনে শক্তির মাত্রা কিছুটা কম ছিল, একটু বাড়তি বিশ্রাম ও পুষ্টিকর খাবার নাও।' });
      }
    }

    // Friendly 3: Mood (Exclude null/missing)
    const validMoodLogs = recentLogs.filter(l => typeof l.mood === 'string' && l.mood.trim().length > 0);
    if (validMoodLogs.length >= 2) {
      const goodMoodCount = validMoodLogs.filter(l => l.mood.includes('ভালো') || l.mood.includes('প্রেমময়')).length;
      const stressedMoodCount = validMoodLogs.filter(l => l.mood.includes('কষ্টে') || l.mood.includes('বিরক্ত') || l.mood.includes('উদ্বিগ্ন') || l.mood.includes('হতাশ')).length;

      if (goodMoodCount >= 2) {
        cards.push({ icon: '🌸', text: 'মেজাজ বেশ শান্ত ও সুন্দর রয়েছে। ইতিবাচক অনুভূতি উপভোগ করো।' });
      } else if (stressedMoodCount >= 2) {
        cards.push({ icon: '💕', text: 'কিছুদিন ধরে কিছুটা মানসিক চাপ মনে হতে পারে, নিজের পছন্দের কাজে একটু সময় দাও।' });
      }
    }

    // Limit to max 3 concise cards per Section 3
    const finalCards = cards.slice(0, 3);
    if (finalCards.length === 0) {
      container.innerHTML = `
        <div class="card" style="min-width: 200px; flex: 0 0 auto; scroll-snap-align: start; padding: 1rem; border-radius: 20px; border: 1px solid color-mix(in srgb, var(--primary) 10%, transparent); background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 3%, transparent), color-mix(in srgb, var(--secondary) 1%, transparent));">
          <span style="font-size: 1.25rem; margin-bottom: 0.5rem; display: block;">🌸</span>
          <p style="font-size: 0.9rem; font-weight: 500; line-height: 1.4; color: var(--text-main);">নিয়মিত ৩–৪ দিন তথ্য যোগ করলে তোমার দৈনিক সারসংক্ষেপ এখানে দেখাবে</p>
        </div>
      `;
      return;
    }

    let html = '';
    finalCards.forEach(c => {
      html += `
        <div class="card" style="min-width: 220px; max-width: 260px; flex: 0 0 auto; scroll-snap-align: start; padding: 1.15rem; border-radius: 20px; background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 6%, transparent), color-mix(in srgb, var(--secondary) 4%, transparent)); border: 1px solid color-mix(in srgb, var(--primary) 15%, transparent);">
          <span style="font-size: 1.4rem; margin-bottom: 0.5rem; display: block;">${c.icon}</span>
          <p style="font-size: 0.88rem; font-weight: 500; line-height: 1.5; color: var(--text-main);">${c.text}</p>
        </div>
      `;
    });
    container.innerHTML = html;
  },

  // ==========================================
  // 7. CALENDAR VIEW (CANONICAL)
  // ==========================================
  prevMonth() {
    if (!this.calContextDate) this.calContextDate = new Date();
    this.calContextDate.setDate(1);
    this.calContextDate.setMonth(this.calContextDate.getMonth() - 1);
    this.renderCalendar();
  },

  nextMonth() {
    if (!this.calContextDate) this.calContextDate = new Date();
    this.calContextDate.setDate(1);
    this.calContextDate.setMonth(this.calContextDate.getMonth() + 1);
    this.renderCalendar();
  },

  renderCalendar() {
    const p = this.calculatePredictions();
    if (!this.calContextDate) {
      this.calContextDate = new Date();
      this.calContextDate.setDate(1);
    }
    const d = this.calContextDate;
    const month = d.getMonth();
    const year = d.getFullYear();

    const bnMonths = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
    const myEl = document.getElementById('cal-month-year');
    if (myEl) myEl.innerText = `${bnMonths[month]} ${toBanglaNumber(year)}`;

    const noPeriodEl = document.getElementById('cal-no-period-msg');
    if (noPeriodEl) {
      const hasPeriods = Array.isArray(STATE.periods) && STATE.periods.length > 0;
      noPeriodEl.style.display = hasPeriods ? 'none' : 'block';
    }

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const calDaysContainer = document.getElementById('cal-days');
    if (!calDaysContainer) return;
    calDaysContainer.innerHTML = '';

    for (let i = 0; i < firstDay; i++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell empty';
      calDaysContainer.appendChild(cell);
    }

    const todayStr = getLocalDateString(new Date());

    const isDateInLoggedPeriod = (dateStr) => {
      if (!STATE.periods || !Array.isArray(STATE.periods)) return false;
      return STATE.periods.some(per => {
        if (!per) return false;
        const s = per.startDate || per.start;
        const e = per.endDate || per.end || s;
        return s && dateStr >= s && dateStr <= e;
      });
    };

    const nextPStart = p?.predictionAvailable ? (p.nextPeriodDateStr || (p.nextPeriodStart ? getLocalDateString(p.nextPeriodStart) : '')) : '';
    const nextPEnd = p?.predictionAvailable ? (p.nextPeriodEndDateStr || (p.nextPeriodEnd ? getLocalDateString(p.nextPeriodEnd) : '')) : '';
    const fertStart = p?.predictionAvailable ? (p.fertileStartDateStr || (p.fertileStart ? getLocalDateString(p.fertileStart) : '')) : '';
    const fertEnd = p?.predictionAvailable ? (p.fertileEndDateStr || (p.fertileEnd ? getLocalDateString(p.fertileEnd) : '')) : '';
    const ovulDate = p?.predictionAvailable ? (p.ovulationDateStr || (p.ovulationDate ? getLocalDateString(p.ovulationDate) : '')) : '';

    for (let i = 1; i <= daysInMonth; i++) {
      const cellDate = new Date(year, month, i);
      const ds = getLocalDateString(cellDate);

      const cell = document.createElement('div');
      cell.className = 'cal-day-cell';
      cell.dataset.date = ds;
      cell.innerText = toBanglaNumber(i);

      if (ds === todayStr) cell.classList.add('today');
      if (this._currentModalDate === ds) cell.classList.add('selected');

      let statusInfo = '';
      if (isDateInLoggedPeriod(ds)) {
        cell.classList.add('period');
        statusInfo = 'মাসিকের সময় (রেকর্ডকৃত)';
      } else if (nextPStart && ds >= nextPStart && ds <= nextPEnd) {
        cell.classList.add('predicted-period');
        statusInfo = 'সম্ভাব্য পিরিয়ড';
      } else if (fertStart && ds >= fertStart && ds <= fertEnd) {
        if (ds === ovulDate) {
          cell.classList.add('ovulation');
          statusInfo = 'ডিম্বস্ফোটনের দিন (Ovulation)';
        } else {
          cell.classList.add('fertile');
          statusInfo = 'উর্বর সময় (Fertile Window)';
        }
      }

      if (STATE.logs && STATE.logs[ds]) {
        const dot = document.createElement('div');
        dot.style.width = '5px';
        dot.style.height = '5px';
        dot.style.borderRadius = '50%';
        dot.style.backgroundColor = 'currentColor';
        dot.style.marginTop = '2px';
        dot.style.opacity = '0.85';
        cell.appendChild(dot);
      }

      cell.onclick = () => this.openDayModal(ds, statusInfo);
      calDaysContainer.appendChild(cell);
    }
  },

  openDayModal(dateStr, phaseInfo) {
    this._currentModalDate = dateStr;
    const titleEl = document.getElementById('modal-date-title');
    if (titleEl) {
      const parsedD = parseLocalDate(dateStr);
      titleEl.innerText = formatBanglaDate(parsedD);
    }
    const subtitleEl = document.getElementById('modal-date-subtitle');
    if (subtitleEl) {
      const parsedD = parseLocalDate(dateStr);
      const bnDayNames = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
      subtitleEl.innerText = parsedD ? bnDayNames[parsedD.getDay()] : 'তারিখের বিবরণ';
    }

    // Update selected cell highlight in calendar
    document.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('selected'));
    const targetCell = document.querySelector(`.cal-day-cell[data-date="${dateStr}"]`);
    if (targetCell) targetCell.classList.add('selected');

    let html = '';
    const resolvedPhase = phaseInfo || this.calculatePhaseForDate(dateStr);
    if (resolvedPhase) {
      html += `<div class="mb-3 text-primary font-semibold" style="font-size: 0.95rem;">${resolvedPhase}</div>`;
    }

    const log = STATE.logs ? STATE.logs[dateStr] : null;
    const isPeriod = STATE.periods && Array.isArray(STATE.periods) && STATE.periods.some(p => {
      const s = p.startDate || p.start;
      const e = p.endDate || p.end || s;
      return s && dateStr >= s && dateStr <= e;
    });

    if (log || isPeriod) {
      html += `<div style="background: color-mix(in srgb, var(--primary) 5%, transparent); padding: 1rem; border-radius: 16px; margin-bottom: 0.5rem; border: 1px solid color-mix(in srgb, var(--primary) 12%, transparent);">`;
      if (isPeriod || log?.flow) {
        html += `<div class="mb-1 text-sm"><strong>পিরিয়ডের অবস্থা:</strong> ${log?.flow ? `রক্তপ্রবাহ ${escapeHTML(log.flow)}` : 'পিরিয়ড চলছে'}</div>`;
      }
      if (log?.mood) {
        html += `<div class="mb-1 text-sm"><strong>মেজাজ:</strong> ${escapeHTML(log.mood)}</div>`;
      }
      if (log?.symptoms && Array.isArray(log.symptoms) && log.symptoms.length > 0) {
        html += `<div class="mb-1 text-sm"><strong>লক্ষণসমূহ:</strong> ${log.symptoms.map(s => escapeHTML(s)).join(', ')}</div>`;
      }
      if (log?.energy !== undefined && log.energy !== null && log.energy !== '') {
        const eVal = typeof log.energy === 'number' ? (log.energy > 10 ? Math.round(log.energy / 10) : log.energy) : log.energy;
        html += `<div class="mb-1 text-sm"><strong>শক্তির মাত্রা:</strong> ${toBanglaNumber(eVal)}/১০</div>`;
      }
      if (log?.sleep) {
        html += `<div class="mb-1 text-sm"><strong>ঘুম:</strong> ${escapeHTML(log.sleep)}</div>`;
      }
      if (log?.notes && log.notes.trim()) {
        html += `<div class="mt-2 text-sm" style="border-top: 1px dashed var(--border); padding-top: 6px;"><strong>নোট:</strong> ${escapeHTML(log.notes)}</div>`;
      }
      html += `</div>`;
    } else {
      html += `<p class="text-sm text-muted" style="padding: 0.5rem 0;">এই দিনে কোনো তথ্য যোগ করা হয়নি।</p>`;
    }

    const contentEl = document.getElementById('modal-content-details');
    if (contentEl) contentEl.innerHTML = html;

    const btnPeriod = document.getElementById('mark-period-btn');
    const todayStr = getLocalDateString(new Date());

    if (btnPeriod) {
      if (!isPeriod && dateStr <= todayStr) {
        btnPeriod.style.display = 'block';
      } else {
        btnPeriod.style.display = 'none';
      }
    }

    const modal = document.getElementById('day-modal');
    if (modal) modal.classList.remove('hidden');
  },

  markPeriodOngoing() {
    if (!this._currentModalDate) return;
    const dStr = this._currentModalDate;

    if (!STATE.logs) STATE.logs = {};
    if (!STATE.logs[dStr]) {
      STATE.logs[dStr] = this.validate('dailyLog', { flow: 'মাঝারি', periodStarted: true }, dStr);
    } else {
      STATE.logs[dStr].flow = STATE.logs[dStr].flow || 'মাঝারি';
      STATE.logs[dStr].periodStarted = true;
    }
    this.saveData('fz_logs', STATE.logs);

    if (!STATE.periods) STATE.periods = [];
    const flowVal = STATE.logs[dStr].flow || 'মাঝারি';

    // 1. Check if dStr is already inside an active period
    const existing = STATE.periods.find(p => {
      const s = p.startDate || p.start;
      const e = p.endDate || p.end || s;
      return s && dStr >= s && dStr <= e;
    });

    if (existing) {
      if (flowVal) existing.flow = flowVal;
    } else {
      // 2. Check if dStr can naturally extend an open or nearby period
      const openPeriod = [...STATE.periods]
        .filter(p => (p.startDate || p.start) && !(p.endDate || p.end))
        .find(p => dStr >= (p.startDate || p.start));

      if (openPeriod) {
        if (flowVal) openPeriod.flow = flowVal;
      } else {
        // Create new canonical period interval starting on dStr
        STATE.periods.push({
          startDate: dStr,
          endDate: null,
          flow: flowVal,
          start: dStr,
          end: null
        });
      }
    }

    STATE.periods = this.validate('periods', STATE.periods);
    this.saveData('fz_periods', STATE.periods);

    if (STATE.profile && STATE.periods.length > 0) {
      const latestP = STATE.periods[STATE.periods.length - 1];
      STATE.profile.lastPeriodStart = latestP.startDate || latestP.start;
      this.saveData('fz_profile', STATE.profile);
    }

    this.calculatePredictions(true);
    this.renderHome();
    this.renderCalendar();
    this.closeDayModal();
    this.showToast('🌸 পিরিয়ড রেকর্ড সংরক্ষিত হয়েছে!');
    this.safeVibrate(50);
  },

  editLogFromCalendar() {
    if (!this._currentModalDate) return;
    const targetDate = this._currentModalDate;
    this.closeDayModal();
    this.switchTab('log');
    const logDateInput = document.getElementById('log-date');
    if (logDateInput) {
      logDateInput.value = targetDate;
      this.loadLogForDate();
    }
  },

  closeDayModal(e) {
    if (e && e.target !== document.getElementById('day-modal') && !e.target.classList.contains('close-btn')) return;
    const modal = document.getElementById('day-modal');
    if (modal) modal.classList.add('hidden');
    this._currentModalDate = null;
    document.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('selected'));
  },

  initBottomSheets() {
    let startY = 0;
    let currentY = 0;
    const grip = document.getElementById('day-sheet-grip');
    const content = document.getElementById('day-sheet-content');
    if (!grip || !content) return;

    grip.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
      content.style.transition = 'none';
    }, { passive: true });

    grip.addEventListener('touchmove', (e) => {
      currentY = e.touches[0].clientY;
      const delta = currentY - startY;
      if (delta > 0) content.style.transform = `translateY(${delta}px)`;
    }, { passive: true });

    grip.addEventListener('touchend', () => {
      const delta = currentY - startY;
      content.style.transition = 'transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.1)';
      if (delta > 100) {
        this.closeDayModal();
        setTimeout(() => { content.style.transform = ''; }, 400);
      } else {
        content.style.transform = 'translateY(0)';
      }
    });
  },

  // ==========================================
  // 8. LOG VIEW (CANONICAL)
  // ==========================================
  openTodayLog() {
    this.switchTab('log');
    const todayStr = getLocalDateString(new Date());
    const dateInput = document.getElementById('log-date');
    if (dateInput) {
      dateInput.value = todayStr;
      this.loadLogForDate();
    }
  },

  setupLogView() {
    const dateInput = document.getElementById('log-date');
    if (dateInput && !dateInput.value) {
      dateInput.value = getLocalDateString(new Date());
    }
    this.loadLogForDate();
  },

  onLogDateChange() {
    const dateInput = document.getElementById('log-date');
    if (!dateInput) return;
    const newDate = dateInput.value;
    if (!newDate) return;

    if (this.isLogDirty) {
      this.confirmDiscardUnsaved(() => {
        this.isLogDirty = false;
        this.isEditingNotes = false;
        this._currentLogDate = newDate;
        this.loadLogForDate();
      });
      const cancelBtn = document.getElementById('confirm-cancel-btn');
      if (cancelBtn) {
        cancelBtn.onclick = () => {
          if (dateInput && this._currentLogDate) {
            dateInput.value = this._currentLogDate;
          }
          this.closeConfirm();
        };
      }
    } else {
      this._currentLogDate = newDate;
      this.loadLogForDate();
    }
  },

  loadLogForDate() {
    const dateInput = document.getElementById('log-date');
    const dStr = dateInput ? (dateInput.value || getLocalDateString(new Date())) : getLocalDateString(new Date());
    if (dateInput && !dateInput.value) dateInput.value = dStr;
    this._currentLogDate = dStr;
    this.isLogDirty = false;
    this.isEditingNotes = false;

    // Reset all chip groups
    document.querySelectorAll('#period-start-chips .chip-item, #period-end-chips .chip-item, #flow-chips .chip-item, #symptom-chips .chip-item, #mood-chips .chip-item, #sleep-chips .chip-item').forEach(c => c.classList.remove('active'));

    const flowSection = document.getElementById('flow-section');
    if (flowSection) flowSection.style.display = 'none';

    const energyInput = document.getElementById('log-energy');
    if (energyInput) energyInput.value = 5;
    this.updateEnergyDisplay(5, false);

    const sleepHoursInput = document.getElementById('log-sleep-hours');
    if (sleepHoursInput) sleepHoursInput.value = 7.5;
    this.updateSleepHoursDisplay(7.5, false);

    const notesInput = document.getElementById('log-notes');
    if (notesInput) notesInput.value = '';

    // Check existing records in STATE
    const log = STATE.logs ? STATE.logs[dStr] : null;
    const periods = Array.isArray(STATE.periods) ? STATE.periods : [];
    const isPeriodStartInPeriods = periods.some(p => (p.startDate || p.start) === dStr);
    const isPeriodEndInPeriods = periods.some(p => (p.endDate || p.end) === dStr);
    const activePeriodInDate = periods.find(p => {
      const s = p.startDate || p.start;
      const e = p.endDate || p.end;
      if (!s) return false;
      if (e) return dStr >= s && dStr <= e;
      return dStr >= s;
    });

    // 1. Period Start status
    let isStart = false;
    if (log && typeof log.periodStarted === 'boolean') {
      isStart = log.periodStarted;
    } else if (log && log.flow) {
      isStart = true;
    } else if (isPeriodStartInPeriods) {
      isStart = true;
    } else if (!log && activePeriodInDate) {
      isStart = (activePeriodInDate.startDate || activePeriodInDate.start) === dStr;
    }

    const startChips = document.querySelectorAll('#period-start-chips .chip-item');
    startChips.forEach(c => {
      const txt = c.textContent.trim();
      if (isStart && txt === 'হ্যাঁ') c.classList.add('active');
      else if (!isStart && log && log.periodStarted === false && txt === 'না') c.classList.add('active');
    });

    // 2. Flow status
    const flowVal = log?.flow || (activePeriodInDate ? activePeriodInDate.flow : '');
    const showFlow = isStart || Boolean(flowVal) || Boolean(activePeriodInDate);
    if (showFlow && flowSection) {
      flowSection.style.display = 'block';
    }

    if (flowVal) {
      document.querySelectorAll('#flow-chips .chip-item').forEach(c => {
        const text = c.textContent.trim();
        if (text.includes(flowVal) || flowVal.includes(text.replace(/[^\u0980-\u09FF]/g, '').trim())) {
          c.classList.add('active');
        }
      });
    }

    // 3. Period End status
    let isEnd = false;
    if (log && typeof log.periodEnded === 'boolean') {
      isEnd = log.periodEnded;
    } else if (isPeriodEndInPeriods) {
      isEnd = true;
    }

    const endChips = document.querySelectorAll('#period-end-chips .chip-item');
    endChips.forEach(c => {
      const txt = c.textContent.trim();
      if (isEnd && txt === 'হ্যাঁ') c.classList.add('active');
      else if (!isEnd && log && log.periodEnded === false && txt === 'না') c.classList.add('active');
    });

    // 4. Symptoms
    if (log && log.symptoms && Array.isArray(log.symptoms)) {
      document.querySelectorAll('#symptom-chips .chip-item').forEach(c => {
        const text = c.textContent.trim();
        const clean = text.replace(/[^\u0980-\u09FF\s]/g, '').trim();
        if (log.symptoms.some(s => s.trim() === text || s.trim() === clean || text.includes(s.trim()))) {
          c.classList.add('active');
        }
      });
    }

    // 5. Mood
    if (log && log.mood) {
      document.querySelectorAll('#mood-chips .chip-item').forEach(c => {
        const text = c.textContent.trim();
        if (text === log.mood || text.includes(log.mood) || log.mood.includes(text)) {
          c.classList.add('active');
        }
      });
    }

    // 6. Energy (1-10)
    if (log && log.energy !== undefined && log.energy !== null) {
      let val = parseInt(log.energy, 10);
      if (val > 10) val = Math.min(10, Math.max(1, Math.round(val / 10)));
      else val = Math.min(10, Math.max(1, val));
      if (energyInput) energyInput.value = val;
      this._hasUserSetEnergy = true;
      this.updateEnergyDisplay(val, false);
    } else {
      this._hasUserSetEnergy = false;
      if (energyInput) energyInput.value = 5;
      const energyValEl = document.getElementById('energy-val');
      if (energyValEl) energyValEl.innerText = 'রেকর্ড করা হয়নি (৫/১০)';
    }

    // 7. Sleep Hours
    if (log && log.sleepHours !== undefined && log.sleepHours !== null) {
      let sHours = parseFloat(log.sleepHours);
      if (!isNaN(sHours) && sHours >= 0 && sHours <= 24) {
        if (sleepHoursInput) sleepHoursInput.value = sHours;
        this._hasUserSetSleepHours = true;
        this.updateSleepHoursDisplay(sHours, false);
      } else {
        this._hasUserSetSleepHours = false;
        if (sleepHoursInput) sleepHoursInput.value = 7.5;
        const sleepValEl = document.getElementById('sleep-hours-val');
        if (sleepValEl) sleepValEl.innerText = 'রেকর্ড করা হয়নি (৭.৫ ঘণ্টা)';
      }
    } else {
      this._hasUserSetSleepHours = false;
      if (sleepHoursInput) sleepHoursInput.value = 7.5;
      const sleepValEl = document.getElementById('sleep-hours-val');
      if (sleepValEl) sleepValEl.innerText = 'রেকর্ড করা হয়নি (৭.৫ ঘণ্টা)';
    }

    // 8. Sleep Quality
    const sleepQuality = log ? (log.sleepQuality || log.sleep) : '';
    if (sleepQuality) {
      document.querySelectorAll('#sleep-chips .chip-item').forEach(c => {
        const text = c.textContent.trim();
        if (text === sleepQuality || text.includes(sleepQuality) || sleepQuality.includes(text)) {
          c.classList.add('active');
        }
      });
    }

    // 9. Notes
    if (log && log.notes && notesInput) {
      notesInput.value = log.notes;
    }

    this.isLogDirty = false;
    this.isEditingNotes = false;
  },

  setPeriodStart(isStart) {
    const chips = document.querySelectorAll('#period-start-chips .chip-item');
    const yesChip = Array.from(chips).find(c => c.textContent.trim() === 'হ্যাঁ');
    const noChip = Array.from(chips).find(c => c.textContent.trim() === 'না');
    const target = isStart ? yesChip : noChip;
    const wasActive = target ? target.classList.contains('active') : false;

    chips.forEach(c => c.classList.remove('active'));
    const flowSection = document.getElementById('flow-section');

    if (!wasActive && target) {
      target.classList.add('active');
      if (isStart) {
        if (flowSection) flowSection.style.display = 'block';
        const activeFlow = document.querySelector('#flow-chips .chip-item.active');
        if (!activeFlow) {
          const defaultFlow = Array.from(document.querySelectorAll('#flow-chips .chip-item')).find(c => c.textContent.includes('মাঝারি'));
          if (defaultFlow) defaultFlow.classList.add('active');
        }
      } else {
        if (flowSection) flowSection.style.display = 'none';
        document.querySelectorAll('#flow-chips .chip-item').forEach(c => c.classList.remove('active'));
      }
    } else {
      if (flowSection) flowSection.style.display = 'none';
      document.querySelectorAll('#flow-chips .chip-item').forEach(c => c.classList.remove('active'));
    }

    this.markLogDirty();
    this.safeVibrate(20);
  },

  setPeriodEnd(isEnd) {
    const chips = document.querySelectorAll('#period-end-chips .chip-item');
    const yesChip = Array.from(chips).find(c => c.textContent.trim() === 'হ্যাঁ');
    const noChip = Array.from(chips).find(c => c.textContent.trim() === 'না');
    const target = isEnd ? yesChip : noChip;
    const wasActive = target ? target.classList.contains('active') : false;

    chips.forEach(c => c.classList.remove('active'));

    if (!wasActive && target) {
      target.classList.add('active');
    }

    this.markLogDirty();
    this.safeVibrate(20);
  },

  toggleChip(el) {
    el.classList.toggle('active');
    this.markLogDirty();
    this.safeVibrate(20);
  },

  toggleSingleChip(el, parentId) {
    const container = document.getElementById(parentId);
    if (!container) return;
    const wasActive = el.classList.contains('active');
    container.querySelectorAll('.chip-item').forEach(c => c.classList.remove('active'));

    if (!wasActive) {
      el.classList.add('active');
      if (parentId === 'flow-chips') {
        const startChips = document.querySelectorAll('#period-start-chips .chip-item');
        startChips.forEach(c => {
          if (c.textContent.trim() === 'না') c.classList.remove('active');
        });
        const flowSection = document.getElementById('flow-section');
        if (flowSection) flowSection.style.display = 'block';
      }
    }
    this.markLogDirty();
    this.safeVibrate(20);
  },

  toggleSymptomChip(el) {
    const txt = el.textContent.trim();
    const isNone = txt.includes('কোনো সমস্যা নেই');
    const wasActive = el.classList.contains('active');

    if (isNone) {
      if (!wasActive) {
        document.querySelectorAll('#symptom-chips .chip-item').forEach(c => c.classList.remove('active'));
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    } else {
      document.querySelectorAll('#symptom-chips .chip-item').forEach(c => {
        if (c.textContent.trim().includes('কোনো সমস্যা নেই')) c.classList.remove('active');
      });
      el.classList.toggle('active');
    }

    this.markLogDirty();
    this.safeVibrate(20);
  },

  updateEnergyDisplay(val, markDirty = true) {
    if (markDirty) {
      this._hasUserSetEnergy = true;
    }
    const energyVal = document.getElementById('energy-val');
    if (energyVal) {
      if (this._hasUserSetEnergy) {
        energyVal.innerText = `শক্তি: ${toBanglaNumber(val)}/১০`;
      } else {
        energyVal.innerText = `রেকর্ড করা হয়নি (${toBanglaNumber(val)}/১০)`;
      }
    }
    if (markDirty) this.markLogDirty();
  },

  updateSleepHoursDisplay(val, markDirty = true) {
    if (markDirty) {
      this._hasUserSetSleepHours = true;
    }
    const sleepVal = document.getElementById('sleep-hours-val');
    if (sleepVal) {
      const num = parseFloat(val);
      const str = (num % 1 === 0) ? String(parseInt(num, 10)) : num.toFixed(1);
      if (this._hasUserSetSleepHours) {
        sleepVal.innerText = `${toBanglaNumber(str)} ঘণ্টা`;
      } else {
        sleepVal.innerText = `রেকর্ড করা হয়নি (${toBanglaNumber(str)} ঘণ্টা)`;
      }
    }
    if (markDirty) this.markLogDirty();
  },

  markLogDirty() {
    this.isLogDirty = true;
    this.isEditingNotes = true;
  },

  saveLog() {
    const dateInput = document.getElementById('log-date');
    const dStr = dateInput ? (dateInput.value || getLocalDateString(new Date())) : getLocalDateString(new Date());

    const startActive = document.querySelector('#period-start-chips .chip-item.active');
    let periodStarted = false;
    if (startActive) {
      periodStarted = startActive.textContent.trim() === 'হ্যাঁ';
    }

    const endActive = document.querySelector('#period-end-chips .chip-item.active');
    let periodEnded = false;
    if (endActive) {
      periodEnded = endActive.textContent.trim() === 'হ্যাঁ';
    }

    const flowEl = document.querySelector('#flow-chips .chip-item.active');
    let flow = '';
    if (flowEl) {
      const raw = flowEl.textContent.trim();
      if (raw.includes('হালকা')) flow = 'হালকা';
      else if (raw.includes('মাঝারি')) flow = 'মাঝারি';
      else if (raw.includes('ভারী')) flow = 'ভারী';
      else if (raw.includes('স্পটিং')) flow = 'স্পটিং';
      else flow = raw;
    }

    if (periodStarted && !flow) {
      flow = 'মাঝারি';
    }
    if (flow) {
      periodStarted = true;
    }

    const symptoms = [];
    document.querySelectorAll('#symptom-chips .chip-item.active').forEach(c => {
      symptoms.push(c.textContent.trim());
    });

    const moodEl = document.querySelector('#mood-chips .chip-item.active');
    const mood = moodEl ? moodEl.textContent.trim() : '';

    const energyInput = document.getElementById('log-energy');
    const energyVal = (this._hasUserSetEnergy && energyInput) ? parseInt(energyInput.value, 10) : null;

    const sleepHoursInput = document.getElementById('log-sleep-hours');
    const sleepHours = (this._hasUserSetSleepHours && sleepHoursInput) ? parseFloat(sleepHoursInput.value) : null;

    const sleepEl = document.querySelector('#sleep-chips .chip-item.active');
    const sleepQuality = sleepEl ? sleepEl.textContent.trim() : '';

    const notes = document.getElementById('log-notes')?.value || '';

    const validatedLog = this.validate('dailyLog', {
      date: dStr,
      periodStarted,
      periodEnded,
      flow,
      symptoms,
      mood,
      energy: energyVal,
      sleepHours,
      sleepQuality,
      sleep: sleepQuality,
      notes
    }, dStr);

    if (!STATE.logs) STATE.logs = {};
    STATE.logs[dStr] = validatedLog;
    this.saveData('fz_logs', STATE.logs);

    // Period synchronization with canonical STATE.periods
    if (!STATE.periods) STATE.periods = [];

    // Validation: Period End cannot be before matching Period Start
    if (periodEnded) {
      // Find the open or active period record whose start is <= dStr
      const candidateP = [...STATE.periods]
        .filter(p => (p.startDate || p.start) && (p.startDate || p.start) <= dStr && !(p.endDate || p.end))
        .sort((a, b) => parseLocalDate(b.startDate || b.start).getTime() - parseLocalDate(a.startDate || a.start).getTime())[0];

      if (!candidateP) {
        // Also check if there is an active closed period covering dStr or starting before dStr
        const anyPrior = [...STATE.periods]
          .filter(p => (p.startDate || p.start) && (p.startDate || p.start) <= dStr)
          .sort((a, b) => parseLocalDate(b.startDate || b.start).getTime() - parseLocalDate(a.startDate || a.start).getTime())[0];

        // Check if user is attempting to set an end date earlier than start date
        const strictlyFuture = STATE.periods.find(p => (p.startDate || p.start) && (p.startDate || p.start) > dStr);
        if (strictlyFuture && !anyPrior) {
          this.showToast('পিরিয়ড শেষের তারিখ শুরুর তারিখের আগে হতে পারবে না।');
          this.safeVibrate([50, 50, 50]);
          return;
        }
      }
    }

    if (periodStarted) {
      // Find if dStr is already inside any period
      const existing = STATE.periods.find(p => {
        const s = p.startDate || p.start;
        const e = p.endDate || p.end;
        if (!s) return false;
        if (e) return dStr >= s && dStr <= e;
        return dStr >= s;
      });

      if (existing) {
        // Update existing record
        if (flow) existing.flow = flow;
        // If it starts after dStr, update its start
        if ((existing.startDate || existing.start) > dStr) {
          existing.startDate = dStr;
          existing.start = dStr;
        }
      } else {
        // Create new period record starting at dStr
        STATE.periods.push({
          startDate: dStr,
          endDate: null,
          flow: flow || 'মাঝারি',
          start: dStr,
          end: null
        });
      }
    }

    if (periodEnded) {
      // Find the active period whose start date is on or before the selected date and which does not already have an end date
      let pToClose = [...STATE.periods]
        .filter(p => (p.startDate || p.start) && (p.startDate || p.start) <= dStr && !(p.endDate || p.end))
        .sort((a, b) => parseLocalDate(b.startDate || b.start).getTime() - parseLocalDate(a.startDate || a.start).getTime())[0];

      if (!pToClose) {
        // If no open period, check if there is a period containing dStr whose end date can be updated to dStr
        pToClose = [...STATE.periods]
          .filter(p => (p.startDate || p.start) && (p.startDate || p.start) <= dStr)
          .sort((a, b) => parseLocalDate(b.startDate || b.start).getTime() - parseLocalDate(a.startDate || a.start).getTime())[0];
      }

      if (pToClose) {
        pToClose.endDate = dStr;
        pToClose.end = dStr;
        if (flow) pToClose.flow = flow;
      } else {
        // If user logged period end without an earlier start, create an interval [dStr -> dStr]
        STATE.periods.push({
          startDate: dStr,
          endDate: dStr,
          flow: flow || 'মাঝারি',
          start: dStr,
          end: dStr
        });
      }
    }

    // Flow sync for active period if neither periodStarted nor periodEnded was explicitly clicked
    if (!periodStarted && !periodEnded && flow) {
      const activeP = STATE.periods.find(p => {
        const s = p.startDate || p.start;
        const e = p.endDate || p.end;
        if (!s) return false;
        if (e) return dStr >= s && dStr <= e;
        return dStr >= s;
      });
      if (activeP) {
        activeP.flow = flow;
      } else {
        STATE.periods.push({
          startDate: dStr,
          endDate: null,
          flow: flow,
          start: dStr,
          end: null
        });
      }
    }

    // Removing period status: if explicitly set to "না" and no flow
    if (startActive && startActive.textContent.trim() === 'না' && !flow) {
      // 1. If dStr is the exact start date of a period
      const exactStartP = STATE.periods.find(p => (p.startDate || p.start) === dStr);
      if (exactStartP) {
        if (!exactStartP.endDate && !exactStartP.end) {
          // Single-point open period with no end -> remove safely
          STATE.periods = STATE.periods.filter(p => p !== exactStartP);
        } else {
          const eStr = exactStartP.endDate || exactStartP.end;
          if (eStr === dStr) {
            // 1-day period [dStr, dStr] -> remove safely
            STATE.periods = STATE.periods.filter(p => p !== exactStartP);
          } else {
            // Multi-day period -> advance start date by +1 day so dStr is removed from period
            const nextStart = getLocalDateString(addDays(parseLocalDate(dStr), 1));
            if (nextStart <= eStr) {
              exactStartP.startDate = nextStart;
              exactStartP.start = nextStart;
            } else {
              STATE.periods = STATE.periods.filter(p => p !== exactStartP);
            }
          }
        }
      } else {
        // 2. Check if dStr is the exact end date
        const exactEndP = STATE.periods.find(p => (p.endDate || p.end) === dStr);
        if (exactEndP) {
          const prevEnd = getLocalDateString(addDays(parseLocalDate(dStr), -1));
          const sStr = exactEndP.startDate || exactEndP.start;
          if (prevEnd >= sStr) {
            exactEndP.endDate = prevEnd;
            exactEndP.end = prevEnd;
          } else {
            STATE.periods = STATE.periods.filter(p => p !== exactEndP);
          }
        }
      }
    }

    STATE.periods = this.validate('periods', STATE.periods);
    this.saveData('fz_periods', STATE.periods);

    if (STATE.profile && STATE.periods.length > 0) {
      const latestP = STATE.periods[STATE.periods.length - 1];
      STATE.profile.lastPeriodStart = latestP.startDate || latestP.start;
      this.saveData('fz_profile', STATE.profile);
    }

    this.calculatePredictions(true);
    this.updateStreak();
    this.isLogDirty = false;
    this.isEditingNotes = false;

    const btn = document.getElementById('save-log-btn');
    if (btn) {
      btn.style.transform = 'scale(0.96)';
      setTimeout(() => { btn.style.transform = 'scale(1)'; }, 200);
    }

    const todayStr = getLocalDateString(new Date());
    if (dStr === todayStr) {
      const quickLogText = document.getElementById('quick-log-text');
      if (quickLogText) quickLogText.innerText = 'আজকের লগ সম্পন্ন হয়েছে ✓';
    }

    this.showToast('✅ তথ্য সফলভাবে সংরক্ষিত হয়েছে!');
    this.safeVibrate(50);
  },

  // ==========================================
  // 9. ANALYTICS VIEW (CANONICAL)
  // ==========================================
  destroyChart(id) {
    if (this.charts[id]) {
      try {
        this.charts[id].destroy();
      } catch (e) {
        console.warn('Chart destroy error:', id, e);
      }
      this.charts[id] = null;
    }
  },

  safeCreateChart(id, ctx, config) {
    this.destroyChart(id);
    if (typeof Chart === 'undefined') {
      const container = ctx?.canvas?.parentElement;
      if (container) {
        container.innerHTML = '<p class="text-muted text-sm text-center py-4">📊 এই চার্টটা এখন দেখানো যাচ্ছে না।</p>';
      }
      return;
    }
    try {
      this.charts[id] = new Chart(ctx, config);
    } catch (e) {
      console.warn('Chart render error:', id, e);
      const container = ctx?.canvas?.parentElement;
      if (container) {
        container.innerHTML = '<p class="text-muted text-sm text-center py-4">📊 এই চার্টটা এখন দেখানো যাচ্ছে না।</p>';
      }
    }
  },

  calculatePhaseForDate(dateStr) {
    const d = parseLocalDate(dateStr);
    if (!d || isNaN(d.getTime())) return null;

    const periods = (STATE.periods || []).filter(p => {
      const s = parseLocalDate(p?.startDate || p?.start);
      return s && !isNaN(s.getTime());
    });
    const pLen = Math.min(Math.max(parseInt(STATE.profile?.periodLength, 10) || 5, 2), 12);
    const cLen = Math.min(Math.max(parseInt(STATE.profile?.cycleLength, 10) || 28, 20), 45);

    // Find prior period anchor on or before date d
    const priorPeriod = [...periods]
      .filter(p => {
        const s = parseLocalDate(p.startDate || p.start);
        return s && s <= d;
      })
      .sort((a, b) => parseLocalDate(b.startDate || b.start).getTime() - parseLocalDate(a.startDate || a.start).getTime())[0];

    const priorStart = priorPeriod
      ? parseLocalDate(priorPeriod.startDate || priorPeriod.start)
      : (STATE.profile?.lastPeriodStart && parseLocalDate(STATE.profile.lastPeriodStart) <= d ? parseLocalDate(STATE.profile.lastPeriodStart) : null);

    if (!priorStart) {
      // Delegate to canonical phase calculation
      const fallbackResult = this.calculateCurrentPhase({
        today: d,
        allPeriods: periods,
        latestPeriodStart: null,
        periodLength: pLen,
        ovulationDate: null,
        fertileStartDate: null,
        fertileEndDate: null,
        nextPeriodStart: null,
        isOverdue: false,
        overdueDays: 0
      });
      return fallbackResult ? fallbackResult.phaseName : null;
    }

    // Determine next period start for that cycle
    const nextPeriod = periods
      .filter(p => {
        const s = parseLocalDate(p.startDate || p.start);
        return s && s > priorStart;
      })
      .sort((a, b) => parseLocalDate(a.startDate || a.start).getTime() - parseLocalDate(b.startDate || b.start).getTime())[0];

    const cycleNextPeriodStart = nextPeriod
      ? parseLocalDate(nextPeriod.startDate || nextPeriod.start)
      : addDays(priorStart, cLen);

    const ovulationDate = this.calculateOvulation(cycleNextPeriodStart);
    const fertileWindow = this.calculateFertileWindow(ovulationDate);

    const isOverdue = !nextPeriod && d > cycleNextPeriodStart;
    const overdueDays = isOverdue ? diffInDays(d, cycleNextPeriodStart) : 0;

    // Canonical phase calculation call
    const phaseResult = this.calculateCurrentPhase({
      today: d,
      allPeriods: periods,
      latestPeriodStart: priorStart,
      periodLength: pLen,
      ovulationDate,
      fertileStartDate: fertileWindow.fertileStartDate,
      fertileEndDate: fertileWindow.fertileEndDate,
      nextPeriodStart: cycleNextPeriodStart,
      isOverdue,
      overdueDays
    });

    return phaseResult ? phaseResult.phaseName : null;
  },

  renderAnalytics() {
    const textColor = this.getThemeColor('--text-muted') || '#888888';
    if (typeof Chart !== 'undefined') {
      Chart.defaults.font.family = 'system-ui, -apple-system, sans-serif';
      Chart.defaults.color = textColor;
      Chart.defaults.scale.grid.color = this.getThemeColor('--border') || '#EEEEEE';
    }

    const p = this.calculatePredictions();
    const periods = [...(STATE.periods || [])].sort((a, b) => new Date(a.startDate || a.start) - new Date(b.startDate || b.start));
    const logs = STATE.logs || {};

    // 1. Predictions Card (পরবর্তী সময়ের হিসাব)
    const predMsg = document.getElementById('pred-unavailable-msg');
    const predNext = document.getElementById('pred-next-period');
    const predOvul = document.getElementById('pred-ovulation');
    const predFw = document.getElementById('pred-fertile-window');

    if (p && p.predictionAvailable) {
      if (predNext) {
        predNext.innerText = `${formatBanglaShortDate(p.nextPeriodStart)}${p.isNextPeriodLogged ? ' (লগকৃত)' : ''}`;
      }
      if (predOvul) predOvul.innerText = formatBanglaShortDate(p.ovulationDate);
      if (predFw) {
        predFw.innerText = `${formatBanglaShortDate(p.fertileStartDate)} – ${formatBanglaShortDate(p.fertileEndDate)}`;
      }
      if (predMsg) {
        predMsg.innerText = `নির্ভরযোগ্যতা: ${p.confidenceLevel} (${toBanglaNumber(p.confidenceScore)}%)`;
        predMsg.style.display = 'block';
      }
    } else if (p && p.isOverdue) {
      if (predNext) predNext.innerText = `${toBanglaNumber(p.overdueDays)} দিন বিলম্বিত`;
      if (predOvul) predOvul.innerText = '-';
      if (predFw) predFw.innerText = '-';
      if (predMsg) {
        predMsg.innerText = p.overdueDate ? `সম্ভাব্য তারিখ (${formatBanglaShortDate(p.overdueDate)}) পেরিয়ে গেছে। নতুন পিরিয়ড শুরু হলে লগ করো 🌸` : 'পিরিয়ডের সম্ভাব্য তারিখ পেরিয়ে গেছে।';
        predMsg.style.display = 'block';
      }
    } else {
      if (predNext) predNext.innerText = '-';
      if (predOvul) predOvul.innerText = '-';
      if (predFw) predFw.innerText = '-';
      if (predMsg) {
        predMsg.innerText = 'আরও তথ্য যোগ করলে পরের সময়ের হিসাব দেখানো যাবে।';
        predMsg.style.display = 'block';
      }
    }

    // 2. Statistics Grid (সংক্ষিপ্ত পরিসংখ্যান)
    const cycleLengths = (p?.cycleLengths || []).filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
    const validPeriodLengths = [];
    periods.forEach(per => {
      const s = parseLocalDate(per.startDate || per.start);
      const e = parseLocalDate(per.endDate || per.end);
      if (s && e) {
        const pLen = diffInDays(e, s) + 1;
        if (pLen >= 2 && pLen <= 12) validPeriodLengths.push(pLen);
      }
    });

    const statAvgCycle = document.getElementById('stat-avg-cycle');
    const statAvgCycleSub = document.getElementById('stat-avg-cycle-sub');
    if (cycleLengths.length > 0) {
      const avgCycle = Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length);
      if (statAvgCycle) statAvgCycle.innerText = `${toBanglaNumber(avgCycle)} দিন`;
      if (statAvgCycleSub) statAvgCycleSub.innerText = `গড় সাইকেল: ${toBanglaNumber(avgCycle)} দিন`;
    } else {
      if (statAvgCycle) statAvgCycle.innerText = '-';
      if (statAvgCycleSub) statAvgCycleSub.innerText = 'গড় সাইকেল: -';
    }

    const statAvgPeriod = document.getElementById('stat-avg-period');
    const statAvgPeriodSub = document.getElementById('stat-avg-period-sub');
    if (validPeriodLengths.length > 0) {
      const avgPeriod = Math.round(validPeriodLengths.reduce((a, b) => a + b, 0) / validPeriodLengths.length);
      if (statAvgPeriod) statAvgPeriod.innerText = `${toBanglaNumber(avgPeriod)} দিন`;
      if (statAvgPeriodSub) statAvgPeriodSub.innerText = `গড় পিরিয়ড: ${toBanglaNumber(avgPeriod)} দিন`;
    } else {
      if (statAvgPeriod) statAvgPeriod.innerText = '-';
      if (statAvgPeriodSub) statAvgPeriodSub.innerText = 'গড় পিরিয়ড: -';
    }

    const minCycleEl = document.getElementById('stat-min-cycle');
    if (minCycleEl) {
      minCycleEl.innerText = (p?.cycleVariability?.min > 0) ? `${toBanglaNumber(p.cycleVariability.min)} দিন` : '-';
    }
    const maxCycleEl = document.getElementById('stat-max-cycle');
    if (maxCycleEl) {
      maxCycleEl.innerText = (p?.cycleVariability?.max > 0) ? `${toBanglaNumber(p.cycleVariability.max)} দিন` : '-';
    }

    const totalLogs = Object.keys(logs).length;
    const totLogsEl = document.getElementById('stat-total-logs');
    if (totLogsEl) totLogsEl.innerText = `${toBanglaNumber(totalLogs)} দিন`;

    // 3. Smart Health Analysis (Canonical Single Section)
    this.renderSmartHealthAnalysis(logs, p);

    // 4. Charts
    this.renderCycleChart(cycleLengths);
    this.renderPeriodChart(validPeriodLengths);
    this.renderSymptomChart(logs);
    this.renderMoodChart(logs);

    // 5. Mood Timeline (Date-by-date emotional history)
    this.renderAnalyticsMoodTimeline(logs);
  },

  renderSmartHealthAnalysis(logs, predictions) {
    const container = document.getElementById('smart-insights-container');
    if (!container) return;

    const cards = [];
    const logDates = Object.keys(logs || {}).sort().reverse();
    const deepLogs = logDates.map(d => ({ date: d, data: logs[d] }));

    // F. Cycle Variability & Irregularity Analysis
    if (predictions && predictions.cycleVariability) {
      const v = predictions.cycleVariability;
      if (v.count >= 2) {
        let statusBadge = predictions.irregularityStatus || "নিয়মিত";
        let statusColor = "var(--secondary)";
        if (v.status === "slightly_irregular") {
          statusColor = "#FFB300";
        } else if (v.status === "irregular") {
          statusColor = "var(--primary)";
        }

        cards.push(`
          <div class="card mb-3" style="border-radius: 20px; background: linear-gradient(135deg, color-mix(in srgb, ${statusColor} 8%, transparent), transparent); border: 1px solid color-mix(in srgb, ${statusColor} 25%, transparent);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin: 0;">সাইকেল ভ্যারিয়েবিলিটি ও নিয়মিততা</h4>
              <span style="background: ${statusColor}; color: white; padding: 4px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 600;">${statusBadge}</span>
            </div>
            <p style="font-size: 0.9rem; line-height: 1.5; color: var(--text-main); margin-bottom: 0.75rem;">${predictions.variabilityMessage}</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
              <div style="background: var(--card); padding: 0.75rem; border-radius: 12px; text-align: center; border: 1px solid var(--border);">
                <small class="text-muted" style="font-size: 0.72rem; display: block;">ভ্যারিয়েশন</small>
                <strong style="font-size: 1.1rem; color: var(--text-main);">±${toBanglaNumber(Math.round(v.diff / 2))} দিন</strong>
              </div>
              <div style="background: var(--card); padding: 0.75rem; border-radius: 12px; text-align: center; border: 1px solid var(--border);">
                <small class="text-muted" style="font-size: 0.72rem; display: block;">পূর্বাভাস কনফিডেন্স</small>
                <strong style="font-size: 1.1rem; color: var(--text-main);">${predictions.confidenceLevel} (${toBanglaNumber(predictions.confidenceScore)}%)</strong>
              </div>
            </div>
          </div>
        `);
      }
    }

    // A. ঘুম বনাম শক্তি (Sleep vs Energy)
    const sleepEnergyLogs = deepLogs.filter(l => {
      const d = l.data;
      if (!d) return false;
      const hasSleep = (typeof d.sleepHours === 'number' && !isNaN(d.sleepHours) && d.sleepHours > 0) ||
                       (typeof d.sleep === 'string' && d.sleep.trim().length > 0) ||
                       (typeof d.sleepQuality === 'string' && d.sleepQuality.trim().length > 0);
      const hasEnergy = typeof d.energy === 'number' && !isNaN(d.energy) && d.energy >= 1 && d.energy <= 10;
      return hasSleep && hasEnergy;
    });

    if (sleepEnergyLogs.length >= 3) {
      let lowSleepEnergySum = 0, lowSleepCount = 0;
      let goodSleepEnergySum = 0, goodSleepCount = 0;

      sleepEnergyLogs.forEach(l => {
        const { sleep, sleepHours, sleepQuality, energy } = l.data;
        const eVal = energy;
        const rawSleep = sleepQuality || sleep;
        const isLowSleep = (typeof sleepHours === 'number' && sleepHours < 7) ||
                           (typeof rawSleep === 'string' && (rawSleep.includes('কম') || rawSleep.includes('খারাপ')));
        const isGoodSleep = (typeof sleepHours === 'number' && sleepHours >= 7.5) ||
                            (typeof rawSleep === 'string' && rawSleep.includes('ভালো'));

        if (isLowSleep) {
          lowSleepEnergySum += eVal;
          lowSleepCount++;
        }
        if (isGoodSleep) {
          goodSleepEnergySum += eVal;
          goodSleepCount++;
        }
      });

      if (lowSleepCount >= 2 && (lowSleepEnergySum / lowSleepCount) <= 5) {
        const avg = Math.round(lowSleepEnergySum / lowSleepCount);
        cards.push(`
          <div class="card mb-3" style="border-radius: 18px; padding: 1rem; border-left: 4px solid var(--primary); background: var(--card);">
            <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <span style="font-size: 1.6rem;">😴</span>
              <div>
                <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 2px;">ঘুম ও শক্তির সম্পর্ক</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.45; margin: 0;">ঘুম কম হলে তোমার এনার্জিও কমে যাচ্ছে (গড়ে ${toBanglaNumber(avg)}/১০)। পর্যাপ্ত ৭–৮ ঘণ্টা নির্বিঘ্ন বিশ্রাম শক্তির মাত্রা ধরে রাখতে সাহায্য করবে।</p>
              </div>
            </div>
          </div>
        `);
      } else if (goodSleepCount >= 2 && (goodSleepEnergySum / goodSleepCount) >= 6) {
        const avg = Math.round(goodSleepEnergySum / goodSleepCount);
        cards.push(`
          <div class="card mb-3" style="border-radius: 18px; padding: 1rem; border-left: 4px solid var(--secondary); background: var(--card);">
            <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <span style="font-size: 1.6rem;">⚡</span>
              <div>
                <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 2px;">ভালো ঘুমের সুফল</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.45; margin: 0;">যেসব দিনে ঘুম ভালো হয়েছে, সেদিন তোমার শক্তির মাত্রা বেশি ছিল (গড়ে ${toBanglaNumber(avg)}/১০)। এই সুন্দর রুটিন ধরে রাখো।</p>
              </div>
            </div>
          </div>
        `);
      }
    }

    // B. ঘুম বনাম মেজাজ (Sleep vs Mood)
    const sleepMoodLogs = deepLogs.filter(l => {
      const d = l.data;
      if (!d) return false;
      const hasSleep = (typeof d.sleepHours === 'number' && !isNaN(d.sleepHours) && d.sleepHours > 0) ||
                       (typeof d.sleep === 'string' && d.sleep.trim().length > 0) ||
                       (typeof d.sleepQuality === 'string' && d.sleepQuality.trim().length > 0);
      const hasMood = typeof d.mood === 'string' && d.mood.trim().length > 0;
      return hasSleep && hasMood;
    });

    if (sleepMoodLogs.length >= 3) {
      let lowSleepNegativeMood = 0;
      let goodSleepPositiveMood = 0;

      sleepMoodLogs.forEach(l => {
        const { sleep, sleepHours, sleepQuality, mood } = l.data;
        const rawSleep = sleepQuality || sleep;
        const isLowSleep = (typeof sleepHours === 'number' && sleepHours < 7) ||
                           (typeof rawSleep === 'string' && (rawSleep.includes('কম') || rawSleep.includes('খারাপ')));
        const isGoodSleep = (typeof sleepHours === 'number' && sleepHours >= 7.5) ||
                            (typeof rawSleep === 'string' && rawSleep.includes('ভালো'));

        if (isLowSleep && (mood.includes('কষ্টে') || mood.includes('বিরক্ত') || mood.includes('উদ্বিগ্ন') || mood.includes('হতাশ') || mood.includes('রাগী'))) {
          lowSleepNegativeMood++;
        }
        if (isGoodSleep && (mood.includes('ভালো') || mood.includes('প্রেমময়'))) {
          goodSleepPositiveMood++;
        }
      });

      if (lowSleepNegativeMood >= 2) {
        cards.push(`
          <div class="card mb-3" style="border-radius: 18px; padding: 1rem; border-left: 4px solid var(--accent); background: var(--card);">
            <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <span style="font-size: 1.6rem;">🌙</span>
              <div>
                <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 2px;">ঘুম ও মেজাজের ভারসাম্য</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.45; margin: 0;">ঘুম কম হওয়ার দিনে মেজাজে বিরক্তি বা সংবেদনশীলতা বেশি দেখা গেছে। নিয়মিত পর্যাপ্ত বিশ্রাম মেজাজ নিয়ন্ত্রণে সহায়ক।</p>
              </div>
            </div>
          </div>
        `);
      } else if (goodSleepPositiveMood >= 2) {
        cards.push(`
          <div class="card mb-3" style="border-radius: 18px; padding: 1rem; border-left: 4px solid var(--secondary); background: var(--card);">
            <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <span style="font-size: 1.6rem;">🌸</span>
              <div>
                <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 2px;">ঘুম ও মনের প্রশান্তি</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.45; margin: 0;">পর্যাপ্ত ঘুমের দিনে তোমার মেজাজ সাধারণত বেশ শান্ত ও সুন্দর থাকে। সুস্থ মানসিক অবস্থার জন্য এটি খুব উপকারী।</p>
              </div>
            </div>
          </div>
        `);
      }
    }

    // C. লক্ষণ বনাম সাইকেলের পর্যায় (Symptoms vs Cycle Phase)
    const logsWithSymptoms = deepLogs.filter(l => {
      const s = l.data?.symptoms;
      return Array.isArray(s) && s.length > 0 && s.some(sym => typeof sym === 'string' && sym.trim() && !sym.includes('কোনো সমস্যা নেই'));
    });
    if (logsWithSymptoms.length >= 3) {
      const phaseSymptoms = {};
      logsWithSymptoms.forEach(l => {
        const dStr = l.date;
        const phaseName = this.calculatePhaseForDate(dStr);
        if (phaseName) {
          if (!phaseSymptoms[phaseName]) phaseSymptoms[phaseName] = {};
          l.data.symptoms.forEach(s => {
            if (typeof s === 'string' && s.trim() && !s.includes('কোনো সমস্যা নেই')) {
              const cleanS = s.trim();
              phaseSymptoms[phaseName][cleanS] = (phaseSymptoms[phaseName][cleanS] || 0) + 1;
            }
          });
        }
      });

      let topPhase = null, topSymp = null, maxCount = 0;
      Object.keys(phaseSymptoms).forEach(ph => {
        Object.keys(phaseSymptoms[ph]).forEach(s => {
          if (phaseSymptoms[ph][s] > maxCount) {
            maxCount = phaseSymptoms[ph][s];
            topPhase = ph;
            topSymp = s;
          }
        });
      });

      if (maxCount >= 2 && topPhase && topSymp) {
        cards.push(`
          <div class="card mb-3" style="border-radius: 18px; padding: 1rem; border-left: 4px solid #AB47BC; background: var(--card);">
            <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <span style="font-size: 1.6rem;">🔍</span>
              <div>
                <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 2px;">লক্ষণ ও সাইকেল পর্যায়</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.45; margin: 0;">তোমার ${topPhase}-এ '${escapeHTML(topSymp)}' লক্ষণটি একটু বেশি দেখা গেছে (${toBanglaNumber(maxCount)} বার)। এই সময়ে হালকা বিশ্রাম ও যত্ন তোমাকে স্বস্তি দেবে।</p>
              </div>
            </div>
          </div>
        `);
      }
    }

    // D. PMS-like patterns (PMS প্যাটার্ন)
    const periods = STATE.periods || [];
    if (periods.length > 0 && deepLogs.length >= 3) {
      let pmsCount = 0;
      const pmsKeywords = ['মাথাব্যথা', 'পেট ফোলা', 'পিঠে ব্যথা', 'ব্যথা', 'ক্লান্তি', 'খাবারের ইচ্ছা'];
      const pmsShiftKeywords = ['বিরক্ত', 'কষ্টে', 'উদ্বিগ্ন', 'হতাশ'];

      periods.forEach(p => {
        const start = parseLocalDate(p.startDate || p.start);
        if (start && !isNaN(start.getTime())) {
          for (let daysBefore = 1; daysBefore <= 5; daysBefore++) {
            const checkD = addDays(start, -daysBefore);
            const checkDStr = getLocalDateString(checkD);
            const checkLog = logs[checkDStr];
            if (checkLog) {
              const hasPmsSymp = Array.isArray(checkLog.symptoms) && checkLog.symptoms.some(s => typeof s === 'string' && pmsKeywords.some(kw => s.includes(kw)));
              const hasPmsMood = typeof checkLog.mood === 'string' && pmsShiftKeywords.some(kw => checkLog.mood.includes(kw));
              if (hasPmsSymp || hasPmsMood) {
                pmsCount++;
                break;
              }
            }
          }
        }
      });

      if (pmsCount >= 2) {
        cards.push(`
          <div class="card mb-3" style="border-radius: 18px; padding: 1rem; border-left: 4px solid #FF80AB; background: var(--card);">
            <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <span style="font-size: 1.6rem;">🌸</span>
              <div>
                <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 2px;">পিএমএস (PMS) প্যাটার্ন</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.45; margin: 0;">পিরিয়ড শুরুর আগের দিনগুলোতে মৃদু অস্বস্তি বা মেজাজে পরিবর্তনের লক্ষণ দেখা গেছে। উষ্ণ তরল পান ও হালকা স্ট্রেচিং অনেক আরাম দেবে।</p>
              </div>
            </div>
          </div>
        `);
      }
    }

    // E. Mood patterns (মেজাজের ধরন প্যাটার্ন)
    const moodLogs = deepLogs.filter(l => typeof l.data?.mood === 'string' && l.data.mood.trim().length > 0);
    if (moodLogs.length >= 3) {
      let positiveCount = 0;
      let stressCount = 0;

      moodLogs.forEach(l => {
        const m = l.data.mood;
        if (m.includes('ভালো') || m.includes('প্রেমময়')) positiveCount++;
        else if (m.includes('বিরক্ত') || m.includes('কষ্টে') || m.includes('উদ্বিগ্ন') || m.includes('হতাশ')) stressCount++;
      });

      const total = moodLogs.length;
      if (positiveCount / total >= 0.5) {
        cards.push(`
          <div class="card mb-3" style="border-radius: 18px; padding: 1rem; border-left: 4px solid #66BB6A; background: var(--card);">
            <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <span style="font-size: 1.6rem;">😊</span>
              <div>
                <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 2px;">মেজাজের সাধারণ ধারা</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.45; margin: 0;">গত দিনগুলোতে তোমার মেজাজ সাধারণত ইতিবাচক ও ভালো ছিল। মন শান্ত ও প্রফুল্ল রাখার এই ধারা ধরে রাখো।</p>
              </div>
            </div>
          </div>
        `);
      } else if (stressCount / total >= 0.4) {
        cards.push(`
          <div class="card mb-3" style="border-radius: 18px; padding: 1rem; border-left: 4px solid #FFA726; background: var(--card);">
            <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <span style="font-size: 1.6rem;">🧘‍♀️</span>
              <div>
                <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 2px;">মানসিক যত্ন ও বিশ্রাম</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.45; margin: 0;">কিছুদিন ধরে কিছুটা মানসিক চাপ বা বিরক্তির অনুভূতি একটু বেশি দেখা যাচ্ছে। নিজের জন্য কিছুটা নির্ভার সময় রাখলে মন ভালো থাকবে।</p>
              </div>
            </div>
          </div>
        `);
      }
    }

    if (cards.length === 0) {
      container.innerHTML = `
        <div class="empty-insight-state">
          <span class="text-3xl mb-2">🌸</span>
          <p class="text-muted text-sm text-center">
            🌸 এই বিশ্লেষণটা দেখানোর জন্য আরও কিছুদিনের তথ্য দরকার।
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = cards.join('');
  },

  renderCycleChart(data) {
    this.destroyChart('chart-cycle');
    const viewEl = document.getElementById('view-chart-cycle');
    const emptyEl = document.getElementById('empty-chart-cycle');

    const validData = (data || []).filter(v => typeof v === 'number' && !isNaN(v) && v > 0).slice(-6);

    if (!validData || validData.length < 2) {
      if (viewEl) viewEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }
    if (viewEl) viewEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    const ctx = document.getElementById('chart-cycle-history')?.getContext('2d');
    if (!ctx) return;
    const labels = validData.map((_, i) => `${toBanglaNumber(i + 1)}ম সাইকেল`);

    this.safeCreateChart('chart-cycle', ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'সাইকেল দৈর্ঘ্য (দিন)',
          data: validData,
          borderColor: this.getThemeColor('--primary'),
          backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: this.getThemeColor('--primary'),
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` দৈর্ঘ্য: ${toBanglaNumber(context.raw)} দিন`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            min: Math.max(15, Math.min(...validData) - 3),
            max: Math.max(...validData) + 3,
            ticks: { callback: v => toBanglaNumber(v) }
          }
        }
      }
    });
  },

  renderPeriodChart(data) {
    this.destroyChart('chart-period');
    const viewEl = document.getElementById('view-chart-period');
    const emptyEl = document.getElementById('empty-chart-period');

    const validData = (data || []).filter(v => typeof v === 'number' && !isNaN(v) && v > 0).slice(-6);

    if (!validData || validData.length < 2) {
      if (viewEl) viewEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }
    if (viewEl) viewEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    const ctx = document.getElementById('chart-period-history')?.getContext('2d');
    if (!ctx) return;
    const labels = validData.map((_, i) => `${toBanglaNumber(i + 1)}ম পিরিয়ড`);

    this.safeCreateChart('chart-period', ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'স্থায়িত্ব (দিন)',
          data: validData,
          backgroundColor: this.getThemeColor('--secondary'),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` স্থায়িত্ব: ${toBanglaNumber(context.raw)} দিন`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: Math.max(10, Math.max(...validData) + 2),
            ticks: { callback: v => toBanglaNumber(v) }
          }
        }
      }
    });
  },

  renderSymptomChart(logs) {
    this.destroyChart('chart-symptom');
    const viewEl = document.getElementById('view-chart-symptom');
    const emptyEl = document.getElementById('empty-chart-symptom');

    const counts = {};
    Object.values(logs || {}).forEach(l => {
      if (l.symptoms && Array.isArray(l.symptoms)) {
        l.symptoms.forEach(s => {
          if (typeof s === 'string' && s.trim() && !s.includes('কোনো সমস্যা নেই')) {
            const key = s.trim();
            counts[key] = (counts[key] || 0) + 1;
          }
        });
      }
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sorted.length === 0) {
      if (viewEl) viewEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }
    if (viewEl) viewEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    const ctx = document.getElementById('chart-symptom-freq')?.getContext('2d');
    if (!ctx) return;

    this.safeCreateChart('chart-symptom', ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(k => `${k[0]} (${toBanglaNumber(k[1])})`),
        datasets: [{
          data: sorted.map(k => k[1]),
          backgroundColor: this.getThemeColor('--primary'),
          borderRadius: 6,
          barThickness: 16
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` উপস্থিতি: ${toBanglaNumber(context.raw)} বার`
            }
          }
        },
        scales: {
          x: {
            display: false,
            beginAtZero: true,
            ticks: { callback: v => toBanglaNumber(v) }
          },
          y: { border: { display: false }, grid: { display: false } }
        }
      }
    });
  },

  renderMoodChart(logs) {
    this.destroyChart('chart-mood');
    const viewEl = document.getElementById('view-chart-mood');
    const emptyEl = document.getElementById('empty-chart-mood');

    const counts = {};
    Object.values(logs || {}).forEach(l => {
      if (l.mood && typeof l.mood === 'string' && l.mood.trim()) {
        const key = l.mood.trim();
        counts[key] = (counts[key] || 0) + 1;
      }
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
      if (viewEl) viewEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }
    if (viewEl) viewEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    const ctx = document.getElementById('chart-mood-dist')?.getContext('2d');
    if (!ctx) return;

    const moodColors = {
      '😊 ভালো': '#81C784',
      '😐 স্বাভাবিক': '#B0BEC5',
      '😢 কষ্টে': '#64B5F6',
      '😠 বিরক্ত': '#FF8A65',
      '😰 উদ্বিগ্ন': '#BA68C8',
      '🥰 প্রেমময়': '#F06292',
      '😤 হতাশ': '#E57373',
      '😴 ঘুমঘুম': '#90A4AE'
    };

    const totalMoods = sorted.reduce((sum, item) => sum + item[1], 0);

    this.safeCreateChart('chart-mood', ctx, {
      type: 'doughnut',
      data: {
        labels: sorted.map(k => k[0]),
        datasets: [{
          data: sorted.map(k => k[1]),
          backgroundColor: sorted.map(k => moodColors[k[0]] || 'var(--primary)'),
          borderWidth: 2,
          borderColor: this.getThemeColor('--card'),
          cutout: '70%'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 12, usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: (context) => {
                const val = context.raw;
                const pct = totalMoods > 0 ? Math.round((val / totalMoods) * 100) : 0;
                return ` ${toBanglaNumber(val)} বার (${toBanglaNumber(pct)}%)`;
              }
            }
          }
        }
      }
    });
  },

  renderAnalyticsMoodTimeline(logs) {
    const container = document.getElementById('analytics-mood-timeline');
    if (!container) return;

    // Filter dates with mood or notes, sorted in chronological order (newest first!)
    const logDates = Object.keys(logs || {})
      .filter(d => logs[d]?.mood || logs[d]?.notes)
      .sort()
      .reverse()
      .slice(0, 15);

    if (logDates.length === 0) {
      container.innerHTML = `<p class="text-muted text-sm text-center w-full py-3">🌸 লগ করার পর মেজাজের সময়রেখা এখানে দেখাবে।</p>`;
      return;
    }

    const phaseColors = {
      'মাসিকের সময়': 'var(--primary)',
      'ফলিকুলার পর্যায়': 'var(--secondary)',
      'ডিম্বস্ফোটনের সময়': 'var(--accent)',
      'লুটিয়াল পর্যায়': '#D89A00'
    };

    let html = '';
    logDates.forEach(dStr => {
      const entry = logs[dStr] || {};
      const moodVal = entry.mood || '';
      const emoji = moodVal ? moodVal.split(' ')[0] : '📝';
      const moodText = moodVal ? moodVal.substring(emoji.length).trim() : 'নোট সংরক্ষিত';
      const label = formatBanglaDate(parseLocalDate(dStr));
      const phaseName = this.calculatePhaseForDate(dStr);
      const notePreview = entry.notes ? entry.notes.trim() : '';

      let phaseBadgeHtml = '';
      if (phaseName) {
        const pColor = phaseColors[phaseName] || 'var(--primary)';
        phaseBadgeHtml = `<span style="background: color-mix(in srgb, ${pColor} 12%, transparent); color: ${pColor}; border: 1px solid color-mix(in srgb, ${pColor} 25%, transparent); padding: 2px 8px; border-radius: 12px; font-size: 0.72rem; font-weight: 600;">${phaseName}</span>`;
      }

      html += `
        <div style="background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 12px 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-weight: 600; font-size: 0.88rem; color: var(--text-main);">${label}</span>
            ${phaseBadgeHtml}
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.4rem;">${emoji}</span>
            <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-main);">${escapeHTML(moodText)}</span>
          </div>
          ${notePreview ? `<p style="margin: 8px 0 0 0; font-size: 0.82rem; color: var(--text-muted); font-style: italic; background: color-mix(in srgb, var(--primary) 4%, transparent); padding: 6px 10px; border-radius: 8px; line-height: 1.4;">“${escapeHTML(notePreview)}”</p>` : ''}
        </div>
      `;
    });

    container.innerHTML = html;
  },

  // ==========================================
  // 10. SETTINGS VIEW (CANONICAL)
  // ==========================================
  onSettingsAgeInput(val) {
    const ageDisplayEl = document.getElementById('settings-age-display');
    const num = parseInt(val, 10);
    if (ageDisplayEl) {
      ageDisplayEl.innerText = (!isNaN(num) && num >= 10 && num <= 65) ? `${toBanglaNumber(num)} বছর` : '';
    }
  },

  onSettingsCycleChange(val) {
    const cycleDisplayEl = document.getElementById('settings-cycle-display');
    const num = parseInt(val, 10);
    if (cycleDisplayEl) {
      cycleDisplayEl.innerText = `${toBanglaNumber(num)} দিন`;
    }
  },

  onSettingsPeriodChange(val) {
    const periodDisplayEl = document.getElementById('settings-period-display');
    const num = parseInt(val, 10);
    if (periodDisplayEl) {
      periodDisplayEl.innerText = `${toBanglaNumber(num)} দিন`;
    }
  },

  saveSettingsProfile() {
    if (!STATE.profile) {
      STATE.profile = {
        name: 'ব্যবহারকারী',
        age: null,
        cycleLength: 28,
        periodLength: 5,
        lastPeriodStart: getLocalDateString(new Date()),
        setupDone: true
      };
    }
    const nameEl = document.getElementById('settings-name');
    const ageEl = document.getElementById('settings-age');
    const cycleEl = document.getElementById('settings-cycle-length');
    const periodEl = document.getElementById('settings-period-length');
    if (!nameEl && !ageEl && !cycleEl && !periodEl) return;

    const newName = nameEl?.value ?? '';
    const newAgeVal = ageEl?.value;
    const newAgeNum = parseInt(newAgeVal, 10);
    const newCycleNum = parseInt(cycleEl?.value, 10);
    const newPeriodNum = parseInt(periodEl?.value, 10);

    STATE.profile.name = newName.trim() || 'ব্যবহারকারী';
    STATE.profile.age = !isNaN(newAgeNum) && newAgeNum >= 10 && newAgeNum <= 65 ? newAgeNum : null;
    if (!isNaN(newCycleNum) && newCycleNum >= 21 && newCycleNum <= 45) {
      STATE.profile.cycleLength = newCycleNum;
    }
    if (!isNaN(newPeriodNum) && newPeriodNum >= 2 && newPeriodNum <= 10) {
      STATE.profile.periodLength = newPeriodNum;
    }

    STATE.profile = this.validate('profile', STATE.profile);
    this.saveData('fz_profile', STATE.profile);

    // Invalidate prediction cache so shared Prediction Engine automatically recomputes
    this.predictions = null;
    this.calculatePredictions(true);

    this.renderHome();
    this.renderCalendar();
    this.renderSettings();
    this.showToast('✅ প্রোফাইল তথ্য আপডেট হয়েছে');
  },

  flushSettingsIfDirty() {
    if (!STATE.profile) return;
    const nameEl = document.getElementById('settings-name');
    const ageEl = document.getElementById('settings-age');
    const cycleEl = document.getElementById('settings-cycle-length');
    const periodEl = document.getElementById('settings-period-length');
    if (!nameEl && !ageEl && !cycleEl && !periodEl) return;

    const newName = nameEl?.value?.trim() || 'ব্যবহারকারী';
    const ageVal = ageEl?.value;
    const newAgeNum = parseInt(ageVal, 10);
    const validAge = !isNaN(newAgeNum) && newAgeNum >= 10 && newAgeNum <= 65 ? newAgeNum : null;
    const newCycleNum = parseInt(cycleEl?.value, 10);
    const validCycle = !isNaN(newCycleNum) && newCycleNum >= 21 && newCycleNum <= 45 ? newCycleNum : (STATE.profile.cycleLength || 28);
    const newPeriodNum = parseInt(periodEl?.value, 10);
    const validPeriod = !isNaN(newPeriodNum) && newPeriodNum >= 2 && newPeriodNum <= 10 ? newPeriodNum : (STATE.profile.periodLength || 5);

    if (newName !== STATE.profile.name || validAge !== STATE.profile.age || validCycle !== STATE.profile.cycleLength || validPeriod !== STATE.profile.periodLength) {
      this.saveSettingsProfile();
    }
  },

  renderSettings() {
    if (STATE.profile) {
      const nameEl = document.getElementById('settings-name');
      if (nameEl) nameEl.value = STATE.profile.name || '';

      const ageEl = document.getElementById('settings-age');
      if (ageEl) ageEl.value = STATE.profile.age != null ? STATE.profile.age : '';
      const ageDisplayEl = document.getElementById('settings-age-display');
      if (ageDisplayEl) {
        ageDisplayEl.innerText = STATE.profile.age != null ? `${toBanglaNumber(STATE.profile.age)} বছর` : '';
      }

      const cycleEl = document.getElementById('settings-cycle-length');
      const currentCycle = STATE.profile.cycleLength || 28;
      if (cycleEl) cycleEl.value = currentCycle;
      const cycleDisplayEl = document.getElementById('settings-cycle-display');
      if (cycleDisplayEl) {
        cycleDisplayEl.innerText = `${toBanglaNumber(currentCycle)} দিন`;
      }

      const periodEl = document.getElementById('settings-period-length');
      const currentPeriod = STATE.profile.periodLength || 5;
      if (periodEl) periodEl.value = currentPeriod;
      const periodDisplayEl = document.getElementById('settings-period-display');
      if (periodDisplayEl) {
        periodDisplayEl.innerText = `${toBanglaNumber(currentPeriod)} দিন`;
      }
    }

    const currentMode = STATE.settings?.displayMode || 'light';
    const currentTheme = STATE.settings?.colorTheme || STATE.settings?.theme || 'rose-bloom';

    ['light', 'dark', 'amoled'].forEach(m => {
      const btn = document.getElementById(`mode-btn-${m}`);
      if (btn) {
        if (m === currentMode) {
          btn.style.borderColor = 'var(--primary)';
          btn.style.background = 'color-mix(in srgb, var(--primary) 12%, transparent)';
          btn.style.color = 'var(--primary)';
          btn.style.fontWeight = '700';
        } else {
          btn.style.borderColor = 'var(--border)';
          btn.style.background = 'var(--card)';
          btn.style.color = 'var(--text-main)';
          btn.style.fontWeight = '500';
        }
      }
    });

    ['rose-bloom', 'lavender-dream', 'peach-glow', 'night-bloom'].forEach(t => {
      const card = document.getElementById(`theme-card-${t}`);
      if (card) {
        if (t === currentTheme) {
          card.style.borderColor = 'var(--primary)';
          card.style.background = 'color-mix(in srgb, var(--primary) 8%, transparent)';
        } else {
          card.style.borderColor = 'transparent';
          card.style.background = 'rgba(0,0,0,0.02)';
        }
      }
    });

    // Accessibility toggles
    const accPrefs = STATE.settings?.accessibilityPreferences || STATE.settings?.accessibility || {};
    const largeTextToggle = document.getElementById('large-text-toggle');
    if (largeTextToggle) {
      largeTextToggle.classList.toggle('active', Boolean(accPrefs.largeText));
    }
    const highContrastToggle = document.getElementById('high-contrast-toggle');
    if (highContrastToggle) {
      highContrastToggle.classList.toggle('active', Boolean(accPrefs.highContrast));
    }
    const reducedMotionToggle = document.getElementById('reduced-motion-toggle');
    if (reducedMotionToggle) {
      reducedMotionToggle.classList.toggle('active', Boolean(accPrefs.reducedMotion));
    }

    const pinToggle = document.getElementById('pin-toggle');
    const changePinWrapper = document.getElementById('change-pin-wrapper');
    if (pinToggle) {
      if (STATE.settings?.pinEnabled) {
        pinToggle.classList.add('active');
        if (changePinWrapper) changePinWrapper.classList.remove('hidden');
      } else {
        pinToggle.classList.remove('active');
        if (changePinWrapper) changePinWrapper.classList.add('hidden');
      }
    }

    const reminderToggle = document.getElementById('reminder-toggle');
    const reminderTimeWrapper = document.getElementById('reminder-time-wrapper');
    const reminderTimeInput = document.getElementById('reminder-time');
    const reminderStatusMsg = document.getElementById('reminder-status-msg');

    if (reminderToggle) {
      if (STATE.settings?.remindersEnabled) {
        reminderToggle.classList.add('active');
        if (reminderTimeWrapper) reminderTimeWrapper.classList.remove('hidden');
      } else {
        reminderToggle.classList.remove('active');
        if (reminderTimeWrapper) reminderTimeWrapper.classList.add('hidden');
      }
    }

    if (reminderTimeInput && STATE.settings?.reminderTime) {
      reminderTimeInput.value = STATE.settings.reminderTime;
    }

    // Render reminder type chips
    const prefs = STATE.settings?.notificationPreferences || {};
    document.querySelectorAll('#reminder-types-group .chip-item').forEach(chip => {
      const type = chip.dataset.type;
      if (type && prefs[type] !== false) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    // Render honest capability and permission status message
    if (reminderStatusMsg) {
      const caps = this.getNotificationCapabilities();
      if (!STATE.settings?.remindersEnabled) {
        reminderStatusMsg.innerText = 'রিমাইন্ডার বন্ধ আছে।';
      } else if (!caps.hasNotificationAPI || caps.permission === 'unsupported') {
        reminderStatusMsg.innerText = '🌸 এই ডিভাইসে ব্রাউজার নোটিফিকেশন সীমাবদ্ধ; প্রতিদিন অ্যাপ ওপেন করলেই ইন-অ্যাপ রিমাইন্ডার দেখতে পাবেন।';
      } else if (caps.permission === 'denied') {
        reminderStatusMsg.innerText = '⚠️ ব্রাউজারে নোটিফিকেশন পারমিশন বন্ধ আছে। অ্যাপ খুললেই ইন-অ্যাপ রিমাইন্ডার দেখতে পাবেন 🌸';
      } else if (caps.permission === 'granted') {
        if (caps.backgroundDeliverySupported) {
          reminderStatusMsg.innerText = '🌸 নোটিফিকেশন সক্রিয় আছে (সার্ভিস ওয়ার্কারের মাধ্যমে)।';
        } else if (caps.isWebView) {
          reminderStatusMsg.innerText = '🌸 ওয়েবভিউ মোডে অ্যাপ খুললে রিমাইন্ডার প্রদর্শিত হবে।';
        } else {
          reminderStatusMsg.innerText = '🌸 নোটিফিকেশন অনুমতি সক্রিয়। ব্রাউজার বন্ধ থাকলে অ্যাপে প্রবেশ করলেই রিমাইন্ডার দেখতে পাবেন।';
        }
      } else {
        reminderStatusMsg.innerText = '🌸 নির্দিষ্ট সময়ে নোটিফিকেশন পেতে অনুমতি দিন।';
      }
    }
  },

  // ==========================================
  // 11. SECURITY & PIN LOCK SYSTEM
  // ==========================================
  pinMode: null,
  currentPin: '',
  tempPin: '',

  showLockScreen(mode) {
    this.pinMode = mode;
    this.currentPin = '';
    this.updatePinUI();
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('view-onboarding').classList.add('hidden');
    document.getElementById('screen-lock').classList.remove('hidden');

    const title = document.getElementById('lock-title');
    const cancelBtn = document.getElementById('cancel-pin-btn');

    if (mode === 'verify') {
      title.innerText = 'আপনার পিন দিন';
      cancelBtn.style.visibility = 'hidden';
    } else if (mode === 'setup_new' || mode === 'change_new') {
      title.innerText = 'নতুন পিন সেট করুন';
      cancelBtn.style.visibility = 'visible';
    } else if (mode === 'setup_confirm' || mode === 'change_confirm') {
      title.innerText = 'পিনটি আবার দিন';
      cancelBtn.style.visibility = 'visible';
    } else if (mode === 'remove_verify' || mode === 'change_verify') {
      title.innerText = 'বর্তমান পিন দিন';
      cancelBtn.style.visibility = 'visible';
    }
  },

  hideLockScreen() {
    this.currentPin = '';
    this.tempPin = '';
    this.pinMode = null;
    this.updatePinUI();
    document.getElementById('screen-lock').classList.add('hidden');
  },

  enterPinDigit(digit) {
    if (this.currentPin.length < 4) {
      this.currentPin += digit;
      this.updatePinUI();
      this.safeVibrate(20);
      if (this.currentPin.length === 4) {
        setTimeout(() => this.processCompletePin(), 120);
      }
    }
  },

  removePinDigit() {
    if (this.currentPin.length > 0) {
      this.currentPin = this.currentPin.slice(0, -1);
      this.updatePinUI();
      this.safeVibrate(15);
    }
  },

  updatePinUI() {
    const dots = document.getElementById('pin-dots')?.children;
    if (!dots) return;
    for (let i = 0; i < 4; i++) {
      if (i < this.currentPin.length) dots[i].classList.add('filled');
      else dots[i].classList.remove('filled');
    }
  },

  shakePin() {
    const dotsContainer = document.getElementById('pin-dots');
    if (!dotsContainer) return;
    dotsContainer.classList.add('shake');
    this.safeVibrate([50, 50, 50]);
    setTimeout(() => {
      dotsContainer.classList.remove('shake');
      this.currentPin = '';
      this.updatePinUI();
    }, 400);
  },

  processCompletePin() {
    const mode = this.pinMode;
    const val = this.currentPin;

    if (mode === 'verify') {
      if (val === STATE.settings.pin) {
        sessionStorage.setItem('fz_unlocked', '1');
        this.hideLockScreen();
        this.bootMainApp();
      } else {
        this.shakePin();
      }
    } else if (mode === 'setup_new' || mode === 'change_new') {
      this.tempPin = val;
      this.showLockScreen(mode === 'setup_new' ? 'setup_confirm' : 'change_confirm');
    } else if (mode === 'setup_confirm' || mode === 'change_confirm') {
      if (val === this.tempPin) {
        STATE.settings.pin = val;
        STATE.settings.pinEnabled = true;
        STATE.settings = this.validate('settings', STATE.settings);
        this.saveData('fz_settings', STATE.settings);
        sessionStorage.setItem('fz_unlocked', '1');
        this.hideLockScreen();
        this.bootMainApp();
        this.renderSettings();
        this.showToast('✅ পিন সফলভাবে সেট হয়েছে');
      } else {
        this.showToast('⚠️ পিন মেলেনি, আবার চেষ্টা করুন');
        this.shakePin();
        setTimeout(() => {
          this.showLockScreen(mode === 'setup_confirm' ? 'setup_new' : 'change_new');
        }, 400);
      }
    } else if (mode === 'remove_verify') {
      if (val === STATE.settings.pin) {
        STATE.settings.pinEnabled = false;
        STATE.settings.pin = null;
        STATE.settings = this.validate('settings', STATE.settings);
        this.saveData('fz_settings', STATE.settings);
        this.hideLockScreen();
        this.bootMainApp();
        this.renderSettings();
        this.showToast('✅ পিন লক বন্ধ করা হয়েছে');
      } else {
        this.shakePin();
      }
    } else if (mode === 'change_verify') {
      if (val === STATE.settings.pin) {
        this.showLockScreen('change_new');
      } else {
        this.shakePin();
      }
    }
  },

  cancelPinSetup() {
    this.hideLockScreen();
    this.bootMainApp();
    this.renderSettings();
  },

  togglePinSettings() {
    if (!STATE.settings) STATE.settings = {};
    if (STATE.settings.pinEnabled) {
      this.confirmAction('remove_pin_init');
    } else {
      this.showLockScreen('setup_new');
    }
  },

  startChangePin() {
    this.showLockScreen('change_verify');
  },

  // ==========================================
  // 12. WELLNESS & EDUCATION (INTERNAL)
  // ==========================================
  openWellness() {
    const p = this.calculatePredictions();
    const phaseName = p?.phaseName || "মাসিকের সময়";
    let contentHtml = "";

    if (phaseName === "মাসিকের সময়") {
      contentHtml = `
        <div class="card mb-3" style="border-left: 4px solid var(--primary)">
          <h4 class="mb-1">🍎 খাবারদাবার</h4>
          <p class="text-sm text-muted">আয়রনযুক্ত খাবার (কলিজা, ডাল, শাকসবজি) এবং লেবু জাতীয় ভিটামিন সি বেশি খেলে ক্লান্তি কমে।</p>
        </div>
        <div class="card mb-3" style="border-left: 4px solid var(--secondary)">
          <h4 class="mb-1">💧 পানি ও হাইড্রেশন</h4>
          <p class="text-sm text-muted">কুসুম গরম পানি খেলে পেট ফাঁপা বা ক্র্যাম্প কমতে সাহায্য করে।</p>
        </div>
        <div class="card mb-3" style="border-left: 4px solid var(--accent)">
          <h4 class="mb-1">🧘‍♀️ হালকা মুভমেন্ট</h4>
          <p class="text-sm text-muted">হালকা হাঁটা বা সাধারণ স্ট্রেচিং রক্ত সঞ্চালন ভালো রাখে। ভারী কাজ এড়িয়ে চলো।</p>
        </div>
      `;
    } else if (phaseName === "ফলিকুলার পর্যায়") {
      contentHtml = `
        <div class="card mb-3" style="border-left: 4px solid var(--primary)">
          <h4 class="mb-1">🍎 পুষ্টিকর খাবার</h4>
          <p class="text-sm text-muted">তাজা ফলমূল ও প্রোটিন শরীরে নতুন এনার্জি জোগাতে সাহায্য করবে।</p>
        </div>
        <div class="card mb-3" style="border-left: 4px solid var(--secondary)">
          <h4 class="mb-1">🏃‍♀️ শরীরচর্চা</h4>
          <p class="text-sm text-muted">এনার্জি এখন ঊর্ধ্বমুখী! নিয়মিত ব্যায়াম বা হাঁটা শুরু করার আদর্শ সময়।</p>
        </div>
      `;
    } else if (phaseName === "ডিম্বস্ফোটনের সময়") {
      contentHtml = `
        <div class="card mb-3" style="border-left: 4px solid var(--primary)">
          <h4 class="mb-1">🌟 এনার্জি ও পুষ্টি</h4>
          <p class="text-sm text-muted">শরীর ঠান্ডা রাখে এমন ফল ও সালাদ খাও। পানি প্রচুর পরিমাণে পান করো।</p>
        </div>
        <div class="card mb-3" style="border-left: 4px solid var(--accent)">
          <h4 class="mb-1">💪 সক্রিয় থাকা</h4>
          <p class="text-sm text-muted">কনফিডেন্স ও কাজের উদ্দীপনা এখন তুঙ্গে! যেকোনো গুরুত্বপূর্ণ কাজ শুরু করতে পারো।</p>
        </div>
      `;
    } else {
      contentHtml = `
        <div class="card mb-3" style="border-left: 4px solid var(--primary)">
          <h4 class="mb-1">🍵 আরামদায়ক খাবার</h4>
          <p class="text-sm text-muted">আদা চা বা হালকা খাবার পেটের অস্বস্তি কমাতে সাহায্য করবে।</p>
        </div>
        <div class="card mb-3" style="border-left: 4px solid var(--secondary)">
          <h4 class="mb-1">🌙 মানসিক প্রশান্তি</h4>
          <p class="text-sm text-muted">মেজাজের কিছুটা পরিবর্তন হতে পারে। পছন্দের সঙ্গীত শুনুন ও রিল্যাক্স করুন।</p>
        </div>
      `;
    }

    const dynEl = document.getElementById('wellness-dynamic-content');
    if (dynEl) dynEl.innerHTML = contentHtml;

    const sheet = document.getElementById('wellness-sheet');
    if (sheet) sheet.classList.remove('hidden');
  },

  closeWellness(e) {
    if (e && e.target !== document.getElementById('wellness-sheet') && !e.target.classList.contains('btn-icon') && !e.target.classList.contains('sheet-handle')) return;
    const sheet = document.getElementById('wellness-sheet');
    if (sheet) sheet.classList.add('hidden');
    setTimeout(() => this.showAllEducation(), 300);
  },

  toggleBookmark(tipId, event) {
    if (event) event.stopPropagation();
    if (!STATE.bookmarks) STATE.bookmarks = {};
    if (STATE.bookmarks[tipId]) {
      delete STATE.bookmarks[tipId];
      if (event.target) {
        event.target.innerText = '☆';
        event.target.style.color = 'var(--text-muted)';
        event.target.classList.remove('bookmarked');
      }
    } else {
      STATE.bookmarks[tipId] = true;
      if (event.target) {
        event.target.innerText = '★';
        event.target.style.color = 'var(--primary)';
        event.target.classList.add('bookmarked');
      }
    }
    this.saveData('fz_bookmarks', STATE.bookmarks);
    this.showToast(STATE.bookmarks[tipId] ? 'বুকমার্ক সংরক্ষিত হয়েছে' : 'বুকমার্ক সরানো হয়েছে');
  },

  showBookmarkedTips() {
    const articles = document.querySelectorAll('#education-articles .accordion-item');
    let count = 0;
    articles.forEach(article => {
      const icon = article.querySelector('.bookmark-icon');
      const tipId = icon?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
      if (STATE.bookmarks && tipId && STATE.bookmarks[tipId]) {
        article.style.display = 'block';
        count++;
      } else {
        article.style.display = 'none';
      }
    });

    const emptyState = document.getElementById('education-empty-state');
    const listEl = document.getElementById('education-articles');
    if (count === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (listEl) listEl.style.display = 'none';
    } else {
      if (emptyState) emptyState.classList.add('hidden');
      if (listEl) listEl.style.display = 'block';
    }
  },

  showAllEducation() {
    document.querySelectorAll('#education-articles .accordion-item').forEach(a => a.style.display = 'block');
    const emptyState = document.getElementById('education-empty-state');
    if (emptyState) emptyState.classList.add('hidden');
    const listEl = document.getElementById('education-articles');
    if (listEl) listEl.style.display = 'block';
  },

  loadBookmarks() {
    STATE.bookmarks = this.safeGetStorage('fz_bookmarks', '{}');
    document.querySelectorAll('#education-articles .accordion-item').forEach(article => {
      const icon = article.querySelector('.bookmark-icon');
      const tipId = icon?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
      if (tipId && STATE.bookmarks[tipId]) {
        icon.innerText = '★';
        icon.style.color = 'var(--primary)';
        icon.classList.add('bookmarked');
      }
    });
  },

  // ==========================================
  // 13. REMINDER & NOTIFICATION SYSTEM (CANONICAL)
  // ==========================================
  getNotificationCapabilities() {
    const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /android/.test(ua);
    const isWebView = /wv|webview/.test(ua) || (isAndroid && /version\/[\d.]+/i.test(ua));

    const isStandalone = typeof window !== 'undefined' && Boolean(
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.navigator?.standalone === true ||
      document.referrer?.includes('android-app://')
    );

    const hasNotificationAPI = typeof window !== 'undefined' && 'Notification' in window;
    const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

    let permission = 'unsupported';
    if (hasNotificationAPI) {
      permission = Notification.permission || 'default'; // 'default' | 'granted' | 'denied'
    }

    // True background delivery capability:
    // Standalone Android PWA with active SW notification capability can receive SW notifications.
    // Standard web browser tabs, iOS Web, and Android WebViews without native push bridges
    // cannot guarantee timers when the app is suspended/closed.
    const backgroundDeliverySupported = Boolean(!isWebView && !isIOS && isStandalone && hasServiceWorker && hasNotificationAPI);

    return {
      isIOS,
      isAndroid,
      isWebView,
      isStandalone,
      hasNotificationAPI,
      hasServiceWorker,
      permission,
      backgroundDeliverySupported
    };
  },

  toggleReminder() {
    if (!STATE.settings) STATE.settings = {};
    const enabled = !STATE.settings.remindersEnabled;
    const caps = this.getNotificationCapabilities();

    if (enabled) {
      if (!caps.hasNotificationAPI || caps.permission === 'unsupported') {
        // Device doesn't support Web Notifications -> Graceful in-app fallback
        STATE.settings.remindersEnabled = true;
        if (!STATE.settings.reminderTime) STATE.settings.reminderTime = "08:00";
        this.saveSettingsNotificationState();
        this.renderSettings();
        this.showToast('🌸 ইন-অ্যাপ রিমাইন্ডার চালু হয়েছে (অ্যাপ খুললেই দেখতে পাবেন)');
        this.startReminderService();
        return;
      }

      if (caps.permission === 'denied') {
        // Do NOT repeatedly prompt if user previously denied permission
        STATE.settings.remindersEnabled = true;
        if (!STATE.settings.reminderTime) STATE.settings.reminderTime = "08:00";
        this.saveSettingsNotificationState();
        this.renderSettings();
        this.showToast('🌸 ইন-অ্যাপ রিমাইন্ডার চালু আছে (ব্রাউজার নোটিফিকেশন বন্ধ)');
        this.startReminderService();
        return;
      }

      if (caps.permission === 'granted') {
        STATE.settings.remindersEnabled = true;
        if (!STATE.settings.reminderTime) STATE.settings.reminderTime = "08:00";
        this.saveSettingsNotificationState();
        this.renderSettings();
        this.showToast('🌸 রিমাইন্ডার চালু হয়েছে');
        this.startReminderService();
        return;
      }

      // If 'default' (not yet requested), request once safely
      try {
        Notification.requestPermission().then(permission => {
          STATE.settings.remindersEnabled = true;
          if (!STATE.settings.reminderTime) STATE.settings.reminderTime = "08:00";
          this.saveSettingsNotificationState();
          this.renderSettings();
          if (permission === 'granted') {
            this.showToast('🌸 নোটিফিকেশন রিমাইন্ডার চালু হয়েছে');
          } else {
            this.showToast('🌸 ইন-অ্যাপ রিমাইন্ডার চালু থাকবে');
          }
          this.startReminderService();
        }).catch(() => {
          STATE.settings.remindersEnabled = true;
          this.saveSettingsNotificationState();
          this.renderSettings();
          this.showToast('🌸 ইন-অ্যাপ রিমাইন্ডার চালু থাকবে');
          this.startReminderService();
        });
      } catch (e) {
        STATE.settings.remindersEnabled = true;
        this.saveSettingsNotificationState();
        this.renderSettings();
        this.showToast('🌸 ইন-অ্যাপ রিমাইন্ডার চালু থাকবে');
        this.startReminderService();
      }
    } else {
      STATE.settings.remindersEnabled = false;
      this.saveSettingsNotificationState();
      this.renderSettings();
      this.showToast('রিমাইন্ডার বন্ধ করা হয়েছে');
      if (this.reminderInterval) {
        clearInterval(this.reminderInterval);
        this.reminderInterval = null;
      }
    }
  },

  toggleReminderType(type) {
    if (!STATE.settings) STATE.settings = {};
    if (!STATE.settings.notificationPreferences) {
      STATE.settings.notificationPreferences = {
        enabled: Boolean(STATE.settings.remindersEnabled),
        time: STATE.settings.reminderTime || '08:00',
        period: true,
        ovulation: true,
        selfCare: true,
        water: true
      };
    }
    STATE.settings.notificationPreferences[type] = !STATE.settings.notificationPreferences[type];
    this.saveSettingsNotificationState();
    this.renderSettings();
  },

  saveSettingsNotificationState() {
    STATE.settings = this.validate('settings', STATE.settings);
    this.saveData('fz_settings', STATE.settings);
  },

  saveReminderTime() {
    if (!STATE.settings) return;
    const t = document.getElementById('reminder-time')?.value;
    if (t) {
      STATE.settings.reminderTime = t;
      this.saveSettingsNotificationState();
      this.renderSettings();
      this.showToast('রিমাইন্ডার সময় সংরক্ষিত হয়েছে');
    }
  },

  startReminderService() {
    // Keep ONE single canonical timer for foreground checks
    if (this.reminderInterval) {
      clearInterval(this.reminderInterval);
      this.reminderInterval = null;
    }

    if (!STATE.settings?.remindersEnabled) return;

    // Check for any due reminders on app opening
    this.checkAppOpenReminders();

    // Secondary foreground check while the app remains open
    this.reminderInterval = setInterval(() => this.checkAndFireReminders(), 60000);
  },

  getApplicableReminder() {
    if (!STATE.profile || !STATE.profile.setupDone) return null;

    const prefs = STATE.settings?.notificationPreferences || {};
    const types = {
      period: prefs.period !== false,
      ovulation: prefs.ovulation !== false,
      selfCare: prefs.selfCare !== false,
      water: prefs.water !== false
    };

    const p = this.calculatePredictions();
    const now = new Date();

    // 1. Period Reminders (পিরিয়ড)
    if (types.period && p) {
      if (p.isOverdue && p.overdueDays > 0) {
        return {
          type: 'period',
          title: 'ফুলঝরি পিরিয়ড রিমাইন্ডার 🌸',
          body: `সম্ভাব্য তারিখ ${toBanglaNumber(p.overdueDays)} দিন পেরিয়ে গেছে। নতুন পিরিয়ড শুরু হলে লগ করো 🌸`
        };
      }
      if (p.nextPeriodStart) {
        const daysToPeriod = diffInDays(p.nextPeriodStart, now);
        if (daysToPeriod === 1) {
          return {
            type: 'period',
            title: 'ফুলঝরি পিরিয়ড রিমাইন্ডার 🌸',
            body: 'আগামীকাল তোমার পিরিয়ড শুরু হতে পারে 🌸 প্রয়োজনীয় প্রস্তুতি রেখো।'
          };
        }
        if (daysToPeriod === 0) {
          return {
            type: 'period',
            title: 'ফুলঝরি পিরিয়ড রিমাইন্ডার 🌸',
            body: 'আজ তোমার পিরিয়ড শুরু হতে পারে। নিজের যত্ন নিও 🌸'
          };
        }
      }
    }

    // 2. Ovulation Reminders (ডিম্বস্ফোটন)
    if (types.ovulation && p && p.ovulationDate) {
      const daysToOvulation = diffInDays(p.ovulationDate, now);
      if (daysToOvulation <= 1 && daysToOvulation >= -1) {
        return {
          type: 'ovulation',
          title: 'ডিম্বস্ফোটন রিমাইন্ডার ✨',
          body: 'তুমি এখন ডিম্বস্ফোটন (উর্বর) সময়ে আছো ✨ নিজের শরীরকে লক্ষ্য করো।'
        };
      }
    }

    // 3. Self-care Reminders (নিজের যত্ন)
    if (types.selfCare && p && p.phaseName) {
      if (p.phaseName === 'মাসিকের সময়') {
        return {
          type: 'selfCare',
          title: 'নিজের যত্ন নাও 🌙',
          body: 'মাসিকের সময়ে হালকা গরম পানি পান ও পর্যাপ্ত বিশ্রাম তোমাকে আরাম দেবে 💕'
        };
      }
      if (p.phaseName === 'লুটিয়াল পর্যায়') {
        return {
          type: 'selfCare',
          title: 'নিজের যত্ন নাও 🌿',
          body: 'লুটিয়াল ফেজ চলছে। পরিমিত ঘুম ও মানসিক প্রশান্তির প্রতি নজর দাও 🌸'
        };
      }
    }

    // 4. Water Reminders (পানি খাওয়া)
    if (types.water) {
      return {
        type: 'water',
        title: 'পানি পানের রিমাইন্ডার 💧',
        body: 'আজ পর্যাপ্ত পানি পান করেছো তো? শরীর হাইড্রেটেড রাখলে এনার্জি ভালো থাকে 💧'
      };
    }

    return {
      type: 'general',
      title: 'ফুলঝরি রিমাইন্ডার 🌸',
      body: 'আজকে কেমন আছো? তোমার দৈনিক অনুভূতি ও তথ্য লগ করতে ভুলো না 🌸'
    };
  },

  checkAppOpenReminders() {
    if (!STATE.settings?.remindersEnabled || !STATE.profile || !STATE.profile.setupDone) return;

    const now = new Date();
    const dateStr = getLocalDateString(now);
    const lastFireKey = `fz_last_reminder_${dateStr}`;

    // If today's reminder hasn't fired yet
    if (!localStorage.getItem(lastFireKey)) {
      const reminder = this.getApplicableReminder();
      if (!reminder) return;

      const caps = this.getNotificationCapabilities();
      // If system notification is granted, deliver local system notification
      if (caps.hasNotificationAPI && caps.permission === 'granted') {
        this.sendLocalNotification(reminder.title, reminder.body);
      }

      // Mark delivered for today
      localStorage.setItem(lastFireKey, dateStr);

      // If background delivery is limited, provide a gentle in-app reminder
      if (!caps.backgroundDeliverySupported) {
        setTimeout(() => {
          this.showToast(`${reminder.title}: ${reminder.body}`, 4500);
        }, 1800);
      }
    }
  },

  checkAndFireReminders() {
    if (!STATE.settings?.remindersEnabled || !STATE.profile || !STATE.profile.setupDone) return;

    const targetTime = STATE.settings.reminderTime || "08:00";
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;

    const dateStr = getLocalDateString(now);
    const lastFireKey = `fz_last_reminder_${dateStr}`;

    if (currentTimeStr === targetTime && !localStorage.getItem(lastFireKey)) {
      const reminder = this.getApplicableReminder();
      if (!reminder) return;

      const caps = this.getNotificationCapabilities();
      if (caps.hasNotificationAPI && caps.permission === 'granted') {
        this.sendLocalNotification(reminder.title, reminder.body);
      }

      localStorage.setItem(lastFireKey, dateStr);
      this.showToast(`${reminder.title}: ${reminder.body}`, 4500);
    }
  },

  sendLocalNotification(title, body) {
    try {
      const caps = this.getNotificationCapabilities();
      if (!caps.hasNotificationAPI || caps.permission !== 'granted') {
        return false;
      }

      if (caps.hasServiceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
          if (reg && reg.showNotification) {
            reg.showNotification(title, {
              body: body,
              icon: '/icon-192.png',
              badge: '/icon.svg',
              vibrate: [200, 100, 200],
              data: { url: '/' }
            }).catch(() => {
              try { new Notification(title, { body: body, icon: '/icon-192.png' }); } catch (err) {}
            });
          } else {
            try { new Notification(title, { body: body, icon: '/icon-192.png' }); } catch (err) {}
          }
        }).catch(() => {
          try { new Notification(title, { body: body, icon: '/icon-192.png' }); } catch (err) {}
        });
      } else {
        try { new Notification(title, { body: body, icon: '/icon-192.png' }); } catch (err) {}
      }
      return true;
    } catch (e) {
      console.warn('[Notification] Delivery fallback caught:', e);
      return false;
    }
  }
};

window.app = app;

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    const doRegister = () => {
      try {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(err => {
          console.warn('[SW] Registration failed gracefully:', err);
        });
      } catch (e) {
        console.warn('[SW] Registration exception caught:', e);
      }
    };
    if (document.readyState === 'complete') {
      doRegister();
    } else {
      window.addEventListener('load', doRegister);
    }
  }
}

function boot() {
  registerServiceWorker();
  try {
    app.init();
  } catch (err) {
    console.error('App init error:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  setTimeout(boot, 10);
}
