import { Canvas } from '@react-three/fiber';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import ErrorBoundary from './ErrorBoundary.jsx';
import './experience-overrides.css';

const GranuleScene = lazy(() => import('./scene/GranuleScene.jsx'));

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

const STAGES = [
  {
    number: '01',
    code: 'RAW MATERIAL',
    title: 'ورود مواد اولیه',
    body: 'گرانول‌های پلیمر در چند لاین مستقل و پیوسته وارد فرآیند می‌شوند؛ جریان ماده هیچ‌وقت قطع نمی‌شود.',
  },
  {
    number: '02',
    code: 'FLOW ALIGNMENT',
    title: 'هدایت و هم‌راستاسازی',
    body: 'لاین‌های جدا آرام به مرکز خم می‌شوند و یک جریان کنترل‌شده و منظم را شکل می‌دهند.',
  },
  {
    number: '03',
    code: 'COMPRESSION',
    title: 'فشرده‌سازی جریان',
    body: 'مسیرها روی هم جمع می‌شوند؛ فاصله‌ی دانه‌ها کمتر می‌شود و جرم ماده به فرم متراکم نزدیک می‌شود.',
  },
  {
    number: '04',
    code: 'PREFORM',
    title: 'ساخت پیش‌فرم',
    body: 'جریان فشرده تخت می‌شود و به صورت لایه‌های متحدالمرکز، هندسه‌ی اولیه‌ی محصول را می‌سازد.',
  },
  {
    number: '05',
    code: 'FUSION',
    title: 'همجوشی و شکل‌گیری',
    body: 'هر گرانول به نقطه‌ی هدف روی سطح می‌رسد و به‌تدریج در پوسته‌ی محصول جذب می‌شود؛ بدون پرش ناگهانی.',
  },
  {
    number: '06',
    code: 'FINAL PRODUCT',
    title: 'محصول نهایی',
    body: 'جریان ماده کامل شده است. سطح تمیز، یکپارچه و آماده است تا تجربه وارد بخش بعدی سایت شود.',
  },
];

const STAGE_EDGES = [0, 0.11, 0.24, 0.39, 0.54, 0.72, 1];

function BrandMark() {
  return (
    <svg viewBox="0 0 44 44" aria-hidden="true">
      <path d="M22 3 38 12v20L22 41 6 32V12L22 3Z" />
      <path d="M22 10 31.5 15.5v12L22 33l-9.5-5.5v-12L22 10Z" />
      <circle cx="22" cy="22" r="3.6" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v14M6.5 12.5 12 18l5.5-5.5" />
    </svg>
  );
}

