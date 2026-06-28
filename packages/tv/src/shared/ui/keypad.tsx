// The D-pad numeric keypad for the PIN screen.

/** A D-pad numeric keypad for the PIN screen: 1–9, then ⌫ / 0 / OK. */
export function Keypad({
  onDigit,
  onDelete,
  onSubmit,
}: Readonly<{
  onDigit: (d: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
}>) {
  const cell =
    'flex h-18 w-22 cursor-pointer items-center justify-center rounded-2xl bg-[rgba(255,255,255,0.06)] font-sans text-[28px] font-bold text-text transition-transform focus:scale-[1.08] focus:bg-[rgba(244,182,66,0.18)] focus:text-accent';
  return (
    <div className="flex flex-col gap-3.25">
      {[
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
      ].map((row) => (
        <div key={row.join('')} className="flex gap-3.25">
          {row.map((d) => (
            <button key={d} data-focus="" type="button" className={cell} onClick={() => onDigit(d)}>
              {d}
            </button>
          ))}
        </div>
      ))}
      <div className="flex gap-3.25">
        <button data-focus="" type="button" className={`${cell} text-[22px]`} onClick={onDelete}>
          ⌫
        </button>
        <button data-focus="" type="button" className={cell} onClick={() => onDigit('0')}>
          0
        </button>
        <button
          data-focus=""
          type="button"
          className="flex h-18 w-22 cursor-pointer items-center justify-center rounded-2xl bg-accent font-sans text-[18px] font-bold text-accent-ink transition-transform focus:scale-[1.08]"
          onClick={onSubmit}
        >
          OK
        </button>
      </div>
    </div>
  );
}
