const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];
let mouse = { x: null, y: null, radius: 150 };

function resize() {
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    // 初回読み込み、または画面の幅が変わった時（縦横の回転など）のみ図形を再生成・Canvasサイズを再設定する
    // スマホのスクロールで高さだけが変わる時は何もせず終了する（背景がクリアされるバグを完全に防ぐ）
    if (width === newWidth) {
        return;
    }

    width = newWidth;
    height = newHeight;
    
    // 高解像度ディスプレイ（スマホ等）で画質が荒くなるのを防ぐ
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    // canvas要素のCSSサイズを固定し、勝手に縦に引き伸ばされるのを防ぐ
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    
    // 描画スケールをピクセル比に合わせる
    ctx.scale(dpr, dpr);

    initParticles();
}

window.addEventListener('resize', resize);
window.addEventListener('mousemove', (e) => {
    mouse.x = e.x;
    mouse.y = e.y;
});
window.addEventListener('mouseout', () => {
    mouse.x = null;
    mouse.y = null;
});

const PADDING = 200; // 画面外の許容範囲

class Particle {
    constructor(options = {}) {
        this.x = (Math.random() * (width + PADDING * 2)) - PADDING;
        this.y = (Math.random() * (height + PADDING * 2)) - PADDING;
        this.visualY = this.y;
        
        const isSpecial = options.color !== undefined;
        this.size = isSpecial ? 40 : Math.random() * 45 + 15; // パズルの図形はわかりやすいよう40px固定
        this.sides = options.sides !== undefined ? options.sides : Math.floor(Math.random() * 4) + 3;
        this.angle = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.015;
        
        // 初期スピード（ランダムな方向へ）
        let initialAngle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(initialAngle) * 0.3;
        this.vy = Math.sin(initialAngle) * 0.3;

        this.color = options.color !== undefined ? options.color : 'rgba(120, 120, 130, 0.15)'; 
    }

    update(allParticles) {
        this.x += this.vx;
        this.y += this.vy;
        this.angle += this.rotationSpeed;

        // 壁で跳ね返る（画面外のPADDING領域まで動けるようにする）
        // X軸は画面外で跳ね返る
        if (this.x > width + PADDING && this.vx > 0) this.vx *= -1;
        if (this.x < -PADDING && this.vx < 0) this.vx *= -1;
        
        // Y軸はvisualYで無限ループさせているため、物理的な壁(this.y)での跳ね返りは不要（透明な壁バグの原因になるため削除）

        // スクロール時の視覚的なY座標（パララックス＋無限ループ）
        const parallaxFactor = (this.size / 60) * 0.5; // 大きい図形ほどスクロール時に多く動く
        const totalHeight = height + PADDING * 2;
        let vY = this.y - window.scrollY * parallaxFactor;
        
        // 画面外に出た分をループさせる
        this.visualY = ((vY + PADDING) % totalHeight + totalHeight) % totalHeight - PADDING;

        // マウスとのインタラクション（ふわっと弾き飛ばす）
        if (mouse.x != null && mouse.y != null) {
            let dx = this.x - mouse.x; 
            let dy = this.visualY - mouse.y; // 視覚的な位置でマウス判定
            let distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < mouse.radius) {
                const forceDirectionX = dx / distance;
                const forceDirectionY = dy / distance;
                const force = (mouse.radius - distance) / mouse.radius;
                
                // 弾き飛ばす力をさらに弱く（かなりそっと避ける程度に）
                this.vx += forceDirectionX * force * 0.1;
                this.vy += forceDirectionY * force * 0.1;
            }
        }

