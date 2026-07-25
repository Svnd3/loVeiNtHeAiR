import { Link } from 'react-router-dom'
import './Home.css'

function Home() {
  return (
    <main className="home">
      <Link to="/login" className="home__login-link">
        Log In
      </Link>

      <Link to="/surprise" className="home__surprise-box">
        <p className="home__surprise-hint">your surprise is on its way… 🎀</p>
      </Link>
    </main>
  )
}

export default Home
