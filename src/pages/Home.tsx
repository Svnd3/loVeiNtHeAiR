import { Link } from 'react-router-dom'
import ReportButton from '../components/ReportButton'
import './Home.css'

function Home() {
  return (
    <main className="home">
      <ReportButton />

      <Link to="/login" className="home__login-link">
        Sign Up
      </Link>

      <div className="home__surprise-wrap">
        <Link to="/surprise" className="home__surprise-box">
          <img
            className="home__surprise-charm"
            src="/bookandlove.png"
            alt=""
            aria-hidden="true"
          />
          <p className="home__surprise-hint">Click me</p>
          <span className="home__preview-link">Click me for a preview</span>
        </Link>
      </div>
    </main>
  )
}

export default Home