        // 他の図形を避ける処理（図形同士が重なり合った時のみ、ゆっくり避ける）
        let repelX = 0;
        let repelY = 0;
        for (let p of allParticles) {
            if (p === this || p.visualY === undefined) continue;
            let dx = this.x - p.x;
            let dy = this.visualY - p.visualY; // 視覚的な位置で重なり判定
            let distance = Math.sqrt(dx * dx + dy * dy);
            
            // お互いのサイズ（半径）の合計より距離が短ければ「重なっている」
            let overlapDistance = this.size + p.size;
            if (distance < overlapDistance && distance > 0) {
                let force = (overlapDistance - distance) / overlapDistance;
                repelX += (dx / distance) * force * 0.005; // 避ける力をもっと弱く（自然にスライドする程度）
                repelY += (dy / distance) * force * 0.005;
            }
        }
        
        this.vx += repelX;
        this.vy += repelY;

        // ゆっくり自然に減速する（空気抵抗）
        this.vx *= 0.985;
        this.vy *= 0.985;

        // ただし、一定の最低速度（ゆっくり漂う速度）は維持し、方向を保つ
        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const minSpeed = 0.3; // ゆっくり動く最低速度
        if (currentSpeed < minSpeed && currentSpeed > 0) {
            this.vx = (this.vx / currentSpeed) * minSpeed;
            this.vy = (this.vy / currentSpeed) * minSpeed;
        }
    }

    draw() {
        ctx.beginPath();
        for (let i = 0; i < this.sides; i++) {
            const currentAngle = this.angle + (i * 2 * Math.PI / this.sides);
            const px = this.x + Math.cos(currentAngle) * this.size;
            const py = this.visualY + Math.sin(currentAngle) * this.size; // 視覚的なY座標で描画
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

function initParticles() {
    particles = [];
    
    // 謎解き用の特別な図形を追加（常に1つずつ存在する）
    // 黄色の五角形
    particles.push(new Particle({ sides: 5, color: 'rgba(230, 200, 20, 0.35)' }));
    // 紫の四角形
    particles.push(new Particle({ sides: 4, color: 'rgba(140, 60, 200, 0.35)' }));
    // 青の四角形
    particles.push(new Particle({ sides: 4, color: 'rgba(40, 120, 220, 0.35)' }));
    // 緑の五角形
    particles.push(new Particle({ sides: 5, color: 'rgba(50, 180, 80, 0.35)' }));

    // 面積が広くなった分（PADDING分）を含めて、密度を少し高めに計算する
    const area = (width + PADDING * 2) * (height + PADDING * 2);
    const numParticles = Math.floor(area / 9000); // 10000から9000にして「ほんの少し増やす」
    for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle());
    }
}

function animate() {
    ctx.clearRect(0, 0, width, height);
    particles.forEach(p => {
        p.update(particles);
        p.draw();
    });
    requestAnimationFrame(animate);
}

// 初期化
resize();
animate();

// 学年の自動計算（4月1日進級）
function updateGrade() {
    const gradeDisplay = document.getElementById('grade-display');
    if (!gradeDisplay) return;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonthは0から始まるため+1

    // 入学年度を2025年度とする（2026年5月で2回生）
    const enrollmentYear = 2025;
    
    // 現在の「年度」を計算（1月〜3月は前年度扱い）
    let currentSchoolYear = currentYear;
    if (currentMonth < 4) {
        currentSchoolYear -= 1;
    }

    let grade = currentSchoolYear - enrollmentYear + 1;

    const isEn = document.documentElement.lang === 'en';
    if (grade >= 5) {
        gradeDisplay.innerText = isEn ? "Alumni (Graduated 2029)" : "卒業生（2029年卒業）";
    } else if (grade > 0) {
        gradeDisplay.innerText = isEn ? `${grade}${grade === 1 ? 'st' : grade === 2 ? 'nd' : grade === 3 ? 'rd' : 'th'} Year Student (Expected Graduation: 2029)` : grade + "回生（2029年卒業予定）";
    } else {
        gradeDisplay.innerText = isEn ? "Pre-enrollment (Expected Graduation: 2029)" : "入学前（2029年卒業予定）";
    }
}

// 学年計算を実行
updateGrade();

