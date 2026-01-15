export function OptionalMark({
  mark,
  markTitle,
  markColor,
}: {
  mark?: string | undefined;
  markTitle?: string | undefined;
  markColor?: string | undefined;
}) {
  if (!mark) {
    return;
  }

  return (
    <div
      className="
        rounded-full bg-gray-200 px-2 text-xs whitespace-nowrap text-black
      "
      title={markTitle}
      style={{ background: markColor }}
    >
      {mark}
    </div>
  );
}
