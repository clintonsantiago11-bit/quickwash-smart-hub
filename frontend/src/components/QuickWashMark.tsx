interface QuickWashMarkProps {
  className?: string;
  title?: string;
}

/** QuickWash's geometric Q: a wash-cycle ring with a water-line cutout. */
export default function QuickWashMark({ className, title }: QuickWashMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <rect x="3" y="3" width="42" height="42" rx="13" fill="#0C1929" stroke="#22D3EE" strokeWidth="2" />
      <path
        d="M31.5 14.5a12 12 0 1 0 3.1 18.1"
        fill="none"
        stroke="#F8FAFC"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="m29 29 9 9" fill="none" stroke="#22D3EE" strokeWidth="5" strokeLinecap="round" />
      <path
        d="M15 26c3.3-2.7 5.2 2.7 8.5 0s5.2 2.7 8.5 0"
        fill="none"
        stroke="#67E8F9"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