// --- 謎解きの判定・演出ロジック ---
const TARGET_ANSWERS = ['open', 'rule', 'text'];
const solvedWords = new Set();
const isEn = document.documentElement.lang === 'en';

const explanationsJP = {
    final_prefix: `
        <div style="margin-bottom: 20px;">
            <img src="img/AnswerBar.png" alt="Answerbar" style="max-width: 100%; border-radius: 4px; margin-bottom: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <p>解答欄に、「<span class="color-yellow">黄</span>→<span class="color-purple">紫</span>→<span class="color-blue">青</span>→<span class="color-green">緑</span>」と装飾がされている。<br>
            ページ内など様々な場所から同じ四色が使われた場所を探して、言葉を導く。</p>
        </div>
        <hr style="border:none; border-top:1px dashed #ccc; margin: 30px 0;">
    `,
    rule: `
        <p><strong>【１問目　Lv.★☆☆】</strong></p>
        <p>解答欄の上に書かれた問題文<br>
        「Answ<span class="color-green"><strong>e</strong></span><span class="color-yellow"><strong>r</strong></span> in fo<span class="color-purple"><strong>u</strong></span><span class="color-yellow"><strong>r</strong></span> <span class="color-blue"><strong>l</strong></span><span class="color-green"><strong>e</strong></span>tt<span class="color-green"><strong>e</strong></span><span class="color-yellow"><strong>r</strong></span>s.」の色のついた文字を拾う。</p>
        <p class="answer-text">答えは「<strong>RULE</strong>」。</p>
    `,
    text: `
        <p><strong>【２問目　Lv.★★☆】</strong></p>
        <p>（未記入）</p>
    `,
    open: `
        <p><strong>【３問目　Lv.★★★】</strong></p>
        <p>各色の「図形の頂点の数」文字目を拾う。</p>
        <p>
            <span class="color-yellow">YELL<strong>O</strong>W</span>（五角形→５文字目）<br>
            <span class="color-purple">PUR<strong>P</strong>LE</span>（四角形→４文字目）<br>
            <span class="color-blue">BLU<strong>E</strong></span>（四角形→４文字目）<br>
            <span class="color-green">GREE<strong>N</strong></span>（五角形→５文字目）
        </p>
        <p class="answer-text">答えは「<strong>OPEN</strong>」。</p>
    `
};

const explanationsEN = {
    final_prefix: `
        <div style="margin-bottom: 20px;">
            <img src="../img/AnswerBar.png" alt="Answerbar" style="max-width: 100%; border-radius: 4px; margin-bottom: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <p>The answer field is decorated with "<span class="color-yellow">Yellow</span> &rarr; <span class="color-purple">Purple</span> &rarr; <span class="color-blue">Blue</span> &rarr; <span class="color-green">Green</span>".<br>
            Find where these same four colors are used across the page to deduce the answer.</p>
        </div>
        <hr style="border:none; border-top:1px dashed #ccc; margin: 30px 0;">
    `,
    rule: `
        <p><strong>[ Question 1 - Lv.★☆☆ ]</strong></p>
        <p>Look at the question text above the answer field.<br>
        Extract the colored letters from "Answ<span class="color-green"><strong>e</strong></span><span class="color-yellow"><strong>r</strong></span> in fo<span class="color-purple"><strong>u</strong></span><span class="color-yellow"><strong>r</strong></span> <span class="color-blue"><strong>l</strong></span><span class="color-green"><strong>e</strong></span>tt<span class="color-green"><strong>e</strong></span><span class="color-yellow"><strong>r</strong></span>s."</p>
        <p class="answer-text">The answer is "<strong>RULE</strong>".</p>
    `,
    text: `
        <p><strong>[ Question 2 - Lv.★★☆ ]</strong></p>
        <p>(Blank)</p>
    `,
    open: `
        <p><strong>[ Question 3 - Lv.★★★ ]</strong></p>
        <p>Extract the N-th letter of each color word, where N is the number of vertices of the shapes drifting in the background.</p>
        <p>
            <span class="color-yellow">YELL<strong>O</strong>W</span> (Pentagon &rarr; 5th letter)<br>
            <span class="color-purple">PUR<strong>P</strong>LE</span> (Square &rarr; 4th letter)<br>
            <span class="color-blue">BLU<strong>E</strong></span> (Square &rarr; 4th letter)<br>
            <span class="color-green">GREE<strong>N</strong></span> (Pentagon &rarr; 5th letter)
        </p>
        <p class="answer-text">The answer is "<strong>OPEN</strong>".</p>
    `
};

