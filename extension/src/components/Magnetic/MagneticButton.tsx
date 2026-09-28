import { type CSSProperties, type PointerEvent } from "react";
import "./magnetic-button.scss";

const MAGNETIC_BUTTONS = [
  {
    name: "Bath",
    color: "hotpink",
    viewBox: "0 0 512 512",
    path: "M32,384a95.4,95.4,0,0,0,32,71.09V496a16,16,0,0,0,16,16h32a16,16,0,0,0,16-16V480H384v16a16,16,0,0,0,16,16h32a16,16,0,0,0,16-16V455.09A95.4,95.4,0,0,0,480,384V336H32ZM496,256H80V69.25a21.26,21.26,0,0,1,36.28-15l19.27,19.26c-13.13,29.88-7.61,59.11,8.62,79.73l-.17.17A16,16,0,0,0,144,176l11.31,11.31a16,16,0,0,0,22.63,0L283.31,81.94a16,16,0,0,0,0-22.63L272,48a16,16,0,0,0-22.62,0l-.17.17c-20.62-16.23-49.83-21.75-79.73-8.62L150.22,20.28A69.25,69.25,0,0,0,32,69.25V256H16A16,16,0,0,0,0,272v16a16,16,0,0,0,16,16H496a16,16,0,0,0,16-16V272A16,16,0,0,0,496,256Z",
  },
  {
    name: "Poo",
    color: "aquamarine",
    viewBox: "0 0 512 512",
    path: "M451.4 369.1C468.7 356 480 335.4 480 312c0-39.8-32.2-72-72-72h-14.1c13.4-11.7 22.1-28.8 22.1-48 0-35.3-28.7-64-64-64h-5.9c3.6-10.1 5.9-20.7 5.9-32 0-53-43-96-96-96-5.2 0-10.2.7-15.1 1.5C250.3 14.6 256 30.6 256 48c0 44.2-35.8 80-80 80h-16c-35.3 0-64 28.7-64 64 0 19.2 8.7 36.3 22.1 48H104c-39.8 0-72 32.2-72 72 0 23.4 11.3 44 28.6 57.1C26.3 374.6 0 404.1 0 440c0 39.8 32.2 72 72 72h368c39.8 0 72-32.2 72-72 0-35.9-26.3-65.4-60.6-70.9zM192 256c17.7 0 32 14.3 32 32s-14.3 32-32 32-32-14.3-32-32 14.3-32 32-32zm159.5 139C341 422.9 293 448 256 448s-85-25.1-95.5-53c-2-5.3 2-11 7.8-11h175.4c5.8 0 9.8 5.7 7.8 11zM320 320c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z",
  },
  {
    name: "Golf Ball",
    color: "gold",
    viewBox: "0 -50 416 562",
    path: "M96 416h224c0 17.7-14.3 32-32 32h-16c-17.7 0-32 14.3-32 32v20c0 6.6-5.4 12-12 12h-40c-6.6 0-12-5.4-12-12v-20c0-17.7-14.3-32-32-32h-16c-17.7 0-32-14.3-32-32zm320-208c0 74.2-39 139.2-97.5 176h-221C39 347.2 0 282.2 0 208 0 93.1 93.1 0 208 0s208 93.1 208 208zm-180.1 43.9c18.3 0 33.1-14.8 33.1-33.1 0-14.4-9.3-26.3-22.1-30.9 9.6 26.8-15.6 51.3-41.9 41.9 4.6 12.8 16.5 22.1 30.9 22.1zm49.1 46.9c0-14.4-9.3-26.3-22.1-30.9 9.6 26.8-15.6 51.3-41.9 41.9 4.6 12.8 16.5 22.1 30.9 22.1 18.3 0 33.1-14.9 33.1-33.1zm64-64c0-14.4-9.3-26.3-22.1-30.9 9.6 26.8-15.6 51.3-41.9 41.9 4.6 12.8-16.5 22.1-30.9 22.1 18.3 0 33.1-14.9 33.1-33.1z",
  },
] as const;

const resetButtonPosition = (button: HTMLDivElement) => {
  button.style.setProperty("--tx", "0px");
  button.style.setProperty("--ty", "0px");
  button.style.setProperty("--opacity", "0.25");
};

const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
  const button = event.currentTarget;
  const rect = button.getBoundingClientRect();
  const radius = Math.min(rect.width, rect.height) / 2;
  const x = event.clientX - rect.left - rect.width / 2;
  const y = event.clientY - rect.top - rect.height / 2;
  const distance = Math.sqrt(x * x + y * y);
  const attraction = radius > 0 ? Math.max(0, 1 - distance / radius) : 0;
  const movement = attraction * distance;
  const tx = distance === 0 ? 0 : Math.round((x / distance) * movement * 100) / 100;
  const ty = distance === 0 ? 0 : Math.round((y / distance) * movement * 100) / 100;

  button.style.setProperty("--tx", `${tx}px`);
  button.style.setProperty("--ty", `${ty}px`);
  button.style.setProperty("--opacity", String(0.25 + attraction * 0.75));
};

function MagneticButton() {
  return (
    <div className="magnetic-button-gallery" aria-label="磁吸图标按钮">
      {MAGNETIC_BUTTONS.map((icon) => (
        <div
          className="gravityButton"
          key={icon.name}
          onPointerMove={handlePointerMove}
          onPointerLeave={(event) => resetButtonPosition(event.currentTarget)}
        >
          <button
            type="button"
            aria-label={icon.name}
            style={{ "--color": icon.color } as CSSProperties}
          >
            <svg
              className="buttonIcon"
              viewBox={icon.viewBox}
              aria-hidden="true"
              focusable="false"
            >
              <title>{icon.name}</title>
              <path d={icon.path} />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

export default MagneticButton;