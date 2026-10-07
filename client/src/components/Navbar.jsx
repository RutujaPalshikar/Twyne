import { Link, NavLink } from "react-router-dom";
import Logo from "./Logo.jsx";
import { useSession } from "../context/SessionContext.jsx";

export default function Navbar() {
  const { session } = useSession();
  const roomPath = session
    ? session.role === "sender"
      ? `/sender/${session.roomCode}`
      : `/room/${session.roomCode}`
    : null;

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="brand" aria-label="Twyne home">
          <Logo />
          <span>Twyne</span>
        </Link>
        <nav aria-label="Main">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/create">Create Room</NavLink>
          <NavLink to="/join">Join Room</NavLink>
          {roomPath && <NavLink to={roomPath} className="nav-room">My room</NavLink>}
        </nav>
      </div>
    </header>
  );
}