export default function App() {
  const experienceRef = useRef(null);
  const progressRef = useRef(0);
  const [uiProgress, setUiProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth <= 680 : false
  ));

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const section = experienceRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, section.offsetHeight - window.innerHeight);
      const next = clamp01(-rect.top / travel);

      progressRef.current = next;
      setUiProgress((current) => (Math.abs(current - next) > 0.0008 ? next : current));
    };

    const requestUpdate = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const handleResize = () => {
      setIsMobile(window.innerWidth <= 680);
      requestUpdate();
    };

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', handleResize);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const phase = useMemo(() => {
    if (uiProgress < STAGE_EDGES[1]) return 0;
    if (uiProgress < STAGE_EDGES[2]) return 1;
    if (uiProgress < STAGE_EDGES[3]) return 2;
    if (uiProgress < STAGE_EDGES[4]) return 3;
    if (uiProgress < STAGE_EDGES[5]) return 4;
    return 5;
  }, [uiProgress]);

  const activeStage = STAGES[phase];
  const stageStart = STAGE_EDGES[phase];
  const stageEnd = STAGE_EDGES[phase + 1];
  const stageProgress = clamp01((uiProgress - stageStart) / Math.max(0.0001, stageEnd - stageStart));

  const introFade = 1 - smooth(uiProgress / 0.075);
  const stagePanelFade = smooth((uiProgress - 0.055) / 0.05);
  const productMoment = smooth((uiProgress - 0.56) / 0.08) * (1 - smooth((uiProgress - 0.96) / 0.035));
  const finalFade = smooth((uiProgress - 0.73) / 0.055);

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#experience" aria-label="TPT">
          <span className="brand__mark"><BrandMark /></span>
          <span className="brand__word">TPT</span>
        </a>

        <nav className={`topbar__nav ${menuOpen ? 'is-open' : ''}`}>
          <a href="#experience" onClick={() => setMenuOpen(false)}>تجربه</a>
          <a href="#product" onClick={() => setMenuOpen(false)}>محصول</a>
          <a href="#contact" onClick={() => setMenuOpen(false)}>تماس</a>
        </nav>

        <button
          className="menu-button"
          type="button"
          aria-label="باز کردن منو"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span />
          <span />
        </button>
      </header>

      <main>
        <section ref={experienceRef} className="experience" id="experience">
          <div
            className="experience__sticky"
            style={{
              '--scroll-progress': uiProgress,
              '--stage-progress': stageProgress,
            }}
          >
            <div className="canvas-shell" aria-hidden="true">
              <div className={`canvas-loader ${canvasReady ? 'is-ready' : ''}`} />
              <ErrorBoundary scope="canvas">
                <Canvas
                  dpr={isMobile ? [0.7, 1] : [0.85, 1.25]}
                  camera={{
                    position: isMobile ? [0, 2.8, 16.2] : [0, 3.15, 11.25],
                    fov: isMobile ? 44 : 38,
                    near: 0.1,
                    far: 70,
                  }}
                  gl={{
                    antialias: false,
                    alpha: false,
                    stencil: false,
                    powerPreference: 'high-performance',
                  }}
                  performance={{ min: isMobile ? 0.5 : 0.62 }}
                  onCreated={() => {
                    requestAnimationFrame(() => setCanvasReady(true));
                  }}
                >
                  <Suspense fallback={null}>
                    <GranuleScene progressRef={progressRef} />
                  </Suspense>
                </Canvas>
              </ErrorBoundary>
            </div>

            <div className="screen-noise" />
            <div className="screen-vignette" />
            <div className="blueprint-grid" />
            <div className="scroll-light" aria-hidden="true" />

            <div
              className="hero-copy"
              style={{
                opacity: introFade,
                transform: `translate3d(0, ${28 * (1 - introFade)}px, 0)`,
                pointerEvents: introFade > 0.5 ? 'auto' : 'none',
              }}
            >
              <p className="eyebrow"><span /> TPT / INJECTION MOLDING</p>
              <h1>
                از <strong>گرانول</strong>
                <br />
                تا فرم نهایی.
              </h1>
              <p className="hero-copy__body">
                با اسکرول، چند جریان مستقل ماده به هم نزدیک می‌شوند، فشرده می‌شوند و در یک تبدیل پیوسته به محصول نهایی می‌رسند.
              </p>
            </div>

            <aside className="stage-panel" style={{ opacity: stagePanelFade }} aria-live="polite">
              <div className="stage-panel__inner" key={activeStage.number}>
                <div className="stage-panel__topline">
                  <strong>{activeStage.number}</strong>
                  <span>{activeStage.code}</span>
                </div>
                <h2>{activeStage.title}</h2>
                <p>{activeStage.body}</p>
                <div className="stage-panel__progress" aria-hidden="true">
                  <span style={{ transform: `scaleX(${stageProgress})` }} />
                </div>
                <div className="stage-panel__meta">
                  <span>PROCESS {phase + 1} / {STAGES.length}</span>
                  <b>{String(Math.round(uiProgress * 100)).padStart(2, '0')}%</b>
                </div>
              </div>
            </aside>

            <div className="scroll-cue" style={{ opacity: 1 - smooth(uiProgress / 0.065) }}>
              <span>SCROLL TO FORM</span>
              <ArrowDown />
            </div>

            <div className="product-halo-copy" style={{ opacity: productMoment }}>
              <span className="product-halo-copy__line" />
              <span>FORM / 001</span>
              <span className="product-halo-copy__line" />
            </div>

            <div className="phase-rail" aria-hidden="true">
              <div className="phase-rail__track">
                <span style={{ transform: `scaleY(${uiProgress})` }} />
              </div>
              <div className="phase-rail__dots">
                {STAGES.map((item, index) => (
                  <i key={item.number} className={index <= phase ? 'is-active' : ''} />
                ))}
              </div>
            </div>

            <div className="corner-data corner-data--left" aria-hidden="true">
              <span>RAW → FORM</span>
              <b>{String(Math.round(uiProgress * 100)).padStart(3, '0')}</b>
            </div>
            <div className="corner-data corner-data--right" aria-hidden="true">
              <span>TPT / POLYMER</span>
              <b>PROCESS 01</b>
            </div>

            <div className="outro-cue" style={{ opacity: finalFade }}>
              <span>محصول کامل شد — ادامه دهید</span>
              <ArrowDown />
            </div>
          </div>
        </section>

        <section className="product-section reveal-section" id="product">
          <div className="product-section__glow" />
          <div className="section-kicker">TPT / PRODUCT SYSTEM</div>
          <div className="product-section__grid">
            <div>
              <h2>یک حرکت پیوسته،<br />از ماده تا محصول.</h2>
            </div>
            <div className="product-section__copy">
              <p>
                چند جریان گرانول در یک مسیر کنترل‌شده جمع می‌شوند، پیش‌فرم محصول را می‌سازند و در مرحله‌ی نهایی به یک پوسته‌ی تمیز و یکپارچه تبدیل می‌شوند.
              </p>
              <div className="mini-specs">
                <span><b>01</b> Multi Stream</span>
                <span><b>02</b> Compression</span>
                <span><b>03</b> Final Form</span>
              </div>
            </div>
          </div>

          <div className="product-plates">
            <article>
              <span>Material</span>
              <strong>PP / PE / ABS</strong>
              <small>قابل تنظیم برای گرید واقعی مواد شما</small>
            </article>
            <article>
              <span>Motion</span>
              <strong>Scroll Scrub</strong>
              <small>تبدیل سریع‌تر، پیوسته و قابل برگشت با اسکرول</small>
            </article>
            <article>
              <span>Rendering</span>
              <strong>WebGL / Three.js</strong>
              <small>رندر زنده و واکنش‌گرا برای دسکتاپ و موبایل</small>
            </article>
          </div>
        </section>

        <section className="contact-section reveal-section" id="contact">
          <div>
            <span className="section-kicker">NEXT / REAL PRODUCT</span>
            <h2>مرحله بعد: مدل دقیق محصول واقعی TPT.</h2>
          </div>
          <a className="contact-button" href="mailto:info@tpt.ir">
            <span>شروع پروژه</span>
            <span>↗</span>
          </a>
        </section>
      </main>
    </div>
  );
}
