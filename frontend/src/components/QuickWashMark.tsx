import Image from 'next/image';

interface QuickWashMarkProps {
  className?: string;
  title?: string;
}

/** Shared Empoy Vendo Carwash brand image used throughout QuickWash. */
export default function QuickWashMark({ className, title = 'QuickWash' }: QuickWashMarkProps) {
  return (
    <Image
      src="/vendologo.png"
      alt={title}
      title={title || undefined}
      aria-hidden={title ? undefined : true}
      width={256}
      height={256}
      className={className}
    />
  );
}
