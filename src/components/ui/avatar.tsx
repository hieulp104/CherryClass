import { avatarLetter, cn } from "@/lib/utils";

/** Avatar chữ cái đầu của tên trên nền pastel riêng mỗi em (hue lưu trong DB). */
export function StudentAvatar({
  name,
  hue,
  size = 44,
  className,
}: {
  name: string;
  hue: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("avatar-pastel grid shrink-0 place-items-center rounded-full font-extrabold", className)}
      style={{ ["--hue" as string]: hue, width: size, height: size, fontSize: size * 0.42 }}
    >
      {avatarLetter(name)}
    </span>
  );
}
