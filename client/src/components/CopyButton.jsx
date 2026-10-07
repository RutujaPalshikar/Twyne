import { useState } from "react";
import { copyText } from "../utils/copy.js";

export default function CopyButton({ text, label = "Copy", className = "btn btn-ghost btn-small" }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (await copyText(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }
  return (
    <button type="button" className={className} onClick={handleClick} aria-live="polite">
      {copied ? "Copied" : label}
    </button>
  );
}
