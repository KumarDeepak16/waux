// The WAUX mark: an ember speech slab with a monoline W, outlined and
// hard-shadowed like a sticker. Same geometry as assets/icon.svg.
let uid = 0;

export function Logo({ size = 32, shadow = true }: { size?: number; shadow?: boolean }) {
  const id = `waux-lg-${uid++}`;
  const bubble = 'M14 28a16 16 0 0 1 16-16h68a16 16 0 0 1 16 16v54a16 16 0 0 1-16 16H44l-30 22z';
  return (
    <svg class="w-logo" width={size} height={size} viewBox="0 0 128 128" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ff8a57" />
          <stop offset="1" stop-color="#e5532a" />
        </linearGradient>
      </defs>
      {shadow && <path d={bubble} transform="translate(7 7)" fill="#111214" />}
      <path d={bubble} fill={`url(#${id})`} stroke="#111214" stroke-width="5" stroke-linejoin="round" />
      <path d="M30 26h66" stroke="#fff" stroke-opacity=".35" stroke-width="3" stroke-linecap="round" />
      <path d="M34 38l12 42 18-28 18 28 12-42" fill="none" stroke="#111214" stroke-width="13" stroke-linejoin="miter" stroke-miterlimit="10" />
    </svg>
  );
}
