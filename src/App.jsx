import { Canvas } from '@react-three/fiber';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import ErrorBoundary from './ErrorBoundary.jsx';

const GranuleScene = lazy(() => import('./scene/GranuleScene.jsx'));

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smooth = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

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
      setUiProgress((current) => (Math.abs(current - next) > 0.001 ? next : current));
    };

    const requestUpdate = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    return () => {
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const phase = useMemo(() => {
    if (uiProgress < 0.12) return 0;
    if (uiProgress < 0.27) return 1;
    if (uiProgress < 0.49) return 2;
    if (uiProgress < 0.64) return 3;
    if (uiProgress < 0.8) return 4;
    return 5;
  }, [uiProgress]);

  const introFade = 1 - smooth(uiProgress / 0.1);
  const productMoment = smooth((uiProgress - 0.6) / 0.1) * (1 - smooth((uiProgress - 0.94) / 0.05));
  const finalFade = smooth((uiProgress - 0.82) / 0.08);

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
        <section
          ref={experienceRef}
          className="experience"
          id="experience"
          style={{ height: '520vh' }}
        >
          <div className="experience__sticky">
            <div className="canvas-shell" aria-hidden="true">
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(circle at 50% 42%, rgba(28, 91, 205, .18), transparent 34rem), #01050d',
                  opacity: canvasReady ? 0 : 1,
                  transition: 'opacity 380ms ease',
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              />
              <ErrorBoundary scope="canvas">
                <Canvas
                  dpr={[0.85, 1.3]}
                  camera={{ position: [0, 3.25, 11.25], fov: 38, near: 0.1, far: 70 }}
                  gl={{
                    antialias: false,
                    alpha: false,
                    stencil: false,
                    powerPreference: 'high-performance',
                  }}
                  performance={{ min: 0.6 }}
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

            <div className="screen-noise" style={{ opacity: 0.022 }} />
            <div className="screen-vignette" />
            <div className="blueprint-grid" style={{ opacity: 0.035 }} />

            <div
              className="hero-copy"
              style={{
                opacity: introFade,
                transform: `translate3d(0, ${32 * (1 - introFade)}px, 0)`,
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
                اسکرول کنید؛ گرانول‌های پلیمر از بالا وارد می‌شوند، ابتدا در حلقه‌ها هم‌راستا می‌شوند، سپس گردابه شکل می‌گیرد و ماده بدون حذف شدن به فرم محصول می‌رسد.
              </p>
            </div>

            <div className="scroll-cue" style={{ opacity: 1 - smooth(uiProgress / 0.075) }}>
              <span>SCROLL</span>
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
                {[0, 1, 2, 3, 4, 5].map((item) => (
                  <i key={item} className={item <= phase ? 'is-active' : ''} />
                ))}
              </div>
            </div>

            <div className="corner-data corner-data--left" aria-hidden="true">
              <span>RAW</span>
              <b>{String(Math.round(uiProgress * 100)).padStart(3, '0')}</b>
            </div>
            <div className="corner-data corner-data--right" aria-hidden="true">
              <span>TPT / POLYMER</span>
              <b>BLUEPRINT 01</b>
            </div>

            <div className="outro-cue" style={{ opacity: finalFade }}>
              <span>محصول نهایی</span>
              <ArrowDown />
            </div>
          </div>
        </section>

        <section className="product-section" id="product">
          <div className="product-section__glow" />
          <div className="section-kicker">TPT / PRODUCT SYSTEM</div>
          <div className="product-section__grid">
            <div>
              <h2>یک حرکت پیوسته،<br />از ماده تا محصول.</h2>
            </div>
            <div className="product-section__copy">
              <p>
                صحنه بالا کاملاً سه‌بعدی و وابسته به اسکرول است؛ نه یک ویدئوی از پیش رندر شده. دانه‌ها در تمام مسیر حفظ می‌شوند و در مرحله نهایی داخل حجم محصول قرار می‌گیرند، نه اینکه ناگهان حذف شوند.
              </p>
              <div className="mini-specs">
                <span><b>01</b> Granules</span>
                <span><b>02</b> Vortex</span>
                <span><b>03</b> Product</span>
              </div>
            </div>
          </div>

          <div className="product-plates">
            <article>
              <span>Material</span>
              <strong>PP / PE / ABS</strong>
              <small>قابل تغییر برای گرید واقعی شما</small>
            </article>
            <article>
              <span>Motion</span>
              <strong>Scroll Scrub</strong>
              <small>شش مرحله پیوسته و سریع‌تر</small>
            </article>
            <article>
              <span>Rendering</span>
              <strong>WebGL / Three.js</strong>
              <small>رندر زنده با هندسه و draw-call بهینه‌شده</small>
            </article>
          </div>
        </section>

        <section className="contact-section" id="contact">
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
