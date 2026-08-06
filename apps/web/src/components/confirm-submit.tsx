"use client";

/** Submit button that asks the browser's native confirm() first. */
export default function ConfirmSubmit({
  message,
  className,
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={`max-w-full ${className ?? ""}`}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
