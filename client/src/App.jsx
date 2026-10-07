import { Routes, Route, Link } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Notice from "./components/Notice.jsx";
import { useSession } from "./context/SessionContext.jsx";
import Home from "./pages/Home.jsx";
import CreateRoom from "./pages/CreateRoom.jsx";
import JoinRoom from "./pages/JoinRoom.jsx";
import SenderRoom from "./pages/SenderRoom.jsx";
import ParticipantRoom from "./pages/ParticipantRoom.jsx";

function NotFound() {
  return (
    <main className="container page">
      <h1>Page not found</h1>
      <p className="muted">That address doesn't lead anywhere in Twyne.</p>
      <Link to="/" className="btn btn-primary">Go to Home</Link>
    </main>
  );
}

export default function App() {
  const { notice, clearNotice } = useSession();
  return (
    <>
      <Navbar />
      {notice && (
        <div className="container banner">
          <Notice tone="info" onDismiss={clearNotice}>{notice}</Notice>
        </div>
      )}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateRoom />} />
        <Route path="/join" element={<JoinRoom />} />
        <Route path="/sender/:roomCode" element={<SenderRoom />} />
        <Route path="/room/:roomCode" element={<ParticipantRoom />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
