import { Link } from "react-router-dom";

// Two strands that draw themselves once, then fade out on the right: a room that doesn't last.
function Twine() {
  return (
    <svg className="twine" viewBox="0 0 960 180" role="img" aria-label="Two strands twisting together and fading away">
      <defs>
        <linearGradient id="fadeTeal" gradientUnits="userSpaceOnUse" x1="0" x2="960" y1="0" y2="0">
          <stop offset="0" stopColor="#0B7A75" />
          <stop offset="0.6" stopColor="#0B7A75" />
          <stop offset="1" stopColor="#0B7A75" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fadeSaffron" gradientUnits="userSpaceOnUse" x1="0" x2="960" y1="0" y2="0">
          <stop offset="0" stopColor="#F2A33A" />
          <stop offset="0.6" stopColor="#F2A33A" />
          <stop offset="1" stopColor="#F2A33A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        className="strand"
        pathLength="1"
        stroke="url(#fadeTeal)"
        d="M0,90 C40,10 80,10 120,90 S200,170 240,90 S320,10 360,90 S440,170 480,90 S560,10 600,90 S680,170 720,90 S800,10 840,90 S920,170 960,90"
      />
      <path
        className="strand strand-late"
        pathLength="1"
        stroke="url(#fadeSaffron)"
        d="M0,90 C40,170 80,170 120,90 S200,10 240,90 S320,170 360,90 S440,10 480,90 S560,170 600,90 S680,10 720,90 S800,170 840,90 S920,10 960,90"
      />
    </svg>
  );
}

const STEPS = [
  { title: "Create a room", text: "Name it and get a 4-digit room code. You become the sender." },
  { title: "Add your people", text: "Add up to 10 participants by name. Each one gets their own 8-character ID." },
  { title: "Share the details", text: "Send each person the room code and their ID. They join with their name, the code and the ID." },
  { title: "Share, then vanish", text: "Everyone's presence is checked every few seconds. When the sender leaves, the room and its history are deleted." },
];

export default function Home() {
  return (
    <main>
      <section className="container hero">
        <h1>Share files in a room that disappears.</h1>
        <p className="lead">
          Twyne is a temporary room for sending files to people you choose. There are no accounts and nothing is
          saved. When you leave, the room is gone.
        </p>
        <div className="hero-actions">
          <Link to="/create" className="btn btn-primary">Create a room</Link>
          <Link to="/join" className="btn btn-secondary">Join a room</Link>
        </div>
        <Twine />
      </section>

      <section className="container section" aria-labelledby="what-heading">
        <div className="split">
          <div>
            <h2 id="what-heading">Built to be temporary</h2>
            <p>
              A Twyne room only exists while its sender has the page open. Receivers join with a code and a personal
              ID, and can take part only while their own browser is connected.
            </p>
            <p className="muted small">
              Early build: rooms, participants and presence work today. Sending files comes next.
            </p>
          </div>
          <dl className="facts">
            <div><dt>No accounts</dt><dd>Sessions live in the browser tab and end when it closes.</dd></div>
            <div><dt>Nothing stored</dt><dd>Only room details are kept, and only while the room is open.</dd></div>
            <div><dt>Closes with the sender</dt><dd>If the sender goes quiet for about 15 seconds, the room is deleted.</dd></div>
          </dl>
        </div>
      </section>

      <section className="container section" aria-labelledby="how-heading">
        <h2 id="how-heading">How Twyne Works</h2>
        <ol className="steps">
          {STEPS.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="container footer">
        <p>Twyne is a college project. Rooms last only as long as their sender's browser tab.</p>
      </footer>
    </main>
  );
}
