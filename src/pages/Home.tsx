import { Link } from 'react-router-dom'
import './Home.css'

function Home() {
  return (
    <main className="home">
      <Link to="/login" className="home__login-link">
        Log In
      </Link>

      <div className="home__surprise-wrap">
        <Link to="/surprise" className="home__surprise-box">
          <img
            className="home__surprise-charm"
            src="/bookandlove.png"
            alt=""
            aria-hidden="true"
          />
          <p className="home__surprise-hint">Don't be a boring one, show her you care.</p>
        </Link>
        <Link to="/surprise" className="home__preview-link">
          Click to see a preview
        </Link>
      </div>
    </main>
  )
}

export default Home