const explanations = isEn ? explanationsEN : explanationsJP;

const delay = ms => new Promise(res => setTimeout(res, ms));

// スクロール無効化用の関数
function preventDefaultScroll(e) {
    e.preventDefault();
}

function setScrollLock(locked) {
    const blocker = document.getElementById('scroll-blocker');
    if (!blocker) return;
    if (locked) {
        blocker.style.display = 'block';
        blocker.addEventListener('wheel', preventDefaultScroll, { passive: false });
        blocker.addEventListener('touchmove', preventDefaultScroll, { passive: false });
    } else {
        blocker.style.display = 'none';
        blocker.removeEventListener('wheel', preventDefaultScroll);
        blocker.removeEventListener('touchmove', preventDefaultScroll);
    }
}

function showError(msg) {
    const errorMsg = document.getElementById('puzzle-error');
    if (!errorMsg) return;
    errorMsg.innerText = msg;
    errorMsg.classList.add('visible');
    
    // 一定時間後に自動で消去する
    setTimeout(() => {
        errorMsg.classList.remove('visible');
    }, 2500);
}

async function checkPuzzle() {
    const input = document.getElementById('puzzle-input');
    const submitBtn = document.getElementById('puzzle-submit');
    const errorMsg = document.getElementById('puzzle-error');
    if (!input) return;

    let val = input.value.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });
    val = val.toLowerCase().trim();

    errorMsg.classList.remove('visible');

    if (solvedWords.has(val)) {
        showError(isEn ? "Already answered." : "すでに回答済みのようだ");
        return;
    }
    
    if (!TARGET_ANSWERS.includes(val)) {
        const wrapper = input.parentElement;
        wrapper.classList.remove('shake-anim');
        void wrapper.offsetWidth;
        wrapper.classList.add('shake-anim');
        return;
    }

    solvedWords.add(val);
    localStorage.setItem('portfolio_puzzle_progress', JSON.stringify(Array.from(solvedWords)));
    input.disabled = true;
    submitBtn.disabled = true;
    await handleCorrectSequence(val);
}

