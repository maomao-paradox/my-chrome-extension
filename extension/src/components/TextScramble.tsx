import { useEffect, useState } from "react";
import "./TextScramble.scss";

export interface TextScrambleProps {
  phrases?: string[];
  chars?: string;
  speed?: number;
  className?: string;
}

export const DEFAULT_TEXT_SCRAMBLE_PHRASES = [
  "Neo,",
  "sooner or later",
  "you're going to realize",
  "just as I did",
  "that there's a difference",
  "between knowing the path",
  "and walking the path",
];

interface ScrambleCharacter {
  value: string;
  isScrambled: boolean;
}

const DEFAULT_CHARS = "!<>-_\\/[]{}?=+*^?#________";

const TextScramble = ({
  phrases = DEFAULT_TEXT_SCRAMBLE_PHRASES,
  chars = DEFAULT_CHARS,
  speed = 800,
  className = "",
}: TextScrambleProps) => {
  const [renderedCharacters, setRenderedCharacters] = useState<ScrambleCharacter[]>([]);

  useEffect(() => {
    if (phrases.length === 0) {
      setRenderedCharacters([]);
      return;
    }

    let disposed = false;
    let frame = 0;
    let frameRequest: number | undefined;
    let delayTimeout: number | undefined;
    let currentText = "";
    let phraseIndex = 0;
    const alphabet = chars || DEFAULT_CHARS;

    const animateTo = (nextText: string) => {
      const fromCharacters = Array.from(currentText);
      const targetCharacters = Array.from(nextText);
      const queue = Array.from(
        { length: Math.max(fromCharacters.length, targetCharacters.length) },
        (_, index) => {
          const start = Math.floor(Math.random() * 40);
          return {
            from: fromCharacters[index] ?? "",
            to: targetCharacters[index] ?? "",
            start,
            end: start + Math.floor(Math.random() * 40),
            randomCharacter: "",
          };
        },
      );

      frame = 0;
      const update = () => {
        if (disposed) return;
        let complete = 0;
        const nextCharacters = queue.map((character) => {
          if (frame >= character.end) {
            complete += 1;
            return { value: character.to, isScrambled: false };
          }
          if (frame >= character.start) {
            if (!character.randomCharacter || Math.random() < 0.28) {
              character.randomCharacter =
                alphabet[Math.floor(Math.random() * alphabet.length)];
            }
            return { value: character.randomCharacter, isScrambled: true };
          }
          return { value: character.from, isScrambled: false };
        });

        setRenderedCharacters(nextCharacters);
        if (complete === queue.length) {
          currentText = nextText;
          delayTimeout = window.setTimeout(() => {
            phraseIndex = (phraseIndex + 1) % phrases.length;
            animateTo(phrases[phraseIndex]);
          }, Math.max(0, speed));
          return;
        }

        frame += 1;
        frameRequest = window.requestAnimationFrame(update);
      };

      update();
    };

    animateTo(phrases[phraseIndex]);

    return () => {
      disposed = true;
      if (frameRequest !== undefined) window.cancelAnimationFrame(frameRequest);
      if (delayTimeout !== undefined) window.clearTimeout(delayTimeout);
    };
  }, [phrases, chars, speed]);

  return (
    <div className={`text-scramble ${className}`.trim()}>
      <div className="text-scramble__text" aria-live="off">
        {renderedCharacters.map((character, index) => (
          <span
            className={character.isScrambled ? "text-scramble__dud" : undefined}
            key={`${index}-${character.value}`}
          >
            {character.value}
          </span>
        ))}
      </div>
    </div>
  );
};

export default TextScramble;