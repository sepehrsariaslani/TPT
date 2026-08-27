import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import GranuleScene from './scene/GranuleScene.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';

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
    if (uiProgress < 0.16) return 0;
    if (uiProgress < 0.36) return 1;
    if (uiProgress < 0.55) return 2;
    if (uiProgress < 0.69) return 3;
    if (uiProgress < 0.86) return 4;
    return 5;
  }, [uiProgress]);

  const introFade = 1 - smooth(uiProgress / 0.12);
  const productMoment = smooth((uiProgress - 0.44) / 0.06) * (1 - smooth((uiProgress - 0.68) / 0.08));
  const outroFade = smooth((uiProgress - 0.89) / 0.07);

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
          <div className="experience__sticky">
            <div className="canvas-shell" aria-hidden="true">
              <ErrorBoundary scope="canvas">
                <Canvas
                  dpr={[1, 1.65]}
                  camera={{ position: [0, 2.7, 10.7], fov: 38, near: 0.1, far: 80 }}
                  gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
                  onCreated={({ gl }) => {
                    window.__tptWebgl = gl.getContext()?.getParameter?.(0x1f01) || 'webgl-ok';
                    try {
                      fetch('/__client-log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'webgl-ready', renderer: window.__tptWebgl }),
                      }).catch(() => {});
                    } catch (e) { /* noop */ }
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
                اسکرول کنید؛ گرانول‌های پلیمر از بالا وارد می‌شوند، دور مسیر شکل‌گیری می‌چرخند و آرام‌آرام به محصول نهایی تبدیل می‌شوند.
              </p>
            </div>

            <div className="scroll-cue" style={{ opacity: 1 - smooth(uiProgress / 0.09) }}>
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

            <div className="outro-cue" style={{ opacity: outroFade }}>
              <span>مواد دوباره آزاد می‌شوند</span>
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
                صحنه بالا کاملاً سه‌بعدی و وابسته به اسکرول است؛ نه یک ویدئوی از پیش رندر شده. جهت حرکت، سرعت تبدیل و لحظه توقف مستقیماً با اسکرول کاربر کنترل می‌شود.
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
              <small>حرکت رفت و برگشت بدون پرش</small>
            </article>
            <article>
              <span>Rendering</span>
              <strong>WebGL / Three.js</strong>
              <small>رندر زنده داخل مرورگر</small>
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
