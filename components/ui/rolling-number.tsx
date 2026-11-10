"use client";

import { motion, useSpring, useTransform, type MotionValue } from "motion/react";
import { useEffect } from "react";

// From Cult UI's rolling-number, trimmed to what the countdown uses.
export function RollingNumber({ value }: { value: number }) {
  const spring = useSpring(value, { mass: 0.8, stiffness: 75, damping: 15 });
  const display: MotionValue<string> = useTransform(spring, (current) =>
    Math.round(current).toString(),
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span className="tabular-nums">{display}</motion.span>;
}