async function handleCorrectSequence(word) {
    const worksSection = document.getElementById('works');
    const backdrop = document.getElementById('dark-backdrop');
    const count = solvedWords.size;
    
    // アニメーション中はスクロールなどの操作を無効化
    setScrollLock(true);
    
    backdrop.classList.add('visible');
    
    if (count === 1) {
        const secretWork = document.createElement('a');
        secretWork.href = "javascript:void(0)";
        secretWork.className = "work-card highlight-card progress-locked placeholder-mode";
        secretWork.id = "portfolio-secret-work";
        secretWork.innerHTML = `
            <div class="work-card-img">
                <img src="${isEn ? '../' : ''}img/portfolio.png" alt="Portfolio">
            </div>
            <div class="work-card-content">
                <h3>Portfolio</h3>
                <div class="tag">${isEn ? 'Genre: Riddle | Platform: Web' : 'ジャンル：謎解き | 媒体：Web'}</div>
                <p>${isEn ? 'Uncover the hidden riddles.' : '隠された謎を解き明かせ'}</p>
            </div>
            <div class="work-card-action progress-mode" id="portfolio-action">
                <div class="progress-bg" id="portfolio-progress"></div>
                <span class="action-text progress-text" id="portfolio-action-text">1/3</span>
            </div>
        `;
        
        // 高さを正確に計算するために一旦見えない状態で追加
        secretWork.style.visibility = 'hidden';
        secretWork.style.position = 'absolute';
        secretWork.style.display = 'flex';
        secretWork.style.width = worksSection.clientWidth + 'px'; // 親の幅に合わせる
        worksSection.appendChild(secretWork);
        
        // 本来の高さを測定
        const targetHeight = secretWork.offsetHeight;
        
        // アニメーションの初期状態にリセット
        secretWork.style.position = '';
        secretWork.style.visibility = '';
        secretWork.style.width = '';
        secretWork.style.overflow = 'hidden';
        secretWork.style.height = '0px';
        secretWork.style.marginBottom = '0px';
        secretWork.style.opacity = '0';
        secretWork.style.transition = 'height 1.5s cubic-bezier(0.4, 0, 0.2, 1), margin-bottom 1.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.8s ease-in-out 0.5s';
        
        const resetContainer = document.getElementById('portfolio-reset-container');
        if (resetContainer) {
            worksSection.insertBefore(secretWork, resetContainer);
        } else {
            worksSection.appendChild(secretWork);
        }
        
        // リフローを強制
        void secretWork.offsetHeight;
        
        await delay(50);
        
        // スムーズに空間を開けながらフェードイン
        secretWork.style.height = targetHeight + 'px';
        secretWork.style.marginBottom = '40px';
        secretWork.style.opacity = '1';
        
        // 空間が開ききるのを待つ
        await delay(1500);
        
        // 展開しきってから、ゲージ部分を中心にスクロール
        document.getElementById('portfolio-action').scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // 光の演出を見せる
        await delay(800);
        
        // プレースホルダー状態を解除して中身を見せる
        secretWork.classList.remove('placeholder-mode');
        // 高さをautoに戻し、hover用の通常のトランジションに戻す
        secretWork.style.height = 'auto';
        secretWork.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
        
        await delay(300);
        
        const actionArea = document.getElementById('portfolio-action');
        actionArea.classList.add('animating');
        secretWork.classList.add('elevated-anim');
        
        const progress = document.getElementById('portfolio-progress');
        progress.style.transition = '';
        progress.style.width = '33.3%';
        await delay(2000); // ゲージ上昇を2秒待つ
        
        actionArea.classList.remove('animating');
        secretWork.classList.remove('elevated-anim');
        
        // リセットボタンを表示
        if (resetContainer) {
            resetContainer.style.display = 'block';
            resetContainer.style.opacity = '0';
            resetContainer.style.transition = 'opacity 0.5s ease';
            setTimeout(() => { resetContainer.style.opacity = '1'; }, 50);
        }
        await delay(300);
        
    } else {
        const secretWork = document.getElementById('portfolio-secret-work');
        secretWork.classList.add('highlight-card');
        document.getElementById('portfolio-action').scrollIntoView({ behavior: 'smooth', block: 'center' });
        await delay(1000); // スクロール完了をゆったり待つ
        
        const actionArea = document.getElementById('portfolio-action');
        const progress = document.getElementById('portfolio-progress');
        const actionText = document.getElementById('portfolio-action-text');
        
        if (count === 2) {
            actionText.innerText = "2/3";
            actionArea.classList.add('animating');
            secretWork.classList.add('elevated-anim');
            
            progress.style.transition = '';
            progress.style.width = '66.6%';
            await delay(2000);
            
            actionArea.classList.remove('animating');
            secretWork.classList.remove('elevated-anim');
            await delay(300);
        } else if (count === 3) {
            actionText.innerText = "3/3";
            actionArea.classList.add('animating');
            secretWork.classList.add('elevated-anim');
            
            progress.style.transition = '';
            progress.style.width = '100%';
            await delay(2000);
            
            actionArea.classList.remove('animating');
            secretWork.classList.remove('elevated-anim');
            
            const congrats = document.getElementById('congratulations-text');
            congrats.classList.add('visible');
            
            // 説明文を変更
            const desc = secretWork.querySelector('.work-card-content p');
            if (desc) {
                desc.innerHTML = isEn 
                    ? "You've uncovered the hidden riddles within the portfolio.<br>Congratulations on getting all answers right!"
                    : "ポートフォリオの中に隠された謎を解き明かす。<br>全問正解、おめでとうございます！";
            }
            
            await delay(2000);
            congrats.classList.remove('visible');
            await delay(500);
            
            actionArea.classList.remove('progress-mode');
            actionArea.classList.remove('progress-mode');
            actionArea.innerHTML = `
                <span class="action-text">${isEn ? 'View Explanation' : '解説を見る'}</span>
                <span class="action-arrow">→</span>
            `;
            
            // 進行中のホバー無効化を解除
            secretWork.classList.remove('progress-locked');
            
            secretWork.addEventListener('click', (e) => {
                e.preventDefault();
                showExplanationModal('all');
            });
        }
    }
    
    showExplanationModal(word);
}

