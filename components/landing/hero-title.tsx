"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";

const WORDS = ["Pandoras", "Box"];
const SPRING = { type: "spring", stiffness: 320, damping: 22, mass: 0.9 } as const;

// Letters climb out of each word's line one by one, like things escaping the box.
const word: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.055 } },
};

const letter: Variants = {
  hidden: (i: number) => ({ y: "105%", rotate: i % 2 ? 9 : -9, opacity: 0 }),
  shown: { y: "0%", rotate: 0, opacity: 1, transition: SPRING },
};

export function HeroTitle() {
  const reduceMotion = useReducedMotion();

  return (
    <h1
      aria-label="Pandoras Box"
      className="font-display text-[clamp(56px,8.6vw,150px)] leading-[0.8] text-paper uppercase"
    >
      {WORDS.map((text, wordIndex) => (
        <motion.span
          key={text}
          aria-hidden="true"
          className="block overflow-hidden pt-[0.06em] pb-[0.02em]"
          variants={word}
          initial={reduceMotion ? false : "hidden"}
          animate="shown"
          transition={{ delayChildren: 0.15 + wordIndex * 0.38 }}
        >
          {[...text].map((char, i) => (
            <motion.span
              key={`${char}-${i}`}
              custom={i}
              variants={letter}
              whileHover={reduceMotion ? undefined : { y: "-10%", rotate: i % 2 ? 4 : -4 }}
              transition={SPRING}
              className="inline-block cursor-default will-change-transform"
            >
              {char}
            </motion.span>
          ))}
        </motion.span>
      ))}
    </h1>
  );
}
