import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './styles/main.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Allow the BeautyIntel portal (and shareable URLs) to open Patent Librarian
// directly with a live D1 family-search query, e.g. /?q=Olaplex#/families.
const deepLinkedQuery = new URLSearchParams(window.location.search).get('q')?.trim();

if (deepLinkedQuery) {
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    const input = document.querySelector<HTMLInputElement>('input[placeholder^="Live D1 text search"]');

    if (input) {
      const nativeValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;

      nativeValueSetter?.call(input, deepLinkedQuery);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      window.clearInterval(timer);
    } else if (attempts >= 80) {
      window.clearInterval(timer);
    }
  }, 100);
}
