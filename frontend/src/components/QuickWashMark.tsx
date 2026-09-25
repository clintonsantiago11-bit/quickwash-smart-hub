interface QuickWashMarkProps {
  className?: string;
  title?: string;
}

/** QuickWash's water-and-soap mark: a droplet carrying two clean bubbles. */
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
        d="M24 8.5C24 8.5 12.5 21.2 12.5 29.2a11.5 11.5 0 0 0 23 0C35.5 21.2 24 8.5 24 8.5Z"
        fill="#22D3EE"
        fillOpacity="0.12"
        stroke="#F8FAFC"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <circle cx="27.4" cy="29.3" r="5.1" fill="#0C1929" fillOpacity="0.72" stroke="#22D3EE" strokeWidth="2" />
      <circle cx="20.5" cy="25.3" r="2.1" fill="#67E8F9" />
      <path
        d="M20.5 18.5c-1.7 2.1-2.9 4.2-3.5 5.8"
        fill="none"
        stroke="#F8FAFC"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}
