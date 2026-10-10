export function Icon({ name, size = 24, ...props }) {
  const paths = {
    arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
    back: <><path d="M20 12H5M11 5l-7 7 7 7" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>,
    leaf: <><path d="M19 4C8 3 3 9 5 15s12 6 14-11Z" /><path d="m5 20 10-10" /></>,
    sound: <><path d="m11 5-5 4H3v6h3l5 4V5Z" /><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    mute: <><path d="m11 5-5 4H3v6h3l5 4V5Z" /><path d="m16 9 6 6m0-6-6 6" /></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    bowl: <><path d="M3 12h18c-1 7-4 9-9 9s-8-2-9-9ZM8 3v4m4-5v5m4-4v4" /></>,
    restart: <><path d="M4 9a8 8 0 1 1 0 7M4 3v6h6" /></>,
    close: <path d="m5 5 14 14M19 5 5 19" />,
    book: <><path d="M12 5C8 2 3 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-4-2-7-1-10 1Zm0 0v15" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" /></>,
    spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /></>,
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.bowl}</svg>;
}

export function PastaIllustration() {
  const noodles = Array.from({ length: 15 }, (_, i) => {
    const x = 140 + (i % 5) * 35, y = 135 + Math.floor(i / 5) * 30;
    return <path key={i} d={`M${x} ${y}c-24-21-40 12-14 19s55-23 27-36-37 33-8 43`} fill="none" stroke={i % 3 ? '#e9b751' : '#d69a39'} strokeWidth="10" strokeLinecap="round" />;
  });
  return <svg className="pasta-illustration" viewBox="0 0 460 350" role="img" aria-label="An illustration of pasta with tomato sauce and basil on a ceramic plate">
    <defs><radialGradient id="plate"><stop stopColor="#fffefa"/><stop offset=".8" stopColor="#f4eee0"/><stop offset="1" stopColor="#e9deca"/></radialGradient><filter id="shadow"><feGaussianBlur stdDeviation="9"/></filter></defs>
    <ellipse cx="230" cy="252" rx="155" ry="42" fill="#4f4b32" opacity=".13" filter="url(#shadow)" />
    <circle cx="232" cy="172" r="145" fill="url(#plate)" />
    <circle cx="232" cy="172" r="119" fill="none" stroke="#ded3bd" strokeWidth="1.5" />
    <circle cx="232" cy="172" r="98" fill="#efe2c5" />
    <path d="M157 111c32-31 120-19 139 21 29 22 9 89-35 98-30 14-106-10-117-47-15-21-11-53 13-72Z" fill="#bb5238" />
    {noodles}
    <g fill="#c9573c"><circle cx="175" cy="126" r="11"/><circle cx="271" cy="199" r="9"/><circle cx="293" cy="147" r="10"/><circle cx="204" cy="208" r="8"/></g>
    <g stroke="#366342" strokeWidth="1"><path d="M245 105q-47-28-53 16 34 17 53-16Z" fill="#477a50"/><path d="M240 112q38-41 52-8-12 32-52 8Z" fill="#568352"/><path d="M239 110q18 39-9 47-27-15 9-47Z" fill="#366342"/></g>
    <g fill="#fcf4d4"><path d="m184 151 19 8-2 5-21-9Z"/><path d="m265 171 23-3 1 5-22 5Z"/><path d="m212 126 18 5-2 5-18-5Z"/></g>
    <g fill="#486a45"><circle cx="173" cy="174" r="2"/><circle cx="285" cy="164" r="2"/><circle cx="239" cy="204" r="2"/><circle cx="192" cy="198" r="2"/></g>
    <g stroke="#c2ad84" strokeWidth="4" strokeLinecap="round"><path d="m403 50-29 228m22-239-5 44m12-42-6 45m-19-47-2 44m-9-46-3 43q13 14 26 6"/></g>
    <path d="M64 39c-4 9-4 20 3 28" fill="none" stroke="#a8b696" strokeWidth="2" strokeLinecap="round"/><path d="M79 22c-6 11-6 21 0 33" fill="none" stroke="#a8b696" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}
