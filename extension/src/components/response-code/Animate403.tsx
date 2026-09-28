import { useEffect, useState } from "react";
import "./Animate403.scss";

interface TerminalSegment {
  text: string;
  className?: string;
  href?: string;
}

const TERMINAL_LINES: TerminalSegment[][] = [
  [
    { text: "> " },
    { text: "ERROR CODE", className: "animate-403__label" },
    { text: ': "' },
    { text: "HTTP 403 Forbidden", className: "animate-403__italic" },
    { text: '"' },
  ],
  [
    { text: "> " },
    { text: "ERROR DESCRIPTION", className: "animate-403__label" },
    { text: ': "' },
    {
      text: "Access Denied. You Do Not Have The Permission To Access This Page On This Server",
      className: "animate-403__italic",
    },
    { text: '"' },
  ],
  [
    { text: "> " },
    { text: "ERROR POSSIBLY CAUSED BY", className: "animate-403__label" },
    { text: ": [" },
    {
      text: "execute access forbidden, read access forbidden, write access forbidden, ssl required, ssl 128 required, ip address rejected, client certificate required, site access denied, too many users, invalid configuration, password change, mapper denied access, client certificate revoked, directory listing denied, client access licenses exceeded, client certificate is untrusted or invalid, client certificate has expired or is not yet valid, passport logon failed, source access denied, infinite depth is denied, too many requests from the same client ip",
      className: "animate-403__bold",
    },
    { text: "]..." },
  ],
  [
    { text: "> " },
    {
      text: "SOME PAGES ON THIS SERVER THAT YOU DO HAVE PERMISSION TO ACCESS",
      className: "animate-403__label",
    },
    { text: ": [" },
    { text: "Home Page", href: "/" },
    { text: ", " },
    { text: "About Us", href: "/" },
    { text: ", " },
    { text: "Contact Us", href: "/" },
    { text: ", " },
    { text: "Blog", href: "/" },
    { text: "]..." },
  ],
  [
    { text: "> " },
    {
      text: "HAVE A NICE DAY SIR AXLEROD :-) ",
      className: "animate-403__label",
    },
  ],
];

const getCharacterCount = (text: string) => Array.from(text).length;

const TOTAL_CHARACTERS = TERMINAL_LINES.flat().reduce(
  (total, segment) => total + getCharacterCount(segment.text),
  0,
);

function Animate403() {
  const [visibleCharacters, setVisibleCharacters] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisibleCharacters(TOTAL_CHARACTERS);
      return;
    }

    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      let characterCount = 0;
      intervalId = window.setInterval(() => {
        characterCount += 1;
        setVisibleCharacters(characterCount);

        if (characterCount >= TOTAL_CHARACTERS && intervalId !== undefined) {
          window.clearInterval(intervalId);
          intervalId = undefined;
        }
      }, 10);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, []);

  let charactersBeforeLine = 0;
  let cursorLineIndex = TERMINAL_LINES.length - 1;
  for (let index = 0; index < TERMINAL_LINES.length; index += 1) {
    const lineLength = TERMINAL_LINES[index].reduce(
      (total, segment) => total + getCharacterCount(segment.text),
      0,
    );
    if (visibleCharacters < charactersBeforeLine + lineLength) {
      cursorLineIndex = index;
      break;
    }
    charactersBeforeLine += lineLength;
  }

  let remainingCharacters = visibleCharacters;

  return (
    <section className="animate-403" aria-label="HTTP 403 Forbidden">
      <h1>403</h1>
      <div className="animate-403__content">
        {TERMINAL_LINES.slice(0, cursorLineIndex + 1).map((line, lineIndex) => (
          <p className="animate-403__line" key={lineIndex}>
            {line.map((segment, segmentIndex) => {
              const characters = Array.from(segment.text);
              const visibleText = characters
                .slice(0, remainingCharacters)
                .join("");
              remainingCharacters = Math.max(
                0,
                remainingCharacters - characters.length,
              );
              if (!visibleText) return null;

              const content = segment.href ? (
                <a href={segment.href}>{visibleText}</a>
              ) : (
                visibleText
              );

              return (
                <span className={segment.className} key={segmentIndex}>
                  {content}
                </span>
              );
            })}
            {lineIndex === cursorLineIndex && visibleCharacters < TOTAL_CHARACTERS && (
              <span className="animate-403__cursor" aria-hidden="true">
                |
              </span>
            )}
          </p>
        ))}
      </div>
    </section>
  );
}

export default Animate403;