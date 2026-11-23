// Shared Tailwind class strings. Colors are chosen for WCAG AA: text ≥ 4.5:1, borders and
// focus rings of interactive controls ≥ 3:1 against white.

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

const buttonBase = `inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 font-medium disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`;

export const buttonPrimary = `${buttonBase} bg-slate-900 text-white hover:bg-slate-700`;

export const buttonSecondary = `${buttonBase} border border-slate-500 bg-white text-slate-900 hover:bg-slate-100`;

export const buttonDanger = `${buttonBase} bg-red-700 text-white hover:bg-red-800`;

export const inputBase = `block w-full min-h-11 rounded-md border border-slate-500 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-500 aria-[invalid=true]:border-red-700 ${focusRing}`;
