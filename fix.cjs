const fs = require('fs');

let content = fs.readFileSync('src/app.js', 'utf8');

const startIndex = content.indexOf("if (ds === ovulDate) {");
const endIndex = content.indexOf("    document.getElementById('wellness-dynamic-content').innerHTML = contentHtml;");

if (startIndex > -1 && endIndex > -1) {
    const newCode = `if (ds === ovulDate) {
             cell.classList.add('ovulation');
             statusInfo = 'ডিম্বস্ফোটন';
          } else {
             cell.classList.add('fertility');
             statusInfo = 'উর্বর সময়';
          }
        }

        if (STATE.logs && STATE.logs[ds]) {
           const logEl = document.createElement('div');
           logEl.style.fontSize = '0.6rem';
           logEl.style.marginTop = '2px';
           logEl.innerText = '•';
           cell.appendChild(logEl);
        }

        cell.onclick = () => this.openDayModal(ds, statusInfo);
        calDaysContainer.appendChild(cell);
     }
  },

  openDayModal(dateStr, phaseInfo) {
    document.getElementById('modal-date-title').innerText = formatBanglaShortDate(new Date(dateStr));
    
    let html = '';
    if (phaseInfo) {
        html += \`<div class="mb-4 text-primary font-medium">\${phaseInfo}</div>\`;
    }

    const l = STATE.logs ? STATE.logs[dateStr] : null;
    if (l) {
        html += \`<h4 class="mb-2">লগ করা তথ্য</h4>\`;
        if (l.mood) html += \`<div class="mb-2 text-sm"><strong>মেজাজ:</strong> \${l.mood}</div>\`;
        if (l.symptoms && l.symptoms.length > 0) html += \`<div class="mb-2 text-sm"><strong>লক্ষণ:</strong> \${l.symptoms.join(', ')}</div>\`;
        if (l.flow) html += \`<div class="mb-2 text-sm"><strong>ফ্লো:</strong> \${l.flow}</div>\`;
        if (l.sleep) html += \`<div class="mb-2 text-sm"><strong>ঘুম:</strong> \${l.sleep}</div>\`;
        if (l.energy) html += \`<div class="mb-2 text-sm"><strong>শক্তি:</strong> \${l.energy}</div>\`;
        if (l.notes) html += \`<div class="mb-2 text-sm"><strong>নোট:</strong> \${l.notes}</div>\`;
    } else {
        html += \`<div class="text-sm text-muted">এই দিনে কোনো লগ যোগ করা হয়নি।</div>\`;
    }

    document.getElementById('modal-content-details').innerHTML = html;
    document.getElementById('day-modal').classList.remove('hidden');
  },

  closeDayModal(e) {
    if(e && e.target !== document.getElementById('day-modal') && !e.target.classList.contains('close-btn')) return;
    document.getElementById('day-modal').classList.add('hidden');
  },

  openWellness() {
    if (!this.predictions) return;
    let contentHtml = "";
    
    if (this.predictions.phaseName === "মাসিকের সময়") {
        contentHtml = \`
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
        \`;
    } else if (this.predictions.phaseName === "ফলিকুলার পর্যায়") {
        contentHtml = \`
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
        \`;
    } else if (this.predictions.phaseName === "ডিম্বস্ফোটনের সময়") {
        contentHtml = \`
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
        \`;
    } else {
        contentHtml = \`
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
        \`;
    }

`;
    
    const newFullContent = content.substring(0, startIndex) + newCode + content.substring(endIndex);
    fs.writeFileSync('src/app.js', newFullContent, 'utf8');
    console.log("Replaced successfully");
} else {
    console.log("Could not find start or end index", startIndex, endIndex);
}
