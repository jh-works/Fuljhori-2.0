const STATE = {
  profile: null,
  periods: [],
  logs: {},
  settings: { theme: 'light' }
};

function toBanglaNumber(num) {
  if (num == null) return '';
  const e2b = {'0':'০', '1':'১', '2':'২', '3':'৩', '4':'৪', '5':'৫', '6':'৬', '7':'৭', '8':'৮', '9':'৯'};
  return String(num).split('').map(c => e2b[c] || c).join('');
}
window.toBanglaNumber = toBanglaNumber;

function formatBanglaDate(dateObj) {
  const bnMonths = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  const bnDays = ['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];
  return `${toBanglaNumber(dateObj.getDate())} ${bnMonths[dateObj.getMonth()]}, ${toBanglaNumber(dateObj.getFullYear())}`;
}

function formatBanglaShortDate(dateObj) {
  const bnMonths = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  return `${toBanglaNumber(dateObj.getDate())} ${bnMonths[dateObj.getMonth()]}`;
}

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

function getLocalDateString(dateObj) {
  if (!dateObj) return '';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const app = {
  charts: {},
  pendingAction: null,
  isEditingNotes: false,

  confirmAction(actionType) {
      this.pendingAction = actionType;
      const modal = document.getElementById('confirm-modal');
      const title = document.getElementById('confirm-title');
      const msg = document.getElementById('confirm-msg');
      const btn = document.getElementById('confirm-action-btn');

      if (actionType === 'reset_data') {
          title.innerText = 'সব ডেটা মুছে ফেলুন?';
          msg.innerText = 'এর ফলে অ্যাপের সব রেকর্ড চিরতরে মুছে যাবে।';
          btn.style.background = '#D32F2F';
          btn.innerText = 'মুছে ফেলুন';
      } else if (actionType === 'reset_settings') {
          title.innerText = 'সেটিংস রিসেট?';
          msg.innerText = 'অ্যাপের থিম এবং অন্যান্য সেটিংস ডিফল্ট হয়ে যাবে।';
          btn.style.background = 'var(--primary)';
          btn.innerText = 'রিসেট করুন';
      } else if (actionType === 'remove_pin_init') {
          title.innerText = 'পিন বন্ধ করবেন?';
          msg.innerText = 'এর ফলে অ্যাপের নিরাপত্তার পিন মুছে যাবে।';
          btn.style.background = 'var(--primary)';
          btn.innerText = 'নিশ্চিত করুন';
      }

      modal.classList.remove('hidden');

      btn.onclick = () => {
          this.executePendingAction();
          this.closeConfirm();
      };
  },

  closeConfirm() {
      document.getElementById('confirm-modal').classList.add('hidden');
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
      }
  },

  getThemeColor(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  },

  safeVibrate(pattern) {
      try {
          if ('vibrate' in navigator) navigator.vibrate(pattern);
      } catch(e) {}
  },

  init() {
    // Global Error Protection
    window.onerror = (message, source, lineno, colno, error) => {
        console.error('App safely handled crash:', error);
        this.showToast('⚠️ একটি সাময়িক ত্রুটি হয়েছিল, অ্যাপ সচল রাখা হয়েছে।');
        return true; // Prevent default error UI
    };

    window.addEventListener('unhandledrejection', (event) => {
        console.warn('Unhandled Promise:', event.reason);
        // Do not crash the app
    });

    window.addEventListener('beforeunload', (e) => {
        if (this.isEditingNotes) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    this.loadData();
    this.applyTheme();
    this.calContextDate = new Date();
    this.calContextDate.setDate(1);

    // Initialize UI Polish
    this.createPetals();
    this.initRipples();
    
    // Splash screen logic
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
            
            setTimeout(() => splash.remove(), 600); // Remove from DOM after fade
        }, 1800);
    } else {
        if (STATE.settings?.pinEnabled && !sessionStorage.getItem('fz_unlocked')) {
            this.showLockScreen('verify');
            return;
        }
        this.bootMainApp();
        this.startReminderService();
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
              
              const currentPosition = window.getComputedStyle(btn).position;
              if (currentPosition === 'static') {
                  btn.style.position = 'relative';
              }
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

  createPetals() {
      const container = document.getElementById('petals-container');
      if (!container) return;
      
      const isDarkMode = document.documentElement.getAttribute('data-theme') === 'night-bloom';
      const colors = isDarkMode 
          ? ['rgba(255, 127, 165, 0.05)', 'rgba(216, 27, 96, 0.05)', 'rgba(244, 143, 177, 0.05)']
          : ['rgba(255, 182, 193, 0.3)', 'rgba(255, 192, 203, 0.3)', 'rgba(255, 105, 180, 0.2)'];
          
      // Minimal petals to avoid lag on mobile
      const numPetals = 6;
      container.innerHTML = '';
      
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

  initBottomSheets() {
    let startY = 0;
    let currentY = 0;
    const grip = document.getElementById('day-sheet-grip');
    const content = document.getElementById('day-sheet-content');
    if (!grip || !content) return;

    grip.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        content.style.transition = 'none';
    }, {passive: true});

    grip.addEventListener('touchmove', (e) => {
        currentY = e.touches[0].clientY;
        const delta = currentY - startY;
        if (delta > 0) {
            content.style.transform = `translateY(${delta}px)`;
        }
    }, {passive: false});

    grip.addEventListener('touchend', (e) => {
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

  nextOnboardingSlide(slideNum) {
    const slider = document.getElementById('onboarding-slider');
    if (!slider) return;
    
    // Smooth swipe
    slider.style.transform = `translateX(-${(slideNum - 1) * 33.333}%)`;
    
    // Update dots
    document.querySelectorAll('.ob-pagination-group').forEach(group => {
        group.querySelectorAll('.ob-dot').forEach((dot, idx) => {
            if (idx === (slideNum - 1)) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    });

    // If reaching Slide 3, trigger success animation
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
        const age = document.getElementById('ob-setup-age').value;
        const lastP = document.getElementById('ob-setup-last-period').value;
        const name = document.getElementById('ob-setup-name').value;
        
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
            return; // Prevent progressing
        }
    }
    
    this.nextOnboardingSlide(slideNum);
  },

  finishOnboardingSafe() {
    const name = document.getElementById('ob-setup-name').value;
    const lastP = document.getElementById('ob-setup-last-period').value;
    const cycle = parseInt(document.getElementById('ob-setup-cycle').value) || 28;
    const period = parseInt(document.getElementById('ob-setup-period').value) || 5;

    STATE.profile = { 
        name: name || '',
        setupDone: true,
        cycleLength: cycle,
        periodLength: period
    };
    
    const start = new Date(lastP);
    const end = new Date(start);
    end.setDate(end.getDate() + period - 1);
    
    STATE.periods = [{
      start: lastP,
      end: getLocalDateString(end)
    }];

    this.saveData('fz_profile', STATE.profile);
    this.saveData('fz_periods', STATE.periods);
    this.saveData('fz_logs', STATE.logs || {});
    this.saveData('fz_settings', STATE.settings || { theme: 'rose-bloom' });

    document.getElementById('view-onboarding').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    this.renderHome();
    this.renderSettings();
    this.safeVibrate(50);
  },

  safeParseJSON(str, fallback) {
    if (!str) return fallback;
    try {
        return JSON.parse(str);
    } catch (e) {
        return fallback;
    }
  },

  resetCorruptedData(key, defStr) {
     try {
         localStorage.setItem(key, defStr);
         this.showToast('🌸 অ্যাপ স্বয়ংক্রিয়ভাবে কিছু তথ্য ঠিক করেছে');
     } catch(e) {}
  },

  safeGetStorage(key, defStr) {
    try {
      const val = localStorage.getItem(key);
      if (val === null || val === undefined) return this.safeParseJSON(defStr, null);
      try {
         const parsed = JSON.parse(val);
         if (parsed === null && defStr !== 'null') {
             this.resetCorruptedData(key, defStr);
             return this.safeParseJSON(defStr, null);
         }
         return parsed;
      } catch (e) {
         this.resetCorruptedData(key, defStr);
         return this.safeParseJSON(defStr, null);
      }
    } catch (e) {
      return this.safeParseJSON(defStr, null);
    }
  },

  safeSetStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch(e) {
      console.warn("Storage error", e);
    }
  },

  loadData() {
    STATE.profile = this.safeGetStorage('fz_profile', 'null');
    STATE.periods = this.safeGetStorage('fz_periods', '[]');
    STATE.logs = this.safeGetStorage('fz_logs', '{}');
    STATE.settings = this.safeGetStorage('fz_settings', '{"theme": "rose-bloom"}');
    STATE.streak = this.safeGetStorage('fz_streak', '{"current":0, "longest":0, "lastDate":null}');
    
    // Fallback structures
    if (!Array.isArray(STATE.periods)) STATE.periods = [];
    if (typeof STATE.logs !== 'object' || STATE.logs === null) STATE.logs = {};
    if (typeof STATE.settings !== 'object' || STATE.settings === null) STATE.settings = { theme: 'rose-bloom' };
    if (typeof STATE.streak !== 'object' || STATE.streak === null) STATE.streak = { current:0, longest:0, lastDate:null };
  },

  saveData(key, data) {
    this.safeSetStorage(key, data);
  },

  finishOnboarding() {
    const name = document.getElementById('setup-name').value;
    const lastP = document.getElementById('setup-last-period').value;
    
    if(!name || !lastP) {
      alert("অনুগ্রহ করে সব তথ্য দিন।");
      return;
    }

    STATE.profile = { name };
    const start = new Date(lastP);
    const end = new Date(start);
    end.setDate(end.getDate() + 4);
    
    STATE.periods.push({
      start: lastP,
      end: getLocalDateString(end)
    });

    this.saveData('fz_profile', STATE.profile);
    this.saveData('fz_periods', STATE.periods);

    document.getElementById('view-onboarding').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    this.renderHome();
    this.renderSettings();
  },

  updateGreeting() {
    if(!STATE.profile) return;
    const greetingEl = document.getElementById('greeting-name');
    if (!greetingEl) return;
    const newGreeting = getGreetingByTime(STATE.profile.name);
    
    if (greetingEl.innerText !== newGreeting) {
       greetingEl.style.opacity = 0;
       setTimeout(() => {
           greetingEl.innerText = newGreeting;
           greetingEl.style.transition = "opacity 0.4s ease-in-out";
           greetingEl.style.opacity = 1;
       }, 200);
    }
  },

  renderHome() {
    if(!STATE.profile) return;
    
    this.updateGreeting();
    document.getElementById('home-date').innerText = formatBanglaDate(new Date());

    if (!window.greetingInterval) {
        window.greetingInterval = setInterval(() => this.updateGreeting(), 60000);
    }

    this.calculatePredictions();

    if(this.predictions) {
      document.getElementById('ring-day-num').innerText = `দিন ${toBanglaNumber(this.predictions.cycleDay)}`;
      document.getElementById('ring-phase-badge').innerText = this.predictions.phaseName;
      
      const cycleRing = document.getElementById('cycle-ring');
      if (cycleRing) {
          if (this.predictions.phaseName === "ডিম্বস্ফোটনের সময়") {
              cycleRing.classList.add('heartbeat');
          } else {
              cycleRing.classList.remove('heartbeat');
          }
      }

      const ringProgress = document.getElementById('ring-progress');
      if (ringProgress) {
          ringProgress.style.stroke = this.predictions.phaseColor;
          const ratio = Math.min(this.predictions.cycleDay / 28, 1);
          const offset = 283 - (283 * ratio);
          // Add a short delay for animation
          setTimeout(() => {
              ringProgress.style.strokeDashoffset = offset;
          }, 100);
      }

      document.getElementById('chip-next-period').innerText = formatBanglaShortDate(this.predictions.nextPeriodStart);
      const chipCycleLengthEl = document.getElementById('chip-cycle-length');
      if (chipCycleLengthEl) chipCycleLengthEl.innerText = toBanglaNumber(STATE.profile.cycleLength || 28) + ' দিন';
      const chipPeriodLengthEl = document.getElementById('chip-period-length');
      if (chipPeriodLengthEl) chipPeriodLengthEl.innerText = toBanglaNumber(STATE.profile.periodLength || 5) + ' দিন';

      // We just dynamically handle the color class, mostly we can just override text color via inline style or replace class.
      const phaseCard = document.getElementById('home-phase-card');
      if (phaseCard) {
          phaseCard.style.background = `radial-gradient(circle at top right, color-mix(in srgb, ${this.predictions.phaseColor} 15%, transparent), var(--card))`;
      }

      document.getElementById('home-advice').innerText = this.predictions.advice;

      // Update Wellness Banner
      const wellnessSubtitle = document.getElementById('home-wellness-subtitle');
      if (wellnessSubtitle) {
        if (this.predictions.phaseName === "মাসিকের সময়") {
           wellnessSubtitle.innerText = "আজ শরীরকে একটু আরাম দাও। বেশি চাপ নিও না আজ।";
        } else if (this.predictions.phaseName === "ফলিকুলার পর্যায়") {
           wellnessSubtitle.innerText = "আজ হালকা কিছু খেলে ভালো লাগতে পারে। নিজের জন্য একটু সময় বের করো।";
        } else if (this.predictions.phaseName === "ডিম্বস্ফোটনের সময়") {
           wellnessSubtitle.innerText = "একটু পানি খাও, শরীর ভালো থাকবে। আজ তোমার এনার্জি বেশ ভালো থাকার কথা।";
        } else {
           wellnessSubtitle.innerText = "বেশি চাপ নিও না আজ। একটু রিল্যাক্স করো, ঘুমটা ঠিকঠাক হতে দাও।";
        }
      }
    }

    // Streak & Mood calculation
    this.updateStreakAndMoods();

    // Home Cycle Analysis Insight
    const periods = [...(STATE.periods || [])].sort((a,b) => new Date(a.start) - new Date(b.start));
    let cycleLengths = [];
    for (let i = 1; i < periods.length; i++) {
        const pStart = new Date(periods[i].start);
        const prevPStart = new Date(periods[i-1].start);
        let cLen = Math.floor((pStart - prevPStart) / (1000 * 60 * 60 * 24));
        cycleLengths.push(cLen);
    }
    this.renderCycleAnalysis(cycleLengths);
  },

  updateStreakAndMoods() {
    if (!STATE.logs) return;
    
    // Sort logs by date descending
    const logDates = Object.keys(STATE.logs).sort((a,b) => new Date(b) - new Date(a));
    if (logDates.length === 0) return;

    // Calculate Streak
    let streakCount = 0;
    let longestStreak = 0;
    let currentStreakCount = 0;
    
    const sortedAsc = Object.keys(STATE.logs).sort((a,b) => new Date(a) - new Date(b));
    let lastDate = null;
    sortedAsc.forEach((d) => {
        if (!lastDate) { currentStreakCount = 1; longestStreak = 1; }
        else {
            const diffDays = Math.ceil((new Date(d) - new Date(lastDate)) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                currentStreakCount++;
            } else if (diffDays > 1) {
                currentStreakCount = 1;
            }
        }
        if (currentStreakCount > longestStreak) longestStreak = currentStreakCount;
        lastDate = d;
    });

    // Determine current active streak
    const todayStr = new Date().toISOString().split('T')[0];
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().split('T')[0];
    
    if (STATE.logs[todayStr]) {
        let i = sortedAsc.indexOf(todayStr);
        let currStrk = 1;
        while(i > 0 && Math.ceil((new Date(sortedAsc[i]) - new Date(sortedAsc[i-1])) / (1000 * 60 * 60 * 24)) === 1) {
            currStrk++; i--;
        }
        streakCount = currStrk;
    } else if (STATE.logs[yestStr]) {
        let i = sortedAsc.indexOf(yestStr);
        let currStrk = 1;
        while(i > 0 && Math.ceil((new Date(sortedAsc[i]) - new Date(sortedAsc[i-1])) / (1000 * 60 * 60 * 24)) === 1) {
            currStrk++; i--;
        }
        streakCount = currStrk;
    } else {
        streakCount = 0;
    }

    const streakCurrentEl = document.getElementById('streak-current');
    if (streakCurrentEl) streakCurrentEl.innerText = toBanglaNumber(streakCount) + ' দিন';

    const streakLongestEl = document.getElementById('streak-longest');
    if (streakLongestEl) streakLongestEl.innerText = toBanglaNumber(longestStreak) + ' দিন';

    // Update Mood Timeline
    const moodTimelineEl = document.querySelector('.mood-timeline');
    if (moodTimelineEl) {
        let moodHtml = '';
        // Last 5 days
        for (let i = 0; i < 5; i++) {
            let d = new Date();
            d.setDate(d.getDate() - i);
            const dStr = d.toISOString().split('T')[0];
            const mood = STATE.logs[dStr]?.mood || null;
            let displayMood = mood ? mood.split(' ')[0] : '➖'; // Extract emoji
            
            let dateLabel = '';
            if (i === 0) dateLabel = 'আজ';
            else if (i === 1) dateLabel = 'কাল';
            else dateLabel = formatBanglaShortDate(d);

            moodHtml += `
                <div style="text-align: center;">
                  <div style="font-size: 1.75rem;">${displayMood}</div>
                  <small class="text-muted" style="font-size: 0.7rem; display: block; margin-top: 4px;">${dateLabel}</small>
                </div>
            `;
        }
        // reverse array logic in html to show chronological if wanted, but it's okay to show latest first.
        // Actually, right to left or left to right? 0 index is today. So let's reverse so today is on the right.
        
        let moodHtmlRev = '';
        for (let i = 4; i >= 0; i--) {
            let d = new Date();
            d.setDate(d.getDate() - i);
            const dStr = d.toISOString().split('T')[0];
            const mood = STATE.logs[dStr]?.mood || null;
            let displayMood = mood ? mood.split(' ')[0] : '➖'; 
            
            let dateLabel = '';
            if (i === 0) dateLabel = 'আজ';
            else if (i === 1) dateLabel = 'কাল';
            else dateLabel = formatBanglaShortDate(d);

            moodHtmlRev += `
                <div style="text-align: center;">
                  <div style="font-size: 1.75rem;">${displayMood}</div>
                  <small class="text-muted" style="font-size: 0.7rem; display: block; margin-top: 4px;">${dateLabel}</small>
                </div>
            `;
        }

        moodTimelineEl.innerHTML = moodHtmlRev;
    }

    // Update Recent Insights
    const insightsContainer = document.getElementById('home-insights');
    if (insightsContainer) {
        let insights = [];
        
        let sleepCount = 0, lowSleepCount = 0;
        let painCount = 0;
        let happyMoods = 0, sadMoods = 0, irritatedMoods = 0;
        let goodEnergy = 0;

        // check last 14 days
        const limitDate = new Date();
        limitDate.setDate(limitDate.getDate() - 14);
        
        for (let i = 0; i < sortedAsc.length; i++) {
           const dStr = sortedAsc[i];
           if (new Date(dStr) >= limitDate) {
               const l = STATE.logs[dStr];
               if (l) {
                   if (l.sleep) {
                       sleepCount++;
                       if (l.sleep.includes('৩-৫') || l.sleep.includes('০-৩')) lowSleepCount++;
                   }
                   if (l.symptoms && Array.isArray(l.symptoms) && l.symptoms.includes('পেট ব্যথা')) painCount++;
                   if (l.mood) {
                       if (l.mood.includes('খুশি') || l.mood.includes('শান্ত')) happyMoods++;
                       else if (l.mood.includes('দুঃখিত')) sadMoods++;
                       else if (l.mood.includes('বিরক্ত')) irritatedMoods++;
                   }
                   if (l.energy && (l.energy.includes('শক্তিশালী') || l.energy.includes('স্বাভাবিক'))) goodEnergy++;
               }
           }
        }

        if (lowSleepCount >= 2) insights.push({icon: '😴', text: 'কম ঘুমের দিনে ক্লান্তি বেশি ছিল'});
        else if (sleepCount >= 3 && lowSleepCount === 0) insights.push({icon: '🌿', text: 'গত কদিন তোমার ঘুম বেশ ভালো ছিল'});
        
        if (painCount >= 2) insights.push({icon: '💢', text: 'ব্যথার লগ সম্প্রতি একটু বেশি'});
        
        if (irritatedMoods >= 2) insights.push({icon: '🌙', text: 'শেষ কয়েকদিন একটু বিরক্ত লাগছিল'});
        else if (happyMoods >= 3) insights.push({icon: '😊', text: 'এই সপ্তাহে মুড মোটামুটি ভালো ছিল'});

        if (goodEnergy >= 3) insights.push({icon: '⚡', text: 'এই সপ্তাহে এনার্জি একটু ভালো ছিল'});

        let html = '';
        if (insights.length === 0) {
            html = `
                <div class="card" style="min-width: 200px; flex: 0 0 auto; scroll-snap-align: start; padding: 1rem; border-radius: 20px; border: 1px solid rgba(255,107,158,0.1); background: linear-gradient(135deg, rgba(255, 64, 129, 0.03), rgba(255, 107, 158, 0.01));">
                  <span style="font-size: 1.25rem; margin-bottom: 0.5rem; display: block;">🌸</span>
                  <p style="font-size: 0.9rem; font-weight: 500; line-height: 1.4; color: var(--text);">আরও কিছুদিন লগ করলে এখানে তোমার প্যাটার্ন দেখাবে</p>
                </div>
            `;
        } else {
            insights.forEach((ins, idx) => {
                const colors = [
                    'rgba(255, 64, 129, 0.05), rgba(255, 107, 158, 0.02)',
                    'rgba(78, 205, 196, 0.05), rgba(85, 98, 112, 0.02)',
                    'rgba(255, 169, 169, 0.05), rgba(255, 209, 148, 0.02)'
                ];
                const bg = colors[idx % colors.length];
                html += `
                <div class="card" style="min-width: 220px; flex: 0 0 auto; scroll-snap-align: start; padding: 1.25rem; border-radius: 20px; background: linear-gradient(135deg, ${bg}); transition: transform 0.2s;">
                  <span style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;">${ins.icon}</span>
                  <p class="font-medium" style="font-size: 0.95rem; line-height: 1.5;">${ins.text}</p>
                </div>
                `;
            });
        }
        
        insightsContainer.innerHTML = html;
    }
  },

  calculatePredictions() {
    if(!STATE.periods || STATE.periods.length === 0) return;
    
    // Sort periods
    STATE.periods.sort((a,b) => new Date(a.start) - new Date(b.start));
    const lastPeriod = STATE.periods[STATE.periods.length - 1];
    
    const cycleLength = STATE.profile.cycleLength || 28;
    const periodLength = STATE.profile.periodLength || 5;
    
    const lpStart = new Date(lastPeriod.start);
    const today = new Date();
    // remove time padding
    lpStart.setHours(0,0,0,0);
    today.setHours(0,0,0,0);

    const diffTime = today - lpStart;
    let cycleDay = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (cycleDay < 1) cycleDay = 1;
    
    const nextPeriodStart = new Date(lpStart);
    nextPeriodStart.setDate(nextPeriodStart.getDate() + cycleLength);

    const ovulationDate = new Date(nextPeriodStart);
    ovulationDate.setDate(ovulationDate.getDate() - 14);

    const fertileStart = new Date(ovulationDate);
    fertileStart.setDate(fertileStart.getDate() - 2);

    const fertileEnd = new Date(ovulationDate);
    fertileEnd.setDate(fertileEnd.getDate() + 2);

    const periodEnd = new Date(lpStart);
    periodEnd.setDate(periodEnd.getDate() + periodLength - 1);

    let phaseName = "";
    let phaseColor = "";
    let phaseColorTitle = "";
    let advice = "";

    if (today <= periodEnd) {
      phaseName = "মাসিকের সময়";
      phaseColor = "var(--primary)"; 
      phaseColorTitle = "var(--primary)";
      advice = "শরীরটা আজ একটু স্লো যেতে চাইতে পারে 🌙";
    } else if (today < fertileStart) {
      phaseName = "ফলিকুলার পর্যায়";
      phaseColor = "var(--secondary)"; 
      phaseColorTitle = "var(--accent)";
      advice = "আজকে এনার্জি একটু ভালো থাকতে পারে 🌱";
    } else if (today >= fertileStart && today <= fertileEnd) {
      phaseName = "ডিম্বস্ফোটনের সময়";
      phaseColor = "var(--accent)"; 
      phaseColorTitle = "var(--accent)";
      advice = "আজ কাজকর্মে মন ভালো থাকতে পারে 🌟";
    } else {
      phaseName = "লুটিয়াল পর্যায়";
      phaseColor = "#FFB300"; // yellow
      phaseColorTitle = "#D89A00";
      advice = "আজ একটু রেস্ট নিলে ভালো লাগতে পারে 💕";
    }
    
    this.predictions = {
      cycleDay,
      nextPeriodStart,
      ovulationDate,
      phaseName,
      phaseColor,
      phaseColorTitle,
      advice,
      cycleLength,
      fertileStart,
      fertileEnd
    };
  },

  renderSettings() {
    if(STATE.profile) {
      document.getElementById('settings-name').value = STATE.profile.name;
    }
    const currentTheme = STATE.settings?.theme || 'rose-bloom';
    document.querySelectorAll('.theme-card').forEach(card => {
        card.style.borderColor = 'transparent';
        card.style.background = 'rgba(0,0,0,0.02)';
        const themeId = card.id.replace('theme-card-', '');
        if (themeId === currentTheme || (currentTheme === 'light' && themeId === 'rose-bloom') || (currentTheme === 'dark' && themeId === 'night-bloom')) {
            card.style.borderColor = 'var(--primary)';
            card.style.background = 'rgba(0,0,0,0.05)';
        }
    });

    const pinToggle = document.getElementById('pin-toggle');
    const changePinWrapper = document.getElementById('change-pin-wrapper');
    if (STATE.settings?.pinEnabled) {
        pinToggle.classList.add('active');
        changePinWrapper.classList.remove('hidden');
    } else {
        pinToggle.classList.remove('active');
        changePinWrapper.classList.add('hidden');
    }

    const reminderToggle = document.getElementById('reminder-toggle');
    const reminderTimeWrapper = document.getElementById('reminder-time-wrapper');
    const reminderTimeInput = document.getElementById('reminder-time');

    if (STATE.settings?.remindersEnabled) {
        reminderToggle.classList.add('active');
        reminderTimeWrapper.classList.remove('hidden');
    } else {
        reminderToggle.classList.remove('active');
        reminderTimeWrapper.classList.add('hidden');
    }

    if (STATE.settings?.reminderTime) {
        reminderTimeInput.value = STATE.settings.reminderTime;
    }
  },

  prevMonth() {
    this.calContextDate.setMonth(this.calContextDate.getMonth() - 1);
    this.renderCalendar();
  },

  nextMonth() {
    this.calContextDate.setMonth(this.calContextDate.getMonth() + 1);
    this.renderCalendar();
  },

  renderCalendar() {
    if (!this.predictions) this.calculatePredictions();
    const d = this.calContextDate;
    const month = d.getMonth();
    const year = d.getFullYear();
    
    const bnMonths = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
    document.getElementById('cal-month-year').innerText = `${bnMonths[month]} ${toBanglaNumber(year)}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calDaysContainer = document.getElementById('cal-days');
    if (!calDaysContainer) return;
    calDaysContainer.innerHTML = '';

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
      const cell = document.createElement('div');
      cell.className = 'cal-day-cell empty';
      calDaysContainer.appendChild(cell);
    }

    const todayStr = getLocalDateString(new Date());

    const isDateInPeriod = (dateStr) => {
       if(!STATE.periods) return false;
       return STATE.periods.some(p => dateStr >= p.start && dateStr <= p.end);
    };

    const nextPStart = getLocalDateString(this.predictions?.nextPeriodStart);
    const nPeriodLen = STATE.profile?.periodLength || 5;
    const nextPEndObj = new Date(this.predictions?.nextPeriodStart || new Date());
    nextPEndObj.setDate(nextPEndObj.getDate() + nPeriodLen - 1);
    const nextPEnd = getLocalDateString(nextPEndObj);

    const fertStart = getLocalDateString(this.predictions?.fertileStart);
    const fertEnd = getLocalDateString(this.predictions?.fertileEnd);
    const ovulDate = getLocalDateString(this.predictions?.ovulationDate);

    // Days cells
    for (let i = 1; i <= daysInMonth; i++) {
       const cellDate = new Date(year, month, i);
       cellDate.setHours(0,0,0,0);
       const ds = getLocalDateString(cellDate);

       const cell = document.createElement('div');
       cell.className = 'cal-day-cell';
       cell.innerText = toBanglaNumber(i);

       if (ds === todayStr) {
         cell.classList.add('today');
       }

       let statusInfo = '';
       if (isDateInPeriod(ds)) {
         cell.classList.add('period');
         statusInfo = 'পিরিয়ড চলছে';
       } else if (nextPStart && ds >= nextPStart && ds <= nextPEnd) {
         cell.classList.add('period');
         cell.style.opacity = '0.5'; // predict period
         statusInfo = 'সম্ভাব্য পিরিয়ড';
       } else if (fertStart && ds >= fertStart && ds <= fertEnd) {
         if (ds === ovulDate) {
             cell.classList.add('ovulation');
             statusInfo = 'ডিম্বস্ফোটন';
          } else {
             cell.classList.add('fertile');
             statusInfo = 'উর্বর সময়';
          }
        }

        if (STATE.logs && STATE.logs[ds]) {
           const logEl = document.createElement('div');
           logEl.style.width = '4px';
           logEl.style.height = '4px';
           logEl.style.borderRadius = '50%';
           logEl.style.backgroundColor = 'currentColor';
           logEl.style.marginTop = '2px';
           logEl.style.opacity = '0.7';
           cell.appendChild(logEl);
        }

        cell.onclick = () => this.openDayModal(ds, statusInfo);
        calDaysContainer.appendChild(cell);
     }
  },

  openDayModal(dateStr, phaseInfo) {
    this._currentModalDate = dateStr;
    document.getElementById('modal-date-title').innerText = formatBanglaShortDate(new Date(dateStr));
    
    let html = '';
    if (phaseInfo) {
        html += `<div class="mb-4 text-primary font-medium">${phaseInfo}</div>`;
    }

    const l = STATE.logs ? STATE.logs[dateStr] : null;
    if (l) {
        html += `<h4 class="mb-2">লগ করা তথ্য</h4>`;
        if (l.mood) html += `<div class="mb-2 text-sm"><strong>মেজাজ:</strong> ${l.mood}</div>`;
        if (l.symptoms && l.symptoms.length > 0) html += `<div class="mb-2 text-sm"><strong>লক্ষণ:</strong> ${l.symptoms.join(', ')}</div>`;
        if (l.flow) html += `<div class="mb-2 text-sm"><strong>ফ্লো:</strong> ${l.flow}</div>`;
        if (l.sleep) html += `<div class="mb-2 text-sm"><strong>ঘুম:</strong> ${l.sleep}</div>`;
        if (l.energy) html += `<div class="mb-2 text-sm"><strong>শক্তি:</strong> ${l.energy}</div>`;
        if (l.notes) html += `<div class="mb-2 text-sm"><strong>নোট:</strong> ${l.notes}</div>`;
    } else {
        html += `<div class="text-sm text-muted">এই দিনে কোনো লগ যোগ করা হয়নি।</div>`;
    }

    document.getElementById('modal-content-details').innerHTML = html;

    const btnPeriod = document.getElementById('mark-period-btn');
    const todayStr = getLocalDateString(new Date());
    
    // Only show if date is today or past, and it's not already in period
    const isPeriod = STATE.periods && STATE.periods.some(p => dateStr >= p.start && dateStr <= p.end);
    if (!isPeriod && dateStr <= todayStr) {
        btnPeriod.style.display = 'block';
    } else {
        btnPeriod.style.display = 'none';
    }

    document.getElementById('day-modal').classList.remove('hidden');
  },

  markPeriodOngoing() {
    if (!this._currentModalDate) return;
    const dStr = this._currentModalDate;
    
    if(!STATE.logs) STATE.logs = {};
    if(!STATE.logs[dStr]) STATE.logs[dStr] = {};
    
    // Set a default flow to indicate period
    if (!STATE.logs[dStr].flow) {
        STATE.logs[dStr].flow = 'মাঝারি'; // Default flow
    }
    this.saveData('fz_logs', STATE.logs);

    // Update periods
    if(!STATE.periods) STATE.periods = [];
    
    // Try to extend an existing period if it's adjacent (e.g., dStr is 1 day after end of a period)
    const dTime = new Date(dStr).getTime();
    let extended = false;
    for (let i = 0; i < STATE.periods.length; i++) {
        const p = STATE.periods[i];
        const pEndTime = new Date(p.end).getTime();
        const diffDays = Math.round((dTime - pEndTime) / (1000 * 60 * 60 * 24));
        if (diffDays >= 1 && diffDays <= 3) {
            p.end = dStr;
            extended = true;
            break;
        }
    }
    
    if (!extended) {
        // Create new period record starting and ending on this day
        STATE.periods.push({ start: dStr, end: dStr });
        STATE.periods.sort((a,b) => new Date(a.start) - new Date(b.start));
    }
    
    this.saveData('fz_periods', STATE.periods);
    
    this.calculatePredictions();
    this.renderHome();
    this.renderCalendar();
    
    this.closeDayModal();
    this.showToast('✅ পিরিয়ড লগ করা হয়েছে!');
    this.safeVibrate(50);
  },

  closeDayModal(e) {
    if(e && e.target !== document.getElementById('day-modal') && !e.target.classList.contains('close-btn')) return;
    document.getElementById('day-modal').classList.add('hidden');
  },

  openWellness() {
    if (!this.predictions) return;
    let contentHtml = "";
    
    if (this.predictions.phaseName === "মাসিকের সময়") {
        contentHtml = `
            <div class="card mb-4" style="border-left: 4px solid var(--primary)">
                <h4 class="mb-2">🍎 খাবারদাবার</h4>
                <p class="text-sm text-muted">আয়রন আছে এমন খাবার (যেমন- কলিজা, কচুশাক, ডাল) এবং ভিটামিন সি (লেবু, কমলা) একটু বেশি খেও। গরম স্যুপ বা চা আরাম দিতে পারে।</p>
            </div>
            <div class="card mb-4" style="border-left: 4px solid var(--secondary)">
                <h4 class="mb-2">💧 পানি ও পুষ্টি</h4>
                <p class="text-sm text-muted">পানি একটু বেশি খাওয়ার চেষ্টা করো। হালকা গরম পানি খেলে পেটের ব্লোটিং ভাব কমতে পারে।</p>
            </div>
            <div class="card mb-4" style="border-left: 4px solid var(--accent)">
                <h4 class="mb-2">🧘‍♀️ ছোটখাটো মুভমেন্ট</h4>
                <p class="text-sm text-muted">ভারী কিছু করার দরকার নেই। একটু হাঁটাহাঁটি বা হালকা স্ট্রেচিং করলে শরীরটা ফ্রি লাগবে।</p>
            </div>
            <div class="card mb-2" style="border-left: 4px solid #FF9A9E">
                <h4 class="mb-2">🌸 নিজের খেয়াল</h4>
                <p class="text-sm text-muted">বেশি প্রেশার নিও না। ঘুমটা ঠিকঠাক হতে দাও, একটু রিল্যাক্স করো।</p>
            </div>
        `;
    } else if (this.predictions.phaseName === "ফলিকুলার পর্যায়") {
        contentHtml = `
            <div class="card mb-4" style="border-left: 4px solid var(--primary)">
                <h4 class="mb-2">🍎 খাবারদাবার</h4>
                <p class="text-sm text-muted">তাজা ফলমূল আর একটু প্রোটিন খেলে বেশ ভালো লাগবে। শরীরে নতুন করে এনার্জি জমতে শুরু করেছে।</p>
            </div>
            <div class="card mb-4" style="border-left: 4px solid var(--secondary)">
                <h4 class="mb-2">💧 পানি ও পুষ্টি</h4>
                <p class="text-sm text-muted">শরীরের নতুন এনার্জি ধরে রাখতে পানি বা ফলের রস একটু বেশি করে খেতে পারো।</p>
            </div>
            <div class="card mb-4" style="border-left: 4px solid var(--accent)">
                <h4 class="mb-2">🏃‍♀️ নিজেকে এ্যাকটিভ রাখা</h4>
                <p class="text-sm text-muted">শরীর এখন বেশ ফুরফুরে! একটু জগিং বা হালকা ব্যায়াম শুরু করার দারুণ সময় এটা।</p>
            </div>
            <div class="card mb-2" style="border-left: 4px solid #FF9A9E">
                <h4 class="mb-2">🌸 নিজের খেয়াল</h4>
                <p class="text-sm text-muted">নতুন কোনো প্ল্যান বা কাজ শুরু করার জন্য এখন বেশ ভালো ফিল হবে।</p>
            </div>
        `;
    } else if (this.predictions.phaseName === "ডিম্বস্ফোটনের সময়") {
        contentHtml = `
            <div class="card mb-4" style="border-left: 4px solid var(--primary)">
                <h4 class="mb-2">🍎 খাবারদাবার</h4>
                <p class="text-sm text-muted">হালকা খাবার যেমন- সালাদ বা লেবুর শরবত দারুণ উপকারী হতে পারে।</p>
            </div>
            <div class="card mb-4" style="border-left: 4px solid var(--secondary)">
                <h4 class="mb-2">💧 পানি ও পুষ্টি</h4>
                <p class="text-sm text-muted">পানি খাওয়াটা কন্টিনিউ করো। ডাবের পানিও খেতে পারো, শরীর ঠাণ্ডা থাকবে।</p>
            </div>
            <div class="card mb-4" style="border-left: 4px solid var(--accent)">
                <h4 class="mb-2">🏋️‍♀️ নিজেকে এ্যাকটিভ রাখা</h4>
                <p class="text-sm text-muted">সব ধরণের কাজের জন্যই এখন তোমার প্রচুর এনার্জি আছে। চাইলে একটু বেশি পরিশ্রম করতেই পারো।</p>
            </div>
            <div class="card mb-2" style="border-left: 4px solid #FF9A9E">
                <h4 class="mb-2">🌸 নিজের খেয়াল</h4>
                <p class="text-sm text-muted">তোমার কনফিডেন্স এখন একদম হাই! বন্ধুদের সাথে সময় কাটাও বা একটু বাইরে ঘুরে আসো।</p>
            </div>
        `;
    } else {
        contentHtml = `
            <div class="card mb-4" style="border-left: 4px solid var(--primary)">
                <h4 class="mb-2">🍎 খাবারদাবার</h4>
                <p class="text-sm text-muted">মিষ্টি খেতে ইচ্ছা করতে পারে, তবে একটু বুঝেশুনে খেও। ফল বা হালকা চিনিওয়ালা কিছু ট্রাই করতে পারো।</p>
            </div>
            <div class="card mb-4" style="border-left: 4px solid var(--secondary)">
                <h4 class="mb-2">💧 পানি ও পুষ্টি</h4>
                <p class="text-sm text-muted">পানি ঠিকমতো খেলে এই সময়ে ব্লোটিং বা অস্বস্তি অনেকটাই কমে যাবে।</p>
            </div>
            <div class="card mb-4" style="border-left: 4px solid var(--accent)">
                <h4 class="mb-2">🧘‍♀️ ছোটখাটো মুভমেন্ট</h4>
                <p class="text-sm text-muted">ভারী কাজ না করাই ভালো। হালকা হাঁটা বা স্ট্রেচিং করলে একটু রিল্যাক্সিং লাগবে।</p>
            </div>
            <div class="card mb-2" style="border-left: 4px solid #FF9A9E">
                <h4 class="mb-2">🌸 নিজের খেয়াল</h4>
                <p class="text-sm text-muted">মেজাজ হয়তো একটু সুইং করতে পারে। সমস্যা নেই, নিজেকে সময় দাও, পছন্দের কিছু করো।</p>
            </div>
        `;
    }

    document.getElementById('wellness-dynamic-content').innerHTML = contentHtml;
    document.getElementById('wellness-sheet').classList.remove('hidden');
  },

  closeWellness(e) {
    if(e && e.target !== document.getElementById('wellness-sheet') && !e.target.classList.contains('btn-icon') && !e.target.classList.contains('sheet-handle')) return;
    document.getElementById('wellness-sheet').classList.add('hidden');
    setTimeout(() => this.showAllEducation(), 300); // Reset filter when closed
  },

  toggleBookmark(tipId, event) {
    if (event) event.stopPropagation();
    
    if(!STATE.bookmarks) STATE.bookmarks = {};
    if(STATE.bookmarks[tipId]) {
       delete STATE.bookmarks[tipId];
       event.target.innerText = '☆';
       event.target.style.color = 'var(--text-muted)';
       event.target.classList.remove('bookmarked');
    } else {
       STATE.bookmarks[tipId] = true;
       event.target.innerText = '★';
       event.target.style.color = 'var(--primary)';
       event.target.classList.add('bookmarked');
    }
    this.saveData('fz_bookmarks', STATE.bookmarks);
    this.showToast(STATE.bookmarks[tipId] ? 'বুকমার্ক সংরক্ষিত হয়েছে' : 'বুকমার্ক সরানো হয়েছে');
  },

  showBookmarkedTips() {
    const articles = document.querySelectorAll('#education-articles .accordion-item');
    let count = 0;
    
    articles.forEach(article => {
        const icon = article.querySelector('.bookmark-icon');
        const tipId = icon.getAttribute('onclick').match(/'([^']+)'/)[1];
        
        if (STATE.bookmarks && STATE.bookmarks[tipId]) {
            article.style.display = 'block';
            count++;
        } else {
            article.style.display = 'none';
        }
    });

    const emptyState = document.getElementById('education-empty-state');
    if (count === 0) {
        emptyState.classList.remove('hidden');
        document.getElementById('education-articles').style.display = 'none';
    } else {
        emptyState.classList.add('hidden');
        document.getElementById('education-articles').style.display = 'block';
    }
  },

  showAllEducation() {
    const articles = document.querySelectorAll('#education-articles .accordion-item');
    articles.forEach(article => {
        article.style.display = 'block';
    });
    document.getElementById('education-empty-state').classList.add('hidden');
    document.getElementById('education-articles').style.display = 'block';
  },

  loadBookmarks() {
    const bookmarks = this.safeParseJSON(localStorage.getItem('fz_bookmarks'), {});
    STATE.bookmarks = bookmarks;

    const articles = document.querySelectorAll('#education-articles .accordion-item');
    articles.forEach(article => {
        const icon = article.querySelector('.bookmark-icon');
        const tipId = icon.getAttribute('onclick').match(/'([^']+)'/)[1];
        
        if (bookmarks[tipId]) {
            icon.innerText = '★';
            icon.style.color = 'var(--primary)';
            icon.classList.add('bookmarked');
        }
    });
  },

  saveSettingsProfile() {
    if(STATE.profile) {
        const newName = document.getElementById('settings-name').value;
        STATE.profile.name = newName;
        this.saveData('fz_profile', STATE.profile);
        this.renderHome();
    }
  },

  setTheme(themeName) {
    if(!STATE.settings) STATE.settings = {};
    STATE.settings.theme = themeName;
    this.saveData('fz_settings', STATE.settings);
    this.applyTheme();
    this.renderSettings(); // update active card
    
    // Re-render chart to reflect new theme colors
    if (document.getElementById('view-analytics').classList.contains('active')) {
        this.renderAnalytics();
    }
  },

  applyTheme() {
    let themeToApply = STATE.settings?.theme || 'rose-bloom';
    // Backwards compatibility
    if (themeToApply === 'light') themeToApply = 'rose-bloom';
    if (themeToApply === 'dark') themeToApply = 'night-bloom';

    document.documentElement.setAttribute('data-theme', themeToApply);
    this.createPetals();

    const themeColors = {
        'rose-bloom': '#E75480',
        'lavender-dream': '#9B6B9E',
        'peach-glow': '#F08A5D',
        'night-bloom': '#0A0A0C'
    };
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', themeColors[themeToApply] || '#E75480');
  },

  saveLog() {
    const dStr = document.getElementById('log-date').value;
    const notes = document.getElementById('log-notes').value;
    const energy = document.getElementById('log-energy').value;
    
    const symptoms = [];
    document.querySelectorAll('#symptom-chips .chip-item.active').forEach(c => symptoms.push(c.textContent.trim()));
    
    const moodEl = document.querySelector('#mood-chips .chip-item.active');
    const mood = moodEl ? moodEl.textContent.trim() : '';

    const flowEl = document.querySelector('#flow-chips .chip-item.active');
    const flow = flowEl ? flowEl.textContent.trim() : '';

    const sleepEl = document.querySelector('#sleep-chips .chip-item.active');
    const sleep = sleepEl ? sleepEl.textContent.trim() : '';

    if(!STATE.logs) STATE.logs = {};
    if(!STATE.logs[dStr]) STATE.logs[dStr] = {};
    STATE.logs[dStr] = { symptoms, mood, flow, sleep, energy, notes };
    
    this.saveData('fz_logs', STATE.logs);
    
    this.isEditingNotes = false; // Reset editing state
    
    this.showToast('✅ সংরক্ষিত হয়েছে!');
    
    this.safeVibrate(50);
    
    const btn = document.getElementById('save-log-btn');
    if (btn) {
        btn.classList.add('success-glow');
        btn.style.background = '#4CAF50';
        btn.style.boxShadow = '0 4px 15px rgba(76, 175, 80, 0.4)';
        btn.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            btn.style.transform = 'scale(1.05)';
        }, 150);
        
        setTimeout(() => {
            btn.style.transform = 'scale(1)';
        }, 300);

        setTimeout(() => {
            btn.style.background = '';
            btn.style.boxShadow = '';
            btn.classList.remove('success-glow');
        }, 800);
    }
  },

  showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.add('show');
    if (this._toastTimeout) clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
  },

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
        console.warn('Failed to render chart', id, e);
    }
  },

  renderAnalytics() {
    const textColor = this.getThemeColor('--text-muted');
    
    if (typeof Chart !== 'undefined') {
        Chart.defaults.font.family = 'system-ui, -apple-system, sans-serif';
        Chart.defaults.color = textColor;
        Chart.defaults.scale.grid.color = this.getThemeColor('--border');
    }

    const periods = [...STATE.periods].sort((a,b) => new Date(a.start) - new Date(b.start));
    const logs = STATE.logs || {};

    let totalLogs = Object.keys(logs).length;
    document.getElementById('stat-total-logs').innerText = toBanglaNumber(totalLogs);

    let cycleLengths = [];
    let periodLengths = [];

    for (let i = 0; i < periods.length; i++) {
        const p = periods[i];
        const pStart = new Date(p.start);
        const pEnd = new Date(p.end);
        let pLen = Math.floor((pEnd - pStart) / (1000 * 60 * 60 * 24)) + 1;
        periodLengths.push(pLen);

        if (i > 0) {
            const prevPStart = new Date(periods[i-1].start);
            let cLen = Math.floor((pStart - prevPStart) / (1000 * 60 * 60 * 24));
            cycleLengths.push(cLen);
        }
    }

    let avgCycle = cycleLengths.length ? Math.round(cycleLengths.reduce((a,b)=>a+b,0)/cycleLengths.length) : (STATE.profile?.cycleLength || 28);
    let avgPeriod = periodLengths.length ? Math.round(periodLengths.reduce((a,b)=>a+b,0)/periodLengths.length) : (STATE.profile?.periodLength || 5);
    
    let minCycle = cycleLengths.length ? Math.min(...cycleLengths) : avgCycle;
    let maxCycle = cycleLengths.length ? Math.max(...cycleLengths) : avgCycle;

    const minCycleEl = document.getElementById('stat-min-cycle');
    if (minCycleEl) minCycleEl.innerText = cycleLengths.length > 0 ? toBanglaNumber(minCycle) + ' দিন' : '-';
    
    const maxCycleEl = document.getElementById('stat-max-cycle');
    if (maxCycleEl) maxCycleEl.innerText = cycleLengths.length > 0 ? toBanglaNumber(maxCycle) + ' দিন' : '-';

    if (!this.predictions) this.calculatePredictions();
    
    if (this.predictions) {
        const nextPeriodEl = document.getElementById('pred-next-period');
        if (nextPeriodEl) nextPeriodEl.innerText = formatBanglaShortDate(this.predictions.nextPeriodStart);
        
        const ovulationEl = document.getElementById('pred-ovulation');
        if (ovulationEl) ovulationEl.innerText = formatBanglaShortDate(this.predictions.ovulationDate);
        
        const fwEl = document.getElementById('pred-fertile-window');
        if (fwEl && this.predictions.fertileStart && this.predictions.fertileEnd) {
            fwEl.innerText = `${formatBanglaShortDate(this.predictions.fertileStart)} - ${formatBanglaShortDate(this.predictions.fertileEnd)}`;
        }
    }

    this.renderCycleChart(cycleLengths);
    this.renderPeriodChart(periodLengths);
    this.renderSymptomChart(logs);
    this.renderMoodChart(logs);
    this.renderInsights(logs, periods, cycleLengths);
    this.renderSmartInsights(logs);
    this.renderCycleAnalysis(cycleLengths);
  },

  renderInsights(logs, periods, cycleLengths) {
    const container = document.getElementById('health-insights-container');
    if (!container) return;
    
    container.innerHTML = '';
    let insights = [];

    // Analyze cycle regularity
    if (cycleLengths.length >= 3) {
        const lastCycle = cycleLengths[cycleLengths.length - 1];
        const prevCycle = cycleLengths[cycleLengths.length - 2];
        const diff = Math.abs(lastCycle - prevCycle);
        if (diff > 5) {
            insights.push({
                type: 'irregular',
                icon: '⚠️',
                title: 'সাইকেল পরিবর্তন',
                desc: `আপনার সাইকেল দৈর্ঘ্যে পরিবর্তন দেখা যাচ্ছে। আগের সাইকেল ছিল ${toBanglaNumber(prevCycle)} দিন এবং সর্বশেষ ${toBanglaNumber(lastCycle)} দিন।`
            });
        } else {
            insights.push({
                type: 'regular',
                icon: '🎯',
                title: 'নিয়মিত সাইকেল',
                desc: `আপনার সাইকেল বেশ নিয়মিত! গত কয়েকটি সাইকেল প্রায় একই দৈর্ঘ্যের ছিল।`
            });
        }
    }

    // Analyze energy and sleep
    let lowEnergyDays = 0;
    let totalLogs = 0;
    let sadAnxiousDays = 0;
    
    // Sort logs to check recently
    const sortedLogDates = Object.keys(logs).sort().reverse().slice(0, 7);
    
    for (const date in logs) {
        if (logs[date].energy !== undefined) {
            totalLogs++;
            if (logs[date].energy < 40) lowEnergyDays++;
        }
    }
    
    sortedLogDates.forEach(date => {
        if (logs[date].mood === 'বিষণ্ণ' || logs[date].mood === 'উদ্বিগ্ন') {
            sadAnxiousDays++;
        }
    });

    if (totalLogs >= 5 && lowEnergyDays / totalLogs > 0.4) {
        insights.push({
            type: 'sleep',
            icon: '🔋',
            title: 'শক্তির অভাব',
            desc: `আপনি বেশ কিছুদিন ধরে কম এনার্জি লগ করেছেন। পরিমিত ঘুম এবং স্বাস্থ্যকর খাবার এনার্জি বাড়াতে সাহায্য করতে পারে।`
        });
    } else if (totalLogs >= 5 && lowEnergyDays / totalLogs < 0.2) {
        insights.push({
            type: 'regular',
            icon: '⚡',
            title: 'দুর্দান্ত এনার্জি',
            desc: `আপনার সামগ্রিক এনার্জি লেভেল বেশ ভালো আছে! এই স্বাস্থ্যকর রুটিন ধরে রাখুন।`
        });
    }
    
    if (sadAnxiousDays >= 3) {
        insights.push({
            type: 'sleep',
            icon: '🌧️',
            title: 'মুড ট্রেন্ড',
            desc: `গত ৭ দিনে আপনি কয়েকটি বিষণ্ণ দিন লগ করেছেন। যদি খারাপ লাগে, প্রিয় কারো সাথে কথা বলুন বা পছন্দের কাজ করুন।`
        });
    }

    // Analyze mood and PMS (approaching period)
    if (!this.predictions) this.calculatePredictions();
    
    if (this.predictions && this.predictions.nextPeriodStart) {
        const nextStart = new Date(this.predictions.nextPeriodStart);
        const today = new Date();
        const daysToNext = Math.ceil((nextStart - today) / (1000 * 60 * 60 * 24));
        
        if (daysToNext > 0 && daysToNext <= 5) {
            insights.push({
                type: 'irregular',
                icon: '🌸',
                title: 'আগামী পিরিয়ড',
                desc: `আপনার পিরিয়ড আর মাত্র ${toBanglaNumber(daysToNext)} দিন পরে শুরু হতে পারে। নিজের প্রতি বাড়তি যত্ন নিন।`
            });
            
            // Check recent symptoms for PMS
            let pmsSymptoms = 0;
            sortedLogDates.slice(0, 3).forEach(date => {
                if (logs[date].symptoms && logs[date].symptoms.length > 0) {
                    pmsSymptoms++;
                }
            });
            if (pmsSymptoms >= 1) {
                 insights.push({
                    type: 'irregular',
                    icon: '🌿',
                    title: 'পিএমএস (PMS)',
                    desc: `আপনার বর্তমান লক্ষণগুলো সাময়িক হতে পারে এবং এটি সাধারণত পিরিয়ড শুরুর আগের দিনগুলোতে হয়ে থাকে।`
                });
            }
        }
    }

    if (insights.length === 0) {
        container.innerHTML = `
            <div class="empty-insight-state">
                <span class="text-3xl mb-2">✨</span>
                <p class="text-muted text-sm text-center">পর্যাপ্ত ডেটা নেই। কিছু দিন লগ করুন নতুন ইনসাইটস পেতে।</p>
            </div>
        `;
        return;
    }

    insights.forEach(insight => {
        const div = document.createElement('div');
        div.className = `insight-card ${insight.type}`;
        div.innerHTML = `
            <div class="insight-icon">${insight.icon}</div>
            <div class="insight-content">
                <h4>${insight.title}</h4>
                <p>${insight.desc}</p>
            </div>
        `;
        container.appendChild(div);
    });
  },

  renderSmartInsights(logs) {
    const container = document.getElementById('smart-insights-container');
    if (!container) return;

    if (!logs || Object.keys(logs).length === 0) {
      this.renderEmptySmartInsights(container);
      return;
    }

    const logDates = Object.keys(logs).sort((a, b) => new Date(b) - new Date(a));
    const recentLogs = logDates.slice(0, 90).map(d => ({ date: d, data: logs[d] }));

    if (recentLogs.length < 5) {
      this.renderEmptySmartInsights(container);
      return;
    }

    const insights = [];

    const sleepEnergyInsight = this.analyzeSleepEnergy(recentLogs);
    if (sleepEnergyInsight) insights.push(sleepEnergyInsight);

    const moodPatternsInsight = this.analyzeMoodPatterns(recentLogs);
    if (moodPatternsInsight) insights.push(moodPatternsInsight);

    const pmsSymptomInsight = this.analyzePmsSymptoms(recentLogs);
    if (pmsSymptomInsight) insights.push(pmsSymptomInsight);

    if (insights.length === 0) {
      this.renderEmptySmartInsights(container);
      return;
    }

    this.generateInsightCards(container, insights);
  },

  renderEmptySmartInsights(container) {
    container.innerHTML = `
      <div class="empty-insight-state">
        <span class="text-3xl mb-2">🌸</span>
        <p class="text-muted text-sm text-center">
          আরও কিছু তথ্য যোগ করলে ব্যক্তিগত বিশ্লেষণ দেখা যাবে
        </p>
      </div>
    `;
  },

  analyzeSleepEnergy(recentLogs) {
    let lowSleepLowEnergy = 0;
    let highSleepHighEnergy = 0;
    let totalCorrelations = 0;

    recentLogs.forEach(log => {
      const { sleep, energy } = log.data;
      if (sleep && energy !== undefined) {
        let energyLevel = parseInt(energy, 10);
        if (!isNaN(energyLevel)) {
           totalCorrelations++;
           if (sleep.includes('কম')) {
             if (energyLevel < 40) {
               lowSleepLowEnergy++;
             }
           } else if (sleep.includes('ভালো')) {
             if (energyLevel > 60) {
               highSleepHighEnergy++;
             }
           }
        }
      }
    });

    if (totalCorrelations >= 3) {
      if (lowSleepLowEnergy >= 2) {
        return { icon: '😴', text: 'কম ঘুমের দিনে ক্লান্তি বেশি লক্ষ্য করা গেছে' };
      } else if (highSleepHighEnergy >= 2) {
        return { icon: '💧', text: 'ভালো ঘুমের দিনে এনার্জি বেশি দেখা গেছে' };
      }
    }
    return null;
  },

  analyzeMoodPatterns(recentLogs) {
    let sadMoods = 0;
    let happyMoods = 0;
    
    recentLogs.slice(0, 14).forEach(log => {
       if (log.data.mood) {
          if (log.data.mood.includes('কষ্টে') || log.data.mood.includes('রাগী') || log.data.mood.includes('সংবেদনশীল')) {
              sadMoods++;
          } else if (log.data.mood.includes('ভালো') || log.data.mood.includes('স্বাভাবিক')) {
              happyMoods++;
          }
       }
    });

    if (sadMoods >= 3) {
      return { icon: '🌙', text: 'সম্প্রতি নেতিবাচক বা সংবেদনশীল মেজাজ বেশি ছিল' };
    } else if (happyMoods >= 4) {
      return { icon: '🌿', text: 'গত কয়েকদিনে মেজাজ বেশ শান্ত ও ভালো ছিল' };
    }

    return null;
  },

  analyzePmsSymptoms(recentLogs) {
    const pmsCommon = ['মাথাব্যথা', 'কোমর ব্যথা'];
    let pmsCount = 0;
    
    recentLogs.forEach(log => {
      if (log.data.symptoms) {
        if (log.data.symptoms.some(s => pmsCommon.includes(s))) {
           pmsCount++;
        }
      }
    });

    if (pmsCount >= 2) {
      return { icon: '🌸', text: 'মাসিকের আগে মাথাব্যথা বা কোমর ব্যথার মতো লক্ষণ দেখা গেছে' };
    }
    
    return null;
  },

  generateInsightCards(container, insights) {
    let html = '';

    insights.forEach((ins, idx) => {
        const delay = idx * 0.1;
        html += `
        <div class="card" style="margin-bottom: 1rem; border-radius: 20px; background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 5%, transparent), color-mix(in srgb, var(--secondary) 2%, transparent)); opacity: 0; animation: fadeUp 0.5s ease-out forwards; animation-delay: ${delay}s;">
          <div style="display: flex; align-items: center; gap: 1rem; padding: 0.25rem;">
             <span style="font-size: 2rem; border-radius: 50%; padding: 0.5rem; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; width: 45px; height: 45px; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">${ins.icon}</span>
             <p class="font-medium" style="font-size: 1rem; line-height: 1.5; color: var(--text-main); margin: 0;">${ins.text}</p>
          </div>
        </div>
        `;
    });
    container.innerHTML = html;
  },

  renderCycleAnalysis(cycleLengths) {
    const analyticsContainer = document.getElementById('analytics-cycle-analysis-container');
    const homeCard = document.getElementById('home-cycle-analysis-card');
    const homeCardIcon = document.getElementById('home-cycle-icon');
    const homeCardText = document.getElementById('home-cycle-text');

    if (!cycleLengths || cycleLengths.length < 2) {
      if (analyticsContainer) {
        analyticsContainer.innerHTML = `
          <div class="empty-insight-state">
            <span class="text-3xl mb-2">📊</span>
            <p class="text-muted text-sm text-center">
              আরও তথ্য যোগ করলে বিশ্লেষণ দেখা যাবে
            </p>
          </div>
        `;
      }
      if (homeCard) {
          homeCard.style.display = 'flex';
          homeCard.style.borderColor = 'rgba(0,0,0,0.05)';
          homeCard.style.background = 'rgba(0,0,0,0.02)';
          if (homeCardIcon) homeCardIcon.innerText = '📊';
          if (homeCardText) homeCardText.innerText = 'বিশ্লেষণ পেতে অন্তত দুটি সাইকেল লগ করুন';
      }
      return;
    }

    const { status, diff, min, max, avg, count } = this.calculateCycleVariability(cycleLengths);
    const confidence = this.calculatePredictionConfidence(count, status);
    const insightMessage = this.generateCycleInsight(status, count);

    // Color coordination based on status
    let statusColor = "var(--secondary)"; // Green/Teal (regular)
    let icon = "🌿";
    let statusLabel = "নিয়মিত";
    if (status === "slightly_irregular") {
        statusColor = "#FFB300"; // Yellow
        icon = "📌";
        statusLabel = "কিছুটা অনিয়মিত";
    } else if (status === "irregular") {
        statusColor = "var(--primary)"; // Red/Pink
        icon = "🌙";
        statusLabel = "অনিয়মিত";
    }

    // --- Update Analytics Screen ---
    if (analyticsContainer) {
      analyticsContainer.innerHTML = `
        <div style="background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(0,0,0,0.02)); border-radius: 16px; padding: 1.25rem; border: 1px solid rgba(0,0,0,0.05); margin-bottom: 1rem; animation: fadeUp 0.4s ease-out;">
           <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1rem;">
             <div>
               <h4 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.25rem;">স্ট্যাটাস: <span style="color: ${statusColor};">${statusLabel}</span></h4>
               <p style="font-size: 0.85rem; color: var(--muted);">${insightMessage}</p>
             </div>
             <div style="font-size: 2rem; background: rgba(255,255,255,0.5); width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.03);">${icon}</div>
           </div>

           <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div style="background: var(--card); padding: 1rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                 <p style="font-size: 0.75rem; color: var(--muted); margin-bottom: 0.25rem;">পূর্বাভাস কনফিডেন্স</p>
                 <strong style="font-size: 1.25rem; color: var(--text);">${confidence}%</strong>
              </div>
              <div style="background: var(--card); padding: 1rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                 <p style="font-size: 0.75rem; color: var(--muted); margin-bottom: 0.25rem;">সাইকেল ভ্যারিয়েশন</p>
                 <strong style="font-size: 1.25rem; color: var(--text);">±${Math.round(diff / 2)} দিন</strong>
              </div>
           </div>
        </div>
      `;
    }

    // --- Update Home Screen ---
    if (homeCard) {
      homeCard.style.display = 'flex';
      homeCard.style.borderColor = `color-mix(in srgb, ${statusColor} 20%, transparent)`;
      homeCard.style.background = `color-mix(in srgb, ${statusColor} 5%, transparent)`;
      
      if (homeCardIcon) homeCardIcon.innerText = icon;
      if (homeCardText) homeCardText.innerText = insightMessage;
    }
  },

  calculateCycleVariability(cycleLengths) {
    const recentCycles = cycleLengths.slice(-6);
    const min = Math.min(...recentCycles);
    const max = Math.max(...recentCycles);
    const diff = max - min;
    const avg = recentCycles.reduce((a, b) => a + b, 0) / recentCycles.length;

    let status = "regular";
    if (diff > 3 && diff <= 7) {
        status = "slightly_irregular";
    } else if (diff > 7) {
        status = "irregular";
    }

    return { status, diff, min, max, avg, count: recentCycles.length };
  },

  calculatePredictionConfidence(count, status) {
    let base = 0;
    
    if (count <= 2) {
       return 50;
    }

    if (status === "regular") {
       if (count === 3) base = 70;
       else if (count === 4) base = 80;
       else base = 90;
    } else if (status === "slightly_irregular") {
       if (count === 3) base = 60;
       else if (count === 4) base = 70;
       else base = 80;
    } else {
       if (count === 3) base = 40;
       else if (count === 4) base = 50;
       else base = 60;
    }

    return base;
  },

  generateCycleInsight(status, count) {
      if (count < 3) {
          return "💖 আরও কয়েক মাস তথ্য যোগ করলে পূর্বাভাস আরও নির্ভুল হবে";
      }

      if (status === "regular") {
          return "🌿 তোমার সাইকেল মোটামুটি নিয়মিত";
      } else if (status === "slightly_irregular") {
          return "📌 এই মাসে কিছু পরিবর্তন দেখা গেছে";
      } else {
          return "🌙 সাম্প্রতিক সাইকেলে কিছু ওঠানামা দেখা যাচ্ছে";
      }
  },

  renderCycleChart(data) {
    this.destroyChart('chart-cycle');
    if (data.length < 2) {
       document.getElementById('view-chart-cycle').style.display = 'none';
       document.getElementById('empty-chart-cycle').style.display = 'flex';
       return;
    }
    document.getElementById('view-chart-cycle').style.display = 'block';
    document.getElementById('empty-chart-cycle').style.display = 'none';

    const ctx = document.getElementById('chart-cycle-history').getContext('2d');
    const labels = data.map((_, i) => toBanglaNumber(i+1));
    
    this.safeCreateChart('chart-cycle', ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'সাইকেল দৈর্ঘ্য (দিন)',
                data: data,
                borderColor: this.getThemeColor('--primary'),
                backgroundColor: 'rgba(0,0,0,0.05)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
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
                    min: 15, 
                    max: 45,
                    ticks: { callback: function(value) { return toBanglaNumber(value); } }
                } 
            }
        }
    });
  },

  renderPeriodChart(data) {
    this.destroyChart('chart-period');
    if (data.length < 2) {
       document.getElementById('view-chart-period').style.display = 'none';
       document.getElementById('empty-chart-period').style.display = 'flex';
       return;
    }
    document.getElementById('view-chart-period').style.display = 'block';
    document.getElementById('empty-chart-period').style.display = 'none';

    const ctx = document.getElementById('chart-period-history').getContext('2d');
    const labels = data.map((_, i) => toBanglaNumber(i+1));
    
    this.safeCreateChart('chart-period', ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'পিরিয়ড স্থায়িত্ব (দিন)',
                data: data,
                backgroundColor: this.getThemeColor('--accent'),
                borderRadius: 4
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
                    ticks: { callback: function(value) { return toBanglaNumber(value); } }
                } 
            }
        }
    });
  },

  renderSymptomChart(logs) {
    this.destroyChart('chart-symptom');
    
    const symptomsCounts = {};
    for (const dStr in logs) {
       const log = logs[dStr];
       if (log.symptoms) {
           log.symptoms.forEach(s => {
               symptomsCounts[s] = (symptomsCounts[s] || 0) + 1;
           });
       }
    }

    const sorted = Object.entries(symptomsCounts).sort((a,b)=>b[1]-a[1]).slice(0, 5);
    
    if (sorted.length === 0) {
       document.getElementById('view-chart-symptom').style.display = 'none';
       document.getElementById('empty-chart-symptom').style.display = 'flex';
       return;
    }
    document.getElementById('view-chart-symptom').style.display = 'block';
    document.getElementById('empty-chart-symptom').style.display = 'none';

    const ctx = document.getElementById('chart-symptom-freq').getContext('2d');
    
    const gradientTop = ctx.createLinearGradient(0, 0, 300, 0);
    gradientTop.addColorStop(0, this.getThemeColor('--primary'));
    gradientTop.addColorStop(1, this.getThemeColor('--secondary'));
    
    const bgColors = sorted.map((_, i) => i < 3 ? gradientTop : 'rgba(158, 158, 158, 0.3)');

    this.safeCreateChart('chart-symptom', ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(k => k[0] + '  ( ' + toBanglaNumber(k[1]) + ' )'),
            datasets: [{
                data: sorted.map(k => k[1]),
                backgroundColor: bgColors,
                borderRadius: 8,
                borderWidth: 0,
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
                         label: (context) => ` ${toBanglaNumber(context.raw)} বার`
                    }
                }
            },
            scales: {
                x: { display: false },
                y: { 
                    border: { display: false },
                    grid: { display: false },
                    ticks: {
                        color: this.getThemeColor('--text-muted'),
                        font: { family: 'system-ui, -apple-system, sans-serif', size: 13 }
                    }
                }
            }
        }
    });
  },

  renderMoodChart(logs) {
    this.destroyChart('chart-mood');
    
    const moodCounts = {};
    for (const dStr in logs) {
       const log = logs[dStr];
       if (log.mood) {
           moodCounts[log.mood] = (moodCounts[log.mood] || 0) + 1;
       }
    }

    const sorted = Object.entries(moodCounts).sort((a,b)=>b[1]-a[1]);
    
    if (sorted.length === 0) {
       document.getElementById('view-chart-mood').style.display = 'none';
       document.getElementById('empty-chart-mood').style.display = 'flex';
       return;
    }
    document.getElementById('view-chart-mood').style.display = 'block';
    document.getElementById('empty-chart-mood').style.display = 'none';

    const ctx = document.getElementById('chart-mood-dist').getContext('2d');
    
    const moodColors = {
        '😊 ভালো': '#A5D6A7',
        '😢 কষ্টে': '#90CAF9',
        '😠 বিরক্ত': '#EF9A9A',
        '😰 উদ্বিগ্ন': '#CE93D8',
        '😐 স্বাভাবিক': '#E0E0E0',
        '🥰 প্রেমময়': '#F48FB1',
        '😤 হতাশ': '#FFCC80',
        '😴 ঘুমঘুম': '#BCAAA4'
    };

    let totalMoods = sorted.reduce((sum, item) => sum + item[1], 0);

    const borderColor = this.getThemeColor('--card');

    this.safeCreateChart('chart-mood', ctx, {
        type: 'doughnut',
        data: {
            labels: sorted.map(k => k[0]),
            datasets: [{
                data: sorted.map(k => k[1]),
                backgroundColor: sorted.map(k => moodColors[k[0]] || '#E0E0E0'),
                borderWidth: 3,
                borderColor: borderColor,
                borderRadius: 5,
                cutout: '75%'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                animateScale: true,
                animateRotate: true
            },
            plugins: { 
                legend: { 
                    position: 'bottom',
                    labels: { 
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        color: this.getThemeColor('--text-muted'),
                        font: { family: 'system-ui, -apple-system, sans-serif' }
                    }
                },
                tooltip: {
                    callbacks: {
                         label: (context) => {
                             let val = context.raw;
                             let pct = Math.round((val / totalMoods) * 100);
                             return ` ${toBanglaNumber(val)} বার (${toBanglaNumber(pct)}%)`;
                         }
                    }
                }
            }
        }
    });
  },

  setupLogView() {
    const dateInput = document.getElementById('log-date');
    if (dateInput) {
        dateInput.value = getLocalDateString(new Date());
    }
    this.loadLogForDate();
  },

  loadLogForDate() {
    const dStr = document.getElementById('log-date').value;
    
    document.querySelectorAll('.chip-group .chip-item').forEach(c => c.classList.remove('active'));
    document.getElementById('log-energy').value = 50;
    const energyValEl = document.getElementById('energy-val');
    if (energyValEl) energyValEl.innerText = toBanglaNumber(50) + '%';
    
    document.getElementById('log-notes').value = '';

    if (STATE.logs && STATE.logs[dStr]) {
        const log = STATE.logs[dStr];
        
        if (log.symptoms) {
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
             document.getElementById('log-energy').value = log.energy;
             if (energyValEl) energyValEl.innerText = toBanglaNumber(log.energy) + '%';
        }
        if (log.notes) {
             document.getElementById('log-notes').value = log.notes;
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

  switchTab(tabName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
    });
    
    // Show selected view
    const activeView = document.getElementById(`view-${tabName}`);
    activeView.classList.add('active');
    
    // Reset scroll to top
    const scrollContent = activeView.querySelector('.scroll-content');
    if (scrollContent) {
      scrollContent.scrollTop = 0;
    }

    if (tabName === 'calendar') this.renderCalendar();
    if (tabName === 'home') this.renderHome();
    if (tabName === 'log') this.setupLogView();
    if (tabName === 'analytics') this.renderAnalytics();

    // Update nav icons
    document.querySelectorAll('.nav-item').forEach(i => {
      i.classList.remove('active');
    });
    
    // Set active tab
    document.querySelectorAll('.nav-item').forEach(i => {
        if(i.getAttribute('onclick').includes(`'${tabName}'`)){
            i.classList.add('active');
        }
    });
  },

  // --- Security & PIN ---
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
            setTimeout(() => this.processCompletePin(), 100);
        }
    }
  },

  removePinDigit() {
    if (this.currentPin.length > 0) {
        this.currentPin = this.currentPin.slice(0, -1);
        this.updatePinUI();
        this.safeVibrate(10);
    }
  },

  updatePinUI() {
    const dots = document.getElementById('pin-dots').children;
    for (let i = 0; i < 4; i++) {
        if (i < this.currentPin.length) {
            dots[i].classList.add('filled');
        } else {
            dots[i].classList.remove('filled');
        }
    }
  },
  
  shakePin() {
    const dotsContainer = document.getElementById('pin-dots');
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
      } 
      else if (mode === 'setup_new' || mode === 'change_new') {
          this.tempPin = val;
          this.showLockScreen(mode === 'setup_new' ? 'setup_confirm' : 'change_confirm');
      }
      else if (mode === 'setup_confirm' || mode === 'change_confirm') {
          if (val === this.tempPin) {
              STATE.settings.pin = val;
              STATE.settings.pinEnabled = true;
              this.saveData('fz_settings', STATE.settings);
              this.hideLockScreen();
              this.bootMainApp();
              this.renderSettings();
              this.showToast('পিন সফলভাবে সেট হয়েছে');
          } else {
              this.showToast('পিন মেলেনি, আবার চেষ্টা করুন');
              this.shakePin();
              setTimeout(() => {
                 this.showLockScreen(mode === 'setup_confirm' ? 'setup_new' : 'change_new'); 
              }, 400);
          }
      }
      else if (mode === 'remove_verify') {
          if (val === STATE.settings.pin) {
              STATE.settings.pinEnabled = false;
              STATE.settings.pin = null;
              this.saveData('fz_settings', STATE.settings);
              this.hideLockScreen();
              this.bootMainApp();
              this.renderSettings();
              this.showToast('পিন লক বন্ধ করা হয়েছে');
          } else {
              this.shakePin();
          }
      }
      else if (mode === 'change_verify') {
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
      if(!STATE.settings) STATE.settings = {};
      
      if (STATE.settings.pinEnabled) {
          // Confirm before removing
          this.confirmAction('remove_pin_init');
      } else {
          // Setup new pin
          this.showLockScreen('setup_new');
      }
  },

  startChangePin() {
      this.showLockScreen('change_verify');
  },

  toggleReminder() {
      if (!STATE.settings) STATE.settings = {};
      
      const isCurrentlyEnabled = !!STATE.settings.remindersEnabled;
      
      if (!isCurrentlyEnabled) {
          // Attempt to request permission
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
                      this.showToast('রিমাইন্ডার চালু হয়েছে 🌸');
                      this.startReminderService();
                  } else {
                      this.showToast('নোটিফিকেশন পারমিশন দেওয়া হয়নি');
                  }
              }).catch(e => {
                  this.showToast('নোটিফিকেশন সেটআপে একটি সমস্যা হয়েছে');
              });
          } catch(e) {
              this.showToast('নোটিফিকেশন ব্রাউজার দ্বারা সমর্থিত নয়');
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
      const t = document.getElementById('reminder-time').value;
      if (t) {
          STATE.settings.reminderTime = t;
          this.saveData('fz_settings', STATE.settings);
          this.showToast('রিমাইন্ডারের সময় সংরক্ষিত হয়েছে');
      }
  },

  startReminderService() {
      if (this.reminderInterval) {
          clearInterval(this.reminderInterval);
      }
      
      // Check every minute
      this.reminderInterval = setInterval(() => {
          this.checkAndFireReminders();
      }, 60000);
      
      // Also check immediately on boot
      setTimeout(() => this.checkAndFireReminders(), 5000);
  },

  checkAndFireReminders() {
      if (!STATE.settings?.remindersEnabled || !STATE.profile || !("Notification" in window) || Notification.permission !== 'granted') return;
      
      const targetTime = STATE.settings.reminderTime || "08:00";
      const now = new Date();
      const currentHours = now.getHours().toString().padStart(2, '0');
      const currentMinutes = now.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      
      // Only fire once a day when the time matches
      const dateStr = getLocalDateString(now);
      const lastFireKey = `fz_last_reminder_${dateStr}`;
      
      if (currentTimeStr === targetTime && !localStorage.getItem(lastFireKey)) {
          this.calculatePredictions();
          
          let title = "ফুলঝরি রিমাইন্ডার 🌸";
          let body = "আজকে কেমন আছো? পানি খেতে ভুলবে না 💧";
          
          if (this.predictions) {
              const daysToPeriod = Math.ceil((new Date(this.predictions.nextPeriodStart) - now) / (1000 * 60 * 60 * 24));
              const daysToOvulation = Math.ceil((new Date(this.predictions.ovulationDate) - now) / (1000 * 60 * 60 * 24));
              
              if (daysToPeriod === 1) {
                  body = "আগামীকাল তোমার পিরিয়ড শুরু হতে পারে 🌸 প্যাড সাথে রাখতে পারো।";
              } else if (daysToPeriod === 0) {
                  body = "আজ তোমার পিরিয়ড শুরু হতে পারে। নিজের যত্ন নিও 🌸";
              } else if (daysToOvulation === 1 || daysToOvulation === 0) {
                  body = "তুমি এখন ওভুলেশন (উর্বর) সময়ে আছো ✨";
              } else if (this.predictions.phaseName === "লুটিয়াল") {
                  body = "এখন লুটিয়াল ফেজ চলছে। মেজাজ পরিবর্তন হতে পারে, নিজের খেয়াল রেখো 🌿";
              }
          }
          
          this.sendLocalNotification(title, body);
          localStorage.setItem(lastFireKey, "true");
      }
  },

  sendLocalNotification(title, body) {
      try {
          if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
              navigator.serviceWorker.ready.then(registration => {
                  registration.showNotification(title, {
                      body: body,
                      icon: '/icon.svg',
                      badge: '/icon.svg',
                      vibrate: [200, 100, 200]
                  }).catch(e => console.warn('SW notification skip', e));
              });
          } else {
              new Notification(title, {
                  body: body,
                  icon: '/icon.svg'
              });
          }
      } catch (e) {
          console.warn('Failed to send notification', e);
      }
  }
};

window.app = app;

function boot() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch((err) => {
        console.log('ServiceWorker registration failed: ', err);
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
