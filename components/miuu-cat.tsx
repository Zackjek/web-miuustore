import Image from "next/image";

export function MiuuCat({className}: {className?: string}) {
  return (
    <Image
      src="/apple-icon.png?v=2"
      alt=""
      aria-hidden="true"
      width={64}
      height={64}
      className={className}
      style={{borderRadius: "22%", objectFit: "cover"}}
      unoptimized
      draggable={false}
    />
  );
}