'use client';

import React, { useState } from 'react';

interface IntegerCellInputProps {
  value: number;
  /** Lowest accepted value; undefined allows negatives (e.g. a stock adjustment of -1) */
  min?: number;
  disabled?: boolean;
  label: string;
  className: string;
  onChange: (value: number) => void;
}

// Grid qty cell that keeps the typed text: a parsed `|| default` turned a cleared box into the default, so typing 5
// gave 15 and "-" could not start a negative. A valid whole number >= min is applied as typed; an empty, unfinished
// or too-small entry falls back to the last valid value on blur / Enter.
export default function IntegerCellInput({ value, min, disabled, label, className, onChange }: IntegerCellInputProps) {
  const [text, setText] = useState<string | null>(null);
  const allowNegative = min === undefined || min < 0;
  return (
    <input
      type="number"
      step={1}
      min={min}
      disabled={disabled}
      value={text ?? value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        // A number input reports "" while its text is only "-"
        const raw = e.target.value;
        if (raw !== '' && !(allowNegative ? /^-?\d+$/ : /^\d+$/).test(raw)) return;
        setText(raw);
        const n = parseInt(raw, 10);
        if (raw !== '' && (min === undefined || n >= min)) onChange(n);
      }}
      onBlur={() => setText(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          setText(null);
        }
      }}
      aria-label={label}
      className={className}
    />
  );
}