function showExplanationModal(type) {
    const overlay = document.getElementById('puzzle-overlay');
    const expContainer = document.querySelector('.puzzle-explanation');
    
    if (type === 'all') {
        expContainer.innerHTML = explanations['final_prefix'] + 
                                 explanations['rule'] + 
                                 '<hr style="border:none; border-top:1px dashed #ccc; margin: 30px 0;">' + 
                                 explanations['text'] + 
                                 '<hr style="border:none; border-top:1px dashed #ccc; margin: 30px 0;">' + 
                                 explanations['open'];
    } else {
        expContainer.innerHTML = explanations[type];
    }
    
    document.getElementById('dark-backdrop').classList.remove('visible');
    const secretWork = document.getElementById('portfolio-secret-work');
    if(secretWork) secretWork.classList.remove('highlight-card');
    
    // モーダル表示時にアニメーションロックを解除（モーダル内はスクロール可能に）
    setScrollLock(false);
    
    overlay.classList.add('visible');
}

const submitBtn = document.getElementById('puzzle-submit');
const inputField = document.getElementById('puzzle-input');
const closeBtn = document.getElementById('puzzle-close');
const overlay = document.getElementById('puzzle-overlay');

if (submitBtn) submitBtn.addEventListener('click', checkPuzzle);
if (inputField) {
    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') checkPuzzle();
    });
}

const closeBtnTop = document.getElementById('puzzle-close-top');

function closeModal() {
    overlay.classList.remove('visible');
    if (solvedWords.size < 3) {
        inputField.disabled = false;
        submitBtn.disabled = false;
        inputField.value = '';
    } else {
        inputField.value = 'CLEARED';
        inputField.parentElement.classList.add('solved');
    }
}

if (overlay) {
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (closeBtnTop) closeBtnTop.addEventListener('click', closeModal);
}

// --- 進捗の保存と復元 ---
function initPuzzleProgress() {
    const saved = localStorage.getItem('portfolio_puzzle_progress');
    if (saved) {
        try {
            const words = JSON.parse(saved);
            words.forEach(w => {
                if (TARGET_ANSWERS.includes(w)) {
                    solvedWords.add(w);
                }
            });
        } catch (e) {}
    }

    if (solvedWords.size > 0) {
        restorePuzzleUIState();
    }
}

