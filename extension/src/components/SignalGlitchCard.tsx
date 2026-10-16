import "./signal-glitch-card.scss";

function SignalGlitchCard({ text = "TEXT GLITCH" }: { text?: string }) {
  return (
    <div className="content">
      <div className="text" data-text={text}>
        {text}
      </div>
    </div>
  );
}

export default SignalGlitchCard;
