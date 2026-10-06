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
    reminderTime: '08:00'
  },
  streak: { current: 0, longest: 0, lastDate: null },
  bookmarks: {},
  backupMeta: {}
};

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
  const d = parseLocalDate(dateObj) || new Date();
  d.setDate(d.getDate() + days);
  return d;
}
window.addDays = addDays;

function diffInDays(dateA, dateB) {
  const da = parseLocalDate(dateA);
  const db = parseLocalDate(dateB);
  if (!da || !db) return 0;
  return Math.round((da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24));
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

// --- Main Canonical Application Object ---
const app = {
  charts: {},
  pendingAction: null,
  pendingImportPayload: null,
  isEditingNotes: false,
  _currentModalDate: null,
  predictions: null,
  reminderInterval: null,
  calContextDate: new Date(),

  // ==========================================
  // 1. DATA SAFETY & STORAGE LAYER (CANONICAL)
  // ==========================================
  safeParseJSON(str, fallback) {
    if (!str) return fallback;
    try {
      return JSON.parse(str);
    } catch (e) {
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
      const parsed = JSON.parse(val);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (e) {
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
    const lastPeriodStart = data.lastPeriodStart && !isNaN(new Date(data.lastPeriodStart).getTime()) ? getLocalDateString(new Date(data.lastPeriodStart)) : null;
    return {
      name,
      age,
      lastPeriodStart,
      cycleLength: Math.min(Math.max(cycleLength, 20), 45),
      periodLength: Math.min(Math.max(periodLength, 2), 12),
      setupDone: Boolean(data.setupDone)
    };
  },

  validatePeriods(periods) {
    if (!Array.isArray(periods)) return [];
    return periods
      .filter(p => p && typeof p === 'object')
      .map(p => {
        const s = p.startDate || p.start;
        const e = p.endDate || p.end || s;
        const validStart = s && !isNaN(new Date(s).getTime()) ? getLocalDateString(new Date(s)) : getLocalDateString(new Date());
        const validEnd = e && !isNaN(new Date(e).getTime()) ? getLocalDateString(new Date(e)) : validStart;
        const flow = typeof p.flow === 'string' && p.flow ? p.flow : 'মাঝারি';
        return {
          startDate: validStart,
          endDate: validEnd,
          flow,
          start: validStart,
          end: validEnd
        };
      })
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  },

  validateDailyLog(log, dateStr) {
    if (!log || typeof log !== 'object') log = {};
    const flow = typeof log.flow === 'string' ? log.flow : '';
    const mood = typeof log.mood === 'string' ? log.mood : '';
    const energyNum = parseInt(log.energy, 10);
    const energy = !isNaN(energyNum) ? Math.min(Math.max(energyNum, 0), 100) : 50;
    const sleepQuality = typeof log.sleepQuality === 'string' ? log.sleepQuality : (typeof log.sleep === 'string' ? log.sleep : '');
    const sleepHoursNum = parseFloat(log.sleepHours);
    const sleepHours = !isNaN(sleepHoursNum) ? sleepHoursNum : null;
    const symptoms = Array.isArray(log.symptoms) ? log.symptoms.filter(s => typeof s === 'string') : [];
    const notes = typeof log.notes === 'string' ? log.notes : '';
    const periodStarted = Boolean(log.periodStarted || (flow && log.periodStarted !== false));
    const periodEnded = Boolean(log.periodEnded);

    return {
      date: dateStr,
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
    if (!logs || typeof logs !== 'object') return {};
    const valid = {};
    Object.keys(logs).forEach(dateKey => {
      if (dateKey && !isNaN(new Date(dateKey).getTime())) {
        const canonicalDate = getLocalDateString(new Date(dateKey));
        valid[canonicalDate] = this.validateDailyLog(logs[dateKey], canonicalDate);
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
        time: typeof settings.reminderTime === 'string' && settings.reminderTime ? settings.reminderTime : (settings.notificationPreferences?.time || '08:00')
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

    try {
      const rawProfile = this.safeGet('fz_profile', null);
      STATE.profile = this.validateProfile(rawProfile);
    } catch (e) {
      this.recover('profile', e);
      STATE.profile = null;
    }

    try {
      const rawPeriods = this.safeGet('fz_periods', []);
      STATE.periods = this.validatePeriods(rawPeriods);
    } catch (e) {
      this.recover('periods', e);
      STATE.periods = [];
    }

    try {
      const rawLogs = this.safeGet('fz_logs', {});
      STATE.logs = this.validateLogs(rawLogs);
    } catch (e) {
      this.recover('logs', e);
      STATE.logs = {};
    }

    try {
      const rawSettings = this.safeGet('fz_settings', {});
      STATE.settings = this.validateSettings(rawSettings);
    } catch (e) {
      this.recover('settings', e);
      STATE.settings = this.validateSettings({});
    }

    try {
      const rawStreak = this.safeGet('fz_streak', {});
      STATE.streak = this.validateStreak(rawStreak);
    } catch (e) {
      this.recover('streak', e);
      STATE.streak = { current: 0, longest: 0, lastDate: null };
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
      const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      const dateStr = getLocalDateString(new Date());
      downloadAnchor.setAttribute("href", jsonStr);
      downloadAnchor.setAttribute("download", `fuljhori-backup-${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
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

  executePendingAction() {
    if (this.pendingAction === 'reset_data') {
      localStorage.clear();
      location.reload();
    } else if (this.pendingAction === 'reset_settings') {
      localStorage.removeItem('fz_settings');
      location.reload();
    } else if (this.pendingAction === 'remove_pin_init') {
      this.showLockScreen('remove_verify');
    } else if (this.pendingAction === 'restore_backup' && this.pendingImportPayload) {
      const payload = this.pendingImportPayload;
      if (payload.profile) this.saveData('fz_profile', payload.profile);
      if (Array.isArray(payload.periods)) this.saveData('fz_periods', payload.periods);
      if (payload.logs && typeof payload.logs === 'object') this.saveData('fz_logs', payload.logs);
      if (payload.settings && typeof payload.settings === 'object') this.saveData('fz_settings', payload.settings);
      if (payload.streak) this.saveData('fz_streak', payload.streak);
      if (payload.bookmarks) this.saveData('fz_bookmarks', payload.bookmarks);
      this.saveData('fz_backup_meta', { lastRestoredAt: new Date().toISOString() });
      this.showToast('✅ ব্যাকআপ সফলভাবে রিস্টোর হয়েছে');
      setTimeout(() => location.reload(), 800);
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
    this.saveData('fz_settings', STATE.settings);
    this.applyAppearance();
    this.renderSettings();
  },

  setColorTheme(theme) {
    if (!STATE.settings) STATE.settings = {};
    STATE.settings.colorTheme = theme;
    STATE.settings.theme = theme;
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
    const t = parseLocalDate(today);
    if (!start || isNaN(start.getTime()) || !t || isNaN(t.getTime())) {
      return null;
    }
    const diff = diffInDays(t, start);
    if (diff < 0) {
      return 1;
    }
    return diff + 1;
  },

  calculateNextPeriod(latestPeriodStart, predictedCycleLength, periodLength, allPeriods, today) {
    const anchor = parseLocalDate(latestPeriodStart);
    const pLen = Math.min(Math.max(parseInt(periodLength, 10) || 5, 2), 12);
    const cLen = Math.min(Math.max(parseInt(predictedCycleLength, 10) || 28, 20), 45);

    // If an actual period has already been logged strictly after anchor date, prefer it
    const laterLogged = (allPeriods || []).find(p => {
      const pStart = parseLocalDate(p.startDate || p.start);
      return pStart && diffInDays(pStart, anchor) > 0;
    });

    if (laterLogged) {
      const nextStart = parseLocalDate(laterLogged.startDate || laterLogged.start);
      const nextEnd = parseLocalDate(laterLogged.endDate || laterLogged.end) || addDays(nextStart, pLen - 1);
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
      nextPeriodStart
    } = params;

    const t = parseLocalDate(today);
    const pLen = Math.min(Math.max(parseInt(periodLength, 10) || 5, 2), 12);

    // Rule A: মাসিকের সময় (Current date is within user's logged period range)
    let isCurrentPeriodActive = false;
    for (const p of (allPeriods || [])) {
      const pStart = parseLocalDate(p.startDate || p.start);
      const pEnd = parseLocalDate(p.endDate || p.end) || addDays(pStart, pLen - 1);
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
      const anchorEnd = addDays(anchorStart, pLen - 1);
      if (t >= anchorStart && t <= anchorEnd) {
        return {
          phaseName: "মাসিকের সময়",
          phaseColor: "var(--primary)",
          phaseColorTitle: "var(--primary)",
          advice: "শরীরটা আজ একটু স্লো যেতে চাইতে পারে 🌙",
          isCurrentPeriodActive: true
        };
      }
    }

    // Rule B: ডিম্বস্ফোটনের সময় (Current date is ovulation date ±1 day)
    if (ovulationDate) {
      const ovulMinus1 = addDays(ovulationDate, -1);
      const ovulPlus1 = addDays(ovulationDate, 1);
      if (t >= ovulMinus1 && t <= ovulPlus1) {
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
    if (ovulationDate && t < addDays(ovulationDate, -1)) {
      return {
        phaseName: "ফলিকুলার পর্যায়",
        phaseColor: "var(--secondary)",
        phaseColorTitle: "var(--accent)",
        advice: "আজকে এনার্জি একটু ভালো থাকতে পারে 🌱",
        isCurrentPeriodActive: false
      };
    }

    // Rule D: লুটিয়াল পর্যায় (After ovulation window and before or at next predicted period)
    return {
      phaseName: "লুটিয়াল পর্যায়",
      phaseColor: "#FFB300",
      phaseColorTitle: "#D89A00",
      advice: (nextPeriodStart && t >= nextPeriodStart)
        ? "পিরিয়ড বিলম্বিত হতে পারে, পর্যাপ্ত বিশ্রাম ও পানি পান করো 🌿"
        : "আজ একটু রেস্ট নিলে ভালো লাগতে পারে 💕",
      isCurrentPeriodActive: false
    };
  },

  getPredictionState() {
    const today = parseLocalDate(new Date());
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
        return {
          startDate: getLocalDateString(parseLocalDate(s)),
          endDate: getLocalDateString(parseLocalDate(e)),
          flow: p.flow || 'মাঝারি'
        };
      })
      .filter(p => p.startDate)
      .sort((a, b) => parseLocalDate(a.startDate) - parseLocalDate(b.startDate));

    // Anchor period start
    const latestPeriodRecord = validPeriods.length > 0 ? validPeriods[validPeriods.length - 1] : null;
    const latestStartStr = latestPeriodRecord?.startDate || (profile.lastPeriodStart ? getLocalDateString(parseLocalDate(profile.lastPeriodStart)) : null);

    // If no usable anchor period at all -> Insufficient data state
    if (!latestStartStr) {
      this.predictions = {
        predictionAvailable: false,
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
    const nextPeriodStart = nextPeriodInfo.nextPeriodStart;
    const nextPeriodEnd = nextPeriodInfo.nextPeriodEnd;
    const isNextPeriodLogged = nextPeriodInfo.isActualLogged;

    // 6. Ovulation & Fertile Window
    const ovulationDate = this.calculateOvulation(nextPeriodStart);
    const fertileWindow = this.calculateFertileWindow(ovulationDate);
    const fertileStartDate = fertileWindow.fertileStartDate;
    const fertileEndDate = fertileWindow.fertileEndDate;

    // 7. Current Cycle Day
    const currentCycleDay = this.calculateCurrentCycleDay(latestStart, today);

    // 8. Phase Calculation
    const phaseInfo = this.calculateCurrentPhase({
      today,
      allPeriods: validPeriods,
      latestPeriodStart: latestStart,
      periodLength,
      ovulationDate,
      fertileStartDate,
      fertileEndDate,
      nextPeriodStart
    });

    this.predictions = {
      predictionAvailable: true,
      currentCycleDay,
      predictedCycleLength,
      cycleLength: predictedCycleLength,
      periodLength,
      nextPeriodDate: nextPeriodStart,
      nextPeriodStart,
      nextPeriodDateStr: getLocalDateString(nextPeriodStart),
      nextPeriodEnd,
      nextPeriodEndDateStr: getLocalDateString(nextPeriodEnd),
      isNextPeriodLogged,
      ovulationDate,
      ovulationDateStr: getLocalDateString(ovulationDate),
      fertileStartDate,
      fertileStart: fertileStartDate,
      fertileStartDateStr: getLocalDateString(fertileStartDate),
      fertileEndDate,
      fertileEnd: fertileEndDate,
      fertileEndDateStr: getLocalDateString(fertileEndDate),
      currentPhase: phaseInfo.phaseName,
      phaseName: phaseInfo.phaseName,
      phaseColor: phaseInfo.phaseColor,
      phaseColorTitle: phaseInfo.phaseColorTitle,
      advice: phaseInfo.advice,
      isCurrentPeriodActive: phaseInfo.isCurrentPeriodActive,
      confidenceLevel: confidence.level,
      confidenceScore: confidence.score,
      confidence: confidence.score,
      cycleCountUsed: cycleLengths.length,
      cycleLengths,
      cycleVariability,
      variability: cycleVariability,
      irregularityStatus: cycleVariability.irregularityStatus,
      variabilityMessage: cycleVariability.message
    };

    return this.predictions;
  },

  calculatePredictions() {
    return this.getPredictionState();
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
    } else {
      document.getElementById('view-onboarding').classList.add('hidden');
      document.getElementById('main-app').classList.remove('hidden');
      document.getElementById('screen-lock').classList.add('hidden');
      this.renderHome();
      this.renderSettings();
    }
  },

  switchTab(tabName) {
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
  // 5. ONBOARDING
  // ==========================================
  nextOnboardingSlide(slideNum) {
    const slider = document.getElementById('onboarding-slider');
    if (!slider) return;
    slider.style.transform = `translateX(-${(slideNum - 1) * 33.333}%)`;
    document.querySelectorAll('.ob-pagination-group').forEach(group => {
      group.querySelectorAll('.ob-dot').forEach((dot, idx) => {
        dot.classList.toggle('active', idx === (slideNum - 1));
      });
    });

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

  validateAndNextSlide(slideNum) {
    if (slideNum === 3) {
      const age = document.getElementById('ob-setup-age')?.value;
      const lastP = document.getElementById('ob-setup-last-period')?.value;
      const name = document.getElementById('ob-setup-name')?.value;
      let valid = true;

      if (name && name.length > 20) {
        document.getElementById('ob-name-err').style.display = 'block';
        valid = false;
      }
      if (!age || age < 10 || age > 60) {
        document.getElementById('ob-age-err').style.display = 'block';
        valid = false;
      }
      if (!lastP) {
        document.getElementById('ob-date-err').style.display = 'block';
        valid = false;
      } else {
        const selectedDate = new Date(lastP);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (selectedDate > today) {
          document.getElementById('ob-date-err').style.display = 'block';
          valid = false;
        }
      }

      if (!valid) {
        this.safeVibrate([50, 50, 50]);
        return;
      }
    }
    this.nextOnboardingSlide(slideNum);
  },

  finishOnboardingSafe() {
    const name = document.getElementById('ob-setup-name')?.value || '';
    const ageVal = document.getElementById('ob-setup-age')?.value;
    const ageNum = parseInt(ageVal, 10);
    const age = !isNaN(ageNum) && ageNum >= 10 && ageNum <= 65 ? ageNum : null;
    const lastP = document.getElementById('ob-setup-last-period')?.value;
    const cycle = parseInt(document.getElementById('ob-setup-cycle')?.value, 10) || 28;
    const period = parseInt(document.getElementById('ob-setup-period')?.value, 10) || 5;

    const start = new Date(lastP);
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
      setupDone: true
    });

    STATE.periods = this.validate('periods', [{
      startDate: startDateStr,
      endDate: endDateStr,
      flow: 'মাঝারি'
    }]);

    this.saveData('fz_profile', STATE.profile);
    this.saveData('fz_periods', STATE.periods);
    this.saveData('fz_logs', STATE.logs || {});
    this.saveData('fz_settings', STATE.settings);

    document.getElementById('view-onboarding').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    this.renderHome();
    this.renderSettings();
    this.safeVibrate(50);
  },

  finishOnboarding() {
    this.finishOnboardingSafe();
  },

  // ==========================================
  // 6. HOME VIEW (CANONICAL)
  // ==========================================
  updateGreeting() {
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
        chipNext.innerText = p.nextPeriodStart ? formatBanglaShortDate(p.nextPeriodStart) : '-';
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
    const recentLogs = logDates.slice(0, 7).map(d => logs[d]);

    const cards = [];

    // Friendly 1: Sleep
    const goodSleep = recentLogs.filter(l => l.sleep && l.sleep.includes('ভালো')).length;
    const lowSleep = recentLogs.filter(l => l.sleep && l.sleep.includes('কম')).length;
    if (lowSleep >= 2) {
      cards.push({ icon: '😴', text: 'গত কয়েকদিনে ঘুম কিছুটা কম হয়েছে, আজ একটু আগে ঘুমানোর চেষ্টা করো।' });
    } else if (goodSleep >= 2) {
      cards.push({ icon: '🌿', text: 'তোমার ঘুমের রুটিন চমৎকার চলছে! এটি শরীরের শক্তি বজায় রাখতে সহায়ক।' });
    }

    // Friendly 2: Energy
    const highEnergy = recentLogs.filter(l => l.energy >= 65).length;
    if (highEnergy >= 2) {
      cards.push({ icon: '⚡', text: 'এই সপ্তাহে তোমার শক্তির মাত্রা বেশ ভালো ছিল।' });
    }

    // Friendly 3: Mood
    const goodMood = recentLogs.filter(l => l.mood && l.mood.includes('ভালো')).length;
    if (goodMood >= 2) {
      cards.push({ icon: '🌸', text: 'মেজাজ বেশ শান্ত ও সুন্দর রয়েছে। ইতিবাচক অনুভূতি উপভোগ করো।' });
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
    const p = this.predictions || this.calculatePredictions();
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
    if (phaseInfo) {
      html += `<div class="mb-3 text-primary font-semibold" style="font-size: 0.95rem;">${phaseInfo}</div>`;
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
        html += `<div class="mb-1 text-sm"><strong>পিরিয়ডের অবস্থা:</strong> ${log?.flow ? `রক্তপ্রবাহ ${log.flow}` : 'পিরিয়ড চলছে'}</div>`;
      }
      if (log?.mood) {
        html += `<div class="mb-1 text-sm"><strong>মেজাজ:</strong> ${log.mood}</div>`;
      }
      if (log?.symptoms && Array.isArray(log.symptoms) && log.symptoms.length > 0) {
        html += `<div class="mb-1 text-sm"><strong>লক্ষণসমূহ:</strong> ${log.symptoms.join(', ')}</div>`;
      }
      if (log?.energy !== undefined && log.energy !== null && log.energy !== '') {
        html += `<div class="mb-1 text-sm"><strong>শক্তির মাত্রা:</strong> ${toBanglaNumber(log.energy)}%</div>`;
      }
      if (log?.sleep) {
        html += `<div class="mb-1 text-sm"><strong>ঘুম:</strong> ${log.sleep}</div>`;
      }
      if (log?.notes && log.notes.trim()) {
        html += `<div class="mt-2 text-sm" style="border-top: 1px dashed var(--border); padding-top: 6px;"><strong>নোট:</strong> ${log.notes}</div>`;
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
    const dTime = new Date(dStr).getTime();
    let extended = false;

    for (let i = 0; i < STATE.periods.length; i++) {
      const p = STATE.periods[i];
      const pEndTime = new Date(p.endDate || p.end).getTime();
      const pStartTime = new Date(p.startDate || p.start).getTime();
      const diffEnd = Math.round((dTime - pEndTime) / (1000 * 60 * 60 * 24));
      const diffStart = Math.round((pStartTime - dTime) / (1000 * 60 * 60 * 24));

      if (diffEnd >= 1 && diffEnd <= 2) {
        p.endDate = dStr;
        p.end = dStr;
        extended = true;
        break;
      } else if (diffStart >= 1 && diffStart <= 2) {
        p.startDate = dStr;
        p.start = dStr;
        extended = true;
        break;
      }
    }

    if (!extended) {
      STATE.periods.push({
        startDate: dStr,
        endDate: dStr,
        flow: 'মাঝারি',
        start: dStr,
        end: dStr
      });
    }
    STATE.periods = this.validate('periods', STATE.periods);
    this.saveData('fz_periods', STATE.periods);

    this.calculatePredictions();
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

  loadLogForDate() {
    const dateInput = document.getElementById('log-date');
    const dStr = dateInput ? dateInput.value || getLocalDateString(new Date()) : getLocalDateString(new Date());
    if (dateInput && !dateInput.value) dateInput.value = dStr;

    document.querySelectorAll('.chip-group .chip-item').forEach(c => c.classList.remove('active'));
    const energyInput = document.getElementById('log-energy');
    const energyVal = document.getElementById('energy-val');
    if (energyInput) energyInput.value = 50;
    if (energyVal) energyVal.innerText = `${toBanglaNumber(50)}%`;

    const notesInput = document.getElementById('log-notes');
    if (notesInput) notesInput.value = '';

    if (STATE.logs && STATE.logs[dStr]) {
      const log = STATE.logs[dStr];
      if (log.symptoms && Array.isArray(log.symptoms)) {
        document.querySelectorAll('#symptom-chips .chip-item').forEach(c => {
          if (log.symptoms.includes(c.textContent.trim())) c.classList.add('active');
        });
      }
      if (log.mood) {
        document.querySelectorAll('#mood-chips .chip-item').forEach(c => {
          if (c.textContent.trim() === log.mood) c.classList.add('active');
        });
      }
      if (log.flow) {
        document.querySelectorAll('#flow-chips .chip-item').forEach(c => {
          if (c.textContent.trim() === log.flow) c.classList.add('active');
        });
      }
      if (log.sleep) {
        document.querySelectorAll('#sleep-chips .chip-item').forEach(c => {
          if (c.textContent.trim() === log.sleep) c.classList.add('active');
        });
      }
      if (log.energy !== undefined) {
        const val = parseInt(log.energy, 10) || 50;
        if (energyInput) energyInput.value = val;
        if (energyVal) energyVal.innerText = `${toBanglaNumber(val)}%`;
      }
      if (log.notes && notesInput) {
        notesInput.value = log.notes;
      }
    }
  },

  toggleChip(el) {
    el.classList.toggle('active');
    this.safeVibrate(20);
  },

  toggleSingleChip(el, parentId) {
    const container = document.getElementById(parentId);
    if (!container) return;
    const isAct = el.classList.contains('active');
    container.querySelectorAll('.chip-item').forEach(c => c.classList.remove('active'));
    if (!isAct) el.classList.add('active');
    this.safeVibrate(20);
  },

  saveLog() {
    const dateInput = document.getElementById('log-date');
    const dStr = dateInput ? dateInput.value || getLocalDateString(new Date()) : getLocalDateString(new Date());
    const notes = document.getElementById('log-notes')?.value || '';
    const energyVal = document.getElementById('log-energy')?.value || '50';

    const symptoms = [];
    document.querySelectorAll('#symptom-chips .chip-item.active').forEach(c => symptoms.push(c.textContent.trim()));

    const moodEl = document.querySelector('#mood-chips .chip-item.active');
    const mood = moodEl ? moodEl.textContent.trim() : '';

    const flowEl = document.querySelector('#flow-chips .chip-item.active');
    const flow = flowEl ? flowEl.textContent.trim() : '';

    const sleepEl = document.querySelector('#sleep-chips .chip-item.active');
    const sleep = sleepEl ? sleepEl.textContent.trim() : '';

    const validatedLog = this.validate('dailyLog', {
      date: dStr,
      periodStarted: Boolean(flow),
      periodEnded: false,
      flow,
      symptoms,
      mood,
      sleepQuality: sleep,
      sleep,
      energy: parseInt(energyVal, 10),
      notes
    }, dStr);

    if (!STATE.logs) STATE.logs = {};
    // Duplicate log prevention: update existing record in place
    STATE.logs[dStr] = validatedLog;
    this.saveData('fz_logs', STATE.logs);

    // If flow was selected, automatically update period records
    if (flow) {
      if (!STATE.periods) STATE.periods = [];
      const alreadyIn = STATE.periods.some(p => dStr >= (p.startDate || p.start) && dStr <= (p.endDate || p.end));
      if (!alreadyIn) {
        const dTime = new Date(dStr).getTime();
        let extended = false;
        for (let i = 0; i < STATE.periods.length; i++) {
          const p = STATE.periods[i];
          const pEndTime = new Date(p.endDate || p.end).getTime();
          const pStartTime = new Date(p.startDate || p.start).getTime();
          const diffEnd = Math.round((dTime - pEndTime) / (1000 * 60 * 60 * 24));
          const diffStart = Math.round((pStartTime - dTime) / (1000 * 60 * 60 * 24));
          if (diffEnd >= 1 && diffEnd <= 2) {
            p.endDate = dStr;
            p.end = dStr;
            p.flow = flow || p.flow;
            extended = true;
            break;
          } else if (diffStart >= 1 && diffStart <= 2) {
            p.startDate = dStr;
            p.start = dStr;
            p.flow = flow || p.flow;
            extended = true;
            break;
          }
        }
        if (!extended) {
          STATE.periods.push({
            startDate: dStr,
            endDate: dStr,
            flow: flow || 'মাঝারি',
            start: dStr,
            end: dStr
          });
        }
        STATE.periods = this.validate('periods', STATE.periods);
        this.saveData('fz_periods', STATE.periods);
      }
    }

    this.calculatePredictions();
    this.updateStreak();
    this.isEditingNotes = false;
    this.showToast('✅ তথ্য সফলভাবে সংরক্ষিত হয়েছে!');
    this.safeVibrate(50);

    const btn = document.getElementById('save-log-btn');
    if (btn) {
      btn.style.transform = 'scale(0.96)';
      setTimeout(() => { btn.style.transform = 'scale(1)'; }, 200);
    }
  },

  // ==========================================
  // 9. ANALYTICS VIEW (CANONICAL)
  // ==========================================
  destroyChart(id) {
    if (this.charts[id]) {
      this.charts[id].destroy();
      this.charts[id] = null;
    }
  },

  safeCreateChart(id, ctx, config) {
    try {
      this.charts[id] = new Chart(ctx, config);
    } catch (e) {
      console.warn('Chart render error:', id, e);
    }
  },

  renderAnalytics() {
    const textColor = this.getThemeColor('--text-muted') || '#888888';
    if (typeof Chart !== 'undefined') {
      Chart.defaults.font.family = 'system-ui, -apple-system, sans-serif';
      Chart.defaults.color = textColor;
      Chart.defaults.scale.grid.color = this.getThemeColor('--border') || '#EEEEEE';
    }

    const p = this.predictions || this.calculatePredictions();
    const periods = [...(STATE.periods || [])].sort((a, b) => new Date(a.startDate || a.start) - new Date(b.startDate || b.start));
    const logs = STATE.logs || {};

    // Predictions
    if (p && p.predictionAvailable) {
      const predNext = document.getElementById('pred-next-period');
      if (predNext) {
        predNext.innerText = `${formatBanglaShortDate(p.nextPeriodStart)}${p.isNextPeriodLogged ? ' (লগকৃত)' : ''}`;
      }

      const predOvul = document.getElementById('pred-ovulation');
      if (predOvul) predOvul.innerText = formatBanglaShortDate(p.ovulationDate);

      const predFw = document.getElementById('pred-fertile-window');
      if (predFw) {
        predFw.innerText = `${formatBanglaShortDate(p.fertileStartDate)} – ${formatBanglaShortDate(p.fertileEndDate)}`;
      }
    } else {
      const predNext = document.getElementById('pred-next-period');
      if (predNext) predNext.innerText = '-';
      const predOvul = document.getElementById('pred-ovulation');
      if (predOvul) predOvul.innerText = '-';
      const predFw = document.getElementById('pred-fertile-window');
      if (predFw) predFw.innerText = '-';
    }

    // Statistics Grid
    const cycleLengths = p?.cycleLengths || [];
    let periodLengths = [];
    periods.forEach(per => {
      let pLen = Math.floor((new Date(per.endDate || per.end) - new Date(per.startDate || per.start)) / (1000 * 60 * 60 * 24)) + 1;
      if (pLen > 0 && pLen <= 15) periodLengths.push(pLen);
    });

    const totalLogs = Object.keys(logs).length;
    const totLogsEl = document.getElementById('stat-total-logs');
    if (totLogsEl) totLogsEl.innerText = toBanglaNumber(totalLogs);

    const minCycleEl = document.getElementById('stat-min-cycle');
    if (minCycleEl) {
      minCycleEl.innerText = (p?.cycleVariability?.min > 0) ? `${toBanglaNumber(p.cycleVariability.min)} দিন` : '-';
    }
    const maxCycleEl = document.getElementById('stat-max-cycle');
    if (maxCycleEl) {
      maxCycleEl.innerText = (p?.cycleVariability?.max > 0) ? `${toBanglaNumber(p.cycleVariability.max)} দিন` : '-';
    }

    // Single Canonical Smart Health Analysis
    this.renderSmartHealthAnalysis(logs, p);

    // Charts
    this.renderCycleChart(cycleLengths);
    this.renderPeriodChart(periodLengths);
    this.renderSymptomChart(logs);
    this.renderMoodChart(logs);

    // Mood Timeline (date-by-date emotional history)
    this.renderAnalyticsMoodTimeline(logs);
  },

  renderSmartHealthAnalysis(logs, predictions) {
    const container = document.getElementById('smart-insights-container');
    if (!container) return;

    const cards = [];

    // 1. Cycle Variability & Irregularity Analysis
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
              <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin: 0;">সাইকেল ভ্যারিয়েবিলিটি বিশ্লেষণ</h4>
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

    // Deep Analysis of logs (last 90 days)
    const logDates = Object.keys(logs).sort().reverse().slice(0, 90);
    const deepLogs = logDates.map(d => ({ date: d, data: logs[d] }));

    if (deepLogs.length >= 3) {
      // 2. Sleep vs Energy Correlation
      let lowSleepLowEnergy = 0;
      let goodSleepGoodEnergy = 0;
      deepLogs.forEach(l => {
        const { sleep, energy } = l.data;
        if (sleep && energy !== undefined) {
          if (sleep.includes('কম') && energy < 45) lowSleepLowEnergy++;
          if (sleep.includes('ভালো') && energy > 55) goodSleepGoodEnergy++;
        }
      });
      if (lowSleepLowEnergy >= 2) {
        cards.push(`
          <div class="card mb-3" style="border-radius: 18px; padding: 1rem; border-left: 4px solid var(--primary); background: var(--card);">
            <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <span style="font-size: 1.6rem;">😴</span>
              <div>
                <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 2px;">ঘুম ও শক্তির সম্পর্ক</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.45; margin: 0;">কম ঘুমের দিনে তোমার শারীরিক শক্তি উল্লেখযোগ্যভাবে কমে গেছে। পর্যাপ্ত বিশ্রাম শক্তির মাত্রা ধরে রাখতে সাহায্য করবে।</p>
              </div>
            </div>
          </div>
        `);
      } else if (goodSleepGoodEnergy >= 2) {
        cards.push(`
          <div class="card mb-3" style="border-radius: 18px; padding: 1rem; border-left: 4px solid var(--secondary); background: var(--card);">
            <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <span style="font-size: 1.6rem;">⚡</span>
              <div>
                <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 2px;">ভালো ঘুমের সুফল</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.45; margin: 0;">যেদিন ঘুম ভালো হয়েছে, সেদিন এনার্জি লেভেল গড়ে ৬০% এর বেশি ছিল। এই সুন্দর রুটিন ধরে রাখো।</p>
              </div>
            </div>
          </div>
        `);
      }

      // 3. Sleep vs Mood Correlation
      let lowSleepBadMood = 0;
      deepLogs.forEach(l => {
        const { sleep, mood } = l.data;
        if (sleep && mood) {
          if (sleep.includes('কম') && (mood.includes('কষ্টে') || mood.includes('রাগী') || mood.includes('সংবেদনশীল'))) {
            lowSleepBadMood++;
          }
        }
      });
      if (lowSleepBadMood >= 2) {
        cards.push(`
          <div class="card mb-3" style="border-radius: 18px; padding: 1rem; border-left: 4px solid var(--accent); background: var(--card);">
            <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <span style="font-size: 1.6rem;">🌙</span>
              <div>
                <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 2px;">ঘুম ও মেজাজের ভারসাম্য</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.45; margin: 0;">ঘুম কম হওয়ার দিনে বিরক্তি বা সংবেদনশীলতা বেশি দেখা গেছে। অন্তত ৭-৮ ঘণ্টা নির্বিঘ্ন ঘুম মেজাজ নিয়ন্ত্রণে সহায়ক।</p>
              </div>
            </div>
          </div>
        `);
      }

      // 4. PMS Pattern
      const pmsCommon = ['মাথাব্যথা', 'কোমর ব্যথা', 'ব্যথা', 'ক্লান্তি'];
      let pmsMatch = 0;
      deepLogs.slice(0, 10).forEach(l => {
        if (l.data.symptoms && l.data.symptoms.some(s => pmsCommon.includes(s))) {
          pmsMatch++;
        }
      });
      if (pmsMatch >= 2) {
        cards.push(`
          <div class="card mb-3" style="border-radius: 18px; padding: 1rem; border-left: 4px solid #FF80AB; background: var(--card);">
            <div style="display: flex; gap: 0.75rem; align-items: flex-start;">
              <span style="font-size: 1.6rem;">🌸</span>
              <div>
                <h4 style="font-size: 0.95rem; font-weight: 600; margin-bottom: 2px;">পিএমএস (PMS) প্যাটার্ন</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.45; margin: 0;">পিরিয়ডের আগের দিনগুলোতে কোমর বা পেটে মৃদু ব্যথা দেখা যাওয়ার প্যাটার্ন রয়েছে। উষ্ণ শেঁক ও হালকা স্ট্রেচিং অনেক আরাম দেবে।</p>
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
            আরও কিছু তথ্য ও সাইকেল যোগ করলে গভীর ব্যক্তিগত বিশ্লেষণ এখানে প্রদর্শিত হবে
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

    if (!data || data.length < 2) {
      if (viewEl) viewEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }
    if (viewEl) viewEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    const ctx = document.getElementById('chart-cycle-history')?.getContext('2d');
    if (!ctx) return;
    const labels = data.map((_, i) => toBanglaNumber(i + 1));

    this.safeCreateChart('chart-cycle', ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'সাইকেল দৈর্ঘ্য (দিন)',
          data: data,
          borderColor: this.getThemeColor('--primary'),
          backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)',
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
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: false,
            min: 18,
            max: 45,
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

    if (!data || data.length < 2) {
      if (viewEl) viewEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'flex';
      return;
    }
    if (viewEl) viewEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    const ctx = document.getElementById('chart-period-history')?.getContext('2d');
    if (!ctx) return;
    const labels = data.map((_, i) => toBanglaNumber(i + 1));

    this.safeCreateChart('chart-period', ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'স্থায়িত্ব (দিন)',
          data: data,
          backgroundColor: this.getThemeColor('--secondary'),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            max: 10,
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
    Object.values(logs).forEach(l => {
      if (l.symptoms && Array.isArray(l.symptoms)) {
        l.symptoms.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
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
        plugins: { legend: { display: false } },
        scales: {
          x: { display: false },
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
    Object.values(logs).forEach(l => {
      if (l.mood) counts[l.mood] = (counts[l.mood] || 0) + 1;
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
      '😊 ভালো': '#A5D6A7',
      '😐 স্বাভাবিক': '#E0E0E0',
      '😢 কষ্টে': '#90CAF9',
      '😡 রাগী': '#EF9A9A',
      '😭 সংবেদনশীল': '#CE93D8'
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
          cutout: '72%'
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
                const pct = Math.round((val / totalMoods) * 100);
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

    const logDates = Object.keys(logs).filter(d => logs[d]?.mood).sort().reverse().slice(0, 10);
    if (logDates.length === 0) {
      container.innerHTML = `<p class="text-muted text-sm text-center w-full">লগ করার পর মেজাজের সময়রেখা এখানে দেখাবে</p>`;
      return;
    }

    let html = '';
    // Chronological order from oldest to newest in slice
    [...logDates].reverse().forEach(dStr => {
      const moodVal = logs[dStr]?.mood || '';
      const emoji = moodVal ? moodVal.split(' ')[0] : '➖';
      const label = formatBanglaShortDate(new Date(dStr));

      html += `
        <div style="text-align: center; flex: 0 0 54px; background: color-mix(in srgb, var(--primary) 4%, transparent); padding: 8px 4px; border-radius: 14px; border: 1px solid var(--border);">
          <div style="font-size: 1.6rem;">${emoji}</div>
          <small class="text-muted" style="font-size: 0.72rem; display: block; margin-top: 4px;">${label}</small>
        </div>
      `;
    });
    container.innerHTML = html;
  },

  // ==========================================
  // 10. SETTINGS VIEW (CANONICAL)
  // ==========================================
  saveSettingsProfile() {
    if (STATE.profile) {
      const newName = document.getElementById('settings-name')?.value || '';
      const newAgeVal = document.getElementById('settings-age')?.value;
      const newAgeNum = parseInt(newAgeVal, 10);
      STATE.profile.name = newName.trim();
      STATE.profile.age = !isNaN(newAgeNum) && newAgeNum >= 10 && newAgeNum <= 65 ? newAgeNum : null;
      STATE.profile = this.validate('profile', STATE.profile);
      this.saveData('fz_profile', STATE.profile);
      this.renderHome();
      this.showToast('✅ প্রোফাইল তথ্য আপডেট হয়েছে');
    }
  },

  renderSettings() {
    if (STATE.profile) {
      const nameEl = document.getElementById('settings-name');
      if (nameEl) nameEl.value = STATE.profile.name || '';
      const ageEl = document.getElementById('settings-age');
      if (ageEl) ageEl.value = STATE.profile.age != null ? STATE.profile.age : '';
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
        this.saveData('fz_settings', STATE.settings);
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
    const p = this.predictions || this.calculatePredictions();
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
  // 13. REMINDER & NOTIFICATION SYSTEM
  // ==========================================
  toggleReminder() {
    if (!STATE.settings) STATE.settings = {};
    const enabled = !STATE.settings.remindersEnabled;

    if (enabled) {
      if (!("Notification" in window)) {
        this.showToast('আপনার ব্রাউজার নোটিফিকেশন সাপোর্ট করে না');
        return;
      }
      try {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            STATE.settings.remindersEnabled = true;
            if (!STATE.settings.reminderTime) STATE.settings.reminderTime = "08:00";
            this.saveData('fz_settings', STATE.settings);
            this.renderSettings();
            this.showToast('🌸 রিমাইন্ডার চালু হয়েছে');
            this.startReminderService();
          } else {
            this.showToast('নোটিফিকেশন পারমিশন পাওয়া যায়নি');
          }
        }).catch(() => {
          this.showToast('নোটিফিকেশন সেটআপে সমস্যা হয়েছে');
        });
      } catch (e) {
        this.showToast('নোটিফিকেশন সমর্থিত নয়');
      }
    } else {
      STATE.settings.remindersEnabled = false;
      this.saveData('fz_settings', STATE.settings);
      this.renderSettings();
      this.showToast('রিমাইন্ডার বন্ধ করা হয়েছে');
    }
  },

  saveReminderTime() {
    if (!STATE.settings) return;
    const t = document.getElementById('reminder-time')?.value;
    if (t) {
      STATE.settings.reminderTime = t;
      this.saveData('fz_settings', STATE.settings);
      this.showToast('রিমাইন্ডার সময় সংরক্ষিত হয়েছে');
    }
  },

  startReminderService() {
    if (this.reminderInterval) clearInterval(this.reminderInterval);
    this.reminderInterval = setInterval(() => this.checkAndFireReminders(), 60000);
    setTimeout(() => this.checkAndFireReminders(), 5000);
  },

  checkAndFireReminders() {
    if (!STATE.settings?.remindersEnabled || !STATE.profile || !("Notification" in window) || Notification.permission !== 'granted') return;

    const targetTime = STATE.settings.reminderTime || "08:00";
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;

    const dateStr = getLocalDateString(now);
    const lastFireKey = `fz_last_reminder_${dateStr}`;

    if (currentTimeStr === targetTime && !localStorage.getItem(lastFireKey)) {
      const p = this.calculatePredictions();
      let title = "ফুলঝরি রিমাইন্ডার 🌸";
      let body = "আজকে কেমন আছো? পানি খেতে ভুলো না 💧";

      if (p && p.nextPeriodStart && p.ovulationDate) {
        const daysToPeriod = diffInDays(p.nextPeriodStart, now);
        const daysToOvulation = diffInDays(p.ovulationDate, now);

        if (daysToPeriod === 1) {
          body = "আগামীকাল তোমার পিরিয়ড শুরু হতে পারে 🌸 প্রয়োজনীয় প্রস্তুতি রেখো।";
        } else if (daysToPeriod === 0) {
          body = "আজ তোমার পিরিয়ড শুরু হতে পারে। নিজের যত্ন নিও 🌸";
        } else if (daysToOvulation <= 1 && daysToOvulation >= 0) {
          body = "তুমি এখন ডিম্বস্ফোটন (উর্বর) সময়ে আছো ✨";
        } else if (p.phaseName === "লুটিয়াল পর্যায়") {
          body = "লুটিয়াল ফেজ চলছে। পর্যাপ্ত বিশ্রাম ও পানি পান করো 🌿";
        }
      }

      this.sendLocalNotification(title, body);
      localStorage.setItem(lastFireKey, "true");
    }
  },

  sendLocalNotification(title, body) {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body: body,
            icon: '/icon.svg',
            badge: '/icon.svg',
            vibrate: [200, 100, 200]
          }).catch(() => {});
        });
      } else {
        new Notification(title, { body: body, icon: '/icon.svg' });
      }
    } catch (e) {
      console.warn('Notification delivery fallback', e);
    }
  }
};

window.app = app;

function boot() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(err => {
        console.warn('SW registration skipped: ', err);
      });
    });
  }
  app.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  setTimeout(boot, 10);
}