function restorePuzzleUIState() {
    const worksSection = document.getElementById('works');
    const count = solvedWords.size;
    
    const secretWork = document.createElement('a');
    secretWork.href = "javascript:void(0)";
    secretWork.className = "work-card highlight-card"; // アニメーションなしの通常状態
    secretWork.id = "portfolio-secret-work";
    
    let progressWidth = '0%';
    let actionText = '';
    let actionHTML = '';
    let descText = isEn ? 'Uncover the hidden riddles.' : '隠された謎を解き明かせ';
    
    if (count === 1) {
        progressWidth = '33.3%';
        actionText = '1/3';
    } else if (count === 2) {
        progressWidth = '66.6%';
        actionText = '2/3';
    } else if (count === 3) {
        progressWidth = '100%';
        descText = isEn 
            ? "You've uncovered the hidden riddles within the portfolio.<br>Congratulations on getting all answers right!"
            : "ポートフォリオの中に隠された謎を解き明かす。<br>全問正解、おめでとうございます！";
    }

    if (count < 3) {
        actionHTML = `
            <div class="work-card-action progress-mode" id="portfolio-action">
                <div class="progress-bg" id="portfolio-progress" style="width: ${progressWidth}; transition: none;"></div>
                <span class="action-text progress-text" id="portfolio-action-text">${actionText}</span>
            </div>
        `;
        secretWork.classList.add('progress-locked');
    } else {
        actionHTML = `
            <div class="work-card-action" id="portfolio-action">
                <span class="action-text">${isEn ? 'View Explanation' : '解説を見る'}</span>
                <span class="action-arrow">→</span>
            </div>
        `;
        secretWork.classList.remove('progress-locked');
    }

    secretWork.innerHTML = `
        <div class="work-card-img">
            <img src="${isEn ? '../' : ''}img/portfolio.png" alt="Portfolio">
        </div>
        <div class="work-card-content">
            <h3>Portfolio</h3>
            <div class="tag">${isEn ? 'Genre: Riddle | Platform: Web' : 'ジャンル：謎解き | 媒体：Web'}</div>
            <p>${descText}</p>
        </div>
        ${actionHTML}
    `;
    const resetContainer = document.getElementById('portfolio-reset-container');
    if (resetContainer) {
        worksSection.insertBefore(secretWork, resetContainer);
        resetContainer.style.display = 'block';
        resetContainer.style.opacity = '1';
    } else {
        worksSection.appendChild(secretWork);
    }

    if (count === 3) {
        secretWork.addEventListener('click', (e) => {
            e.preventDefault();
            showExplanationModal('all');
        });
        
        const inputF = document.getElementById('puzzle-input');
        const submitB = document.getElementById('puzzle-submit');
        if (inputF) {
            inputF.disabled = true;
            inputF.value = 'CLEARED';
            inputF.parentElement.classList.add('solved');
        }
        if (submitB) {
            submitB.disabled = true;
        }
    }
}

// リセット機能の設定
const resetBtn = document.getElementById('portfolio-reset-btn');
const resetModal = document.getElementById('reset-modal');
const resetConfirm = document.getElementById('reset-confirm');
const resetCancel = document.getElementById('reset-cancel');

if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        resetModal.classList.add('visible');
    });
}
if (resetCancel) {
    resetCancel.addEventListener('click', () => {
        resetModal.classList.remove('visible');
    });
}
if (resetConfirm) {
    resetConfirm.addEventListener('click', () => {
        localStorage.removeItem('portfolio_puzzle_progress');
        solvedWords.clear();
        
        resetModal.classList.remove('visible');
        
        const secretWork = document.getElementById('portfolio-secret-work');
        if (secretWork) secretWork.remove();
        
        const resetContainer = document.getElementById('portfolio-reset-container');
        if (resetContainer) {
            resetContainer.style.display = 'none';
            resetContainer.style.opacity = '0';
        }
        
        const inputF = document.getElementById('puzzle-input');
        const submitB = document.getElementById('puzzle-submit');
        if (inputF) {
            inputF.disabled = false;
            inputF.value = '';
            inputF.parentElement.classList.remove('solved');
        }
        if (submitB) {
            submitB.disabled = false;
        }
    });
}

// 初期化実行
initPuzzleProgress();
