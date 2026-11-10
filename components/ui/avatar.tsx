"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn } from "cn";

// Adapted from Cult UI's collab-avatar: same initials and entrance, flat sticker styling, plus a photo.
const WHITESPACE = /\s+/;

export function initialsFromName(name: string): string {
  const parts = name.trim().split(WHITESPACE).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0] ?? "").slice(0, 2).toUpperCase();
}

const ENTER_EASE = [0.2, 0, 0, 1] as const;

export function Avatar({
  src,
  name,
  className,
}: {
  src: string | null;
  name: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(src) && !photoFailed;

  return (
    <motion.span
      data-slot="avatar"
      className={cn(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-pill border border-carbon bg-sun text-[13px] font-bold",
        className,
      )}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: ENTER_EASE }}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- Google photo URLs vary; next/image would need every host allowlisted.
        <img
          src={src ?? undefined}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover"
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initialsFromName(name)}</span>
      )}
    </motion.span>
  );
}
