// the vendored React app needs RBC's design library CSS, so it runs in a same-origin iframe
export default function decorate(widget) {
  const frame = widget.querySelector('iframe');
  const lang = document.documentElement.lang.startsWith('fr') ? 'fr' : 'en';
  frame.title = document.querySelector('h1')?.textContent.trim() || '';
  frame.src = `${window.hlx.codeBasePath}/widgets/budget-calculator/app/index.html?lang=${lang}`;
  frame.addEventListener('load', () => {
    const win = frame.contentWindow;
    // the design library stretches its wrappers to the viewport, so measure the app root
    const app = win.document.getElementById('root');
    const fit = () => { frame.style.height = `${app.getBoundingClientRect().bottom + win.scrollY}px`; };
    new win.ResizeObserver(fit).observe(app);
    // the app scrolls to its top on each step; bring the frame's top into view instead
    win.scrollTo = () => frame.scrollIntoView({ behavior: 'smooth' });
  });
}
